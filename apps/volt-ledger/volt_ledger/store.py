"""SQLite store. Every table is append-only: triggers refuse UPDATE and DELETE, so history cannot be changed
even by a bug in the Python code."""
from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from typing import Iterator

SCHEMA = """
CREATE TABLE IF NOT EXISTS evidence (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  evidence_id TEXT UNIQUE NOT NULL,
  tool TEXT NOT NULL, inputs TEXT NOT NULL, outputs TEXT NOT NULL, sources TEXT NOT NULL,
  code_version TEXT NOT NULL, actor TEXT NOT NULL, prev_hash TEXT NOT NULL, hash TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS element (
  element_id TEXT PRIMARY KEY, element_type TEXT NOT NULL, label TEXT NOT NULL,
  xbrl_ifrs TEXT, xbrl_usgaap TEXT, balance_type TEXT, period_type TEXT,
  traits TEXT NOT NULL, provenance TEXT NOT NULL, evidence_id TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS association (
  association_id TEXT PRIMARY KEY, from_element TEXT NOT NULL REFERENCES element(element_id),
  to_element TEXT NOT NULL REFERENCES element(element_id), association_type TEXT NOT NULL,
  gaap TEXT, weight TEXT, ord INTEGER, confidence TEXT, evidence_id TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS source_document (
  doc_id TEXT PRIMARY KEY, kind TEXT NOT NULL, filename TEXT NOT NULL, sha256 TEXT NOT NULL,
  period TEXT, currency TEXT, uploaded_by TEXT NOT NULL, evidence_id TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tb_row (
  doc_id TEXT NOT NULL REFERENCES source_document(doc_id), row_number INTEGER NOT NULL,
  account_id TEXT NOT NULL REFERENCES element(element_id), account_code TEXT NOT NULL, account_name TEXT NOT NULL,
  debit_minor INTEGER NOT NULL, credit_minor INTEGER NOT NULL, currency TEXT NOT NULL, period TEXT NOT NULL,
  dimensions TEXT NOT NULL, raw TEXT NOT NULL,
  PRIMARY KEY (doc_id, row_number)
);
CREATE TABLE IF NOT EXISTS journal_entry (
  journal_id TEXT PRIMARY KEY, idempotency_key TEXT UNIQUE NOT NULL, payload_hash TEXT NOT NULL,
  period TEXT NOT NULL, status TEXT NOT NULL, kind TEXT NOT NULL, gaap TEXT NOT NULL,
  reverses_journal_id TEXT UNIQUE REFERENCES journal_entry(journal_id),
  description TEXT NOT NULL, actor TEXT NOT NULL, evidence_id TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS journal_line (
  journal_id TEXT NOT NULL REFERENCES journal_entry(journal_id), line_no INTEGER NOT NULL,
  account_id TEXT NOT NULL REFERENCES element(element_id), dimensions TEXT NOT NULL,
  debit_minor INTEGER NOT NULL CHECK (debit_minor >= 0), credit_minor INTEGER NOT NULL CHECK (credit_minor >= 0),
  currency TEXT NOT NULL,
  CHECK ((debit_minor > 0) <> (credit_minor > 0)),
  PRIMARY KEY (journal_id, line_no)
);
CREATE TABLE IF NOT EXISTS review_item (
  item_id TEXT PRIMARY KEY, kind TEXT NOT NULL, ref_id TEXT NOT NULL, reason TEXT NOT NULL, evidence_id TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS review_decision (
  seq INTEGER PRIMARY KEY AUTOINCREMENT, item_id TEXT NOT NULL REFERENCES review_item(item_id),
  stage TEXT NOT NULL CHECK (stage IN ('engagement_lead','client')),
  decision TEXT NOT NULL CHECK (decision IN ('approve','reject','amend')),
  by_user TEXT NOT NULL, note TEXT NOT NULL, evidence_id TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS period_lock_event (
  seq INTEGER PRIMARY KEY AUTOINCREMENT, period TEXT NOT NULL, action TEXT NOT NULL CHECK (action IN ('lock','unlock')),
  actor TEXT NOT NULL, reason TEXT NOT NULL, evidence_id TEXT NOT NULL
);
"""

APPEND_ONLY_TABLES = (
    "evidence", "element", "association", "source_document", "tb_row",
    "journal_entry", "journal_line", "period_lock_event", "review_item", "review_decision",
)


def _triggers() -> str:
    out = []
    for t in APPEND_ONLY_TABLES:
        out.append(f"CREATE TRIGGER IF NOT EXISTS {t}_no_update BEFORE UPDATE ON {t} "
                   f"BEGIN SELECT RAISE(ABORT, 'append-only: {t}'); END;")
        out.append(f"CREATE TRIGGER IF NOT EXISTS {t}_no_delete BEFORE DELETE ON {t} "
                   f"BEGIN SELECT RAISE(ABORT, 'append-only: {t}'); END;")
    return "\n".join(out)


class Store:
    def __init__(self, path: str = ":memory:") -> None:
        self.conn = sqlite3.connect(path, isolation_level=None)  # we manage transactions ourselves
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("PRAGMA foreign_keys = ON")
        if path != ":memory:":
            self.conn.execute("PRAGMA journal_mode = WAL")
        self.conn.executescript(SCHEMA + _triggers())

    @contextmanager
    def transaction(self) -> Iterator[sqlite3.Cursor]:
        """BEGIN IMMEDIATE ... COMMIT; any exception rolls everything back, including evidence."""
        cur = self.conn.cursor()
        cur.execute("BEGIN IMMEDIATE")
        try:
            yield cur
        except BaseException:
            cur.execute("ROLLBACK")
            raise
        else:
            cur.execute("COMMIT")

    def count(self, table: str) -> int:
        if table not in APPEND_ONLY_TABLES:
            raise ValueError(table)
        return self.conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]

    def close(self) -> None:
        self.conn.close()
