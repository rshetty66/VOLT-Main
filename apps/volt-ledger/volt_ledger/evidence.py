"""Evidence ledger: one record per tool call, chained with SHA-256 so any later edit is detectable."""
from __future__ import annotations

import hashlib
import json
import os
import sqlite3
from dataclasses import dataclass
from typing import Any

from .store import Store

GENESIS = "0" * 64


def code_version() -> str:
    return os.environ.get("VOLT_LEDGER_CODE_VERSION", "dev")


def canonical_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def _digest(prev_hash: str, body: dict) -> str:
    return hashlib.sha256((prev_hash + canonical_json(body)).encode("ascii")).hexdigest()


@dataclass(frozen=True)
class EvidenceRecord:
    evidence_id: str
    hash: str


def write_evidence(cur: sqlite3.Cursor, tool: str, inputs: dict, outputs: dict,
                   sources: list[dict], actor: str) -> EvidenceRecord:
    """Must be called inside the same transaction as the data it describes."""
    row = cur.execute("SELECT seq, hash FROM evidence ORDER BY seq DESC LIMIT 1").fetchone()
    seq = (row[0] if row else 0) + 1
    prev_hash = row[1] if row else GENESIS
    evidence_id = f"E{seq:06d}"
    body = {"evidence_id": evidence_id, "tool": tool, "inputs": canonical_json(inputs),
            "outputs": canonical_json(outputs), "sources": canonical_json(sources),
            "code_version": code_version(), "actor": actor}
    h = _digest(prev_hash, body)
    cur.execute(
        "INSERT INTO evidence (evidence_id, tool, inputs, outputs, sources, code_version, actor, prev_hash, hash) "
        "VALUES (?,?,?,?,?,?,?,?,?)",
        (evidence_id, tool, body["inputs"], body["outputs"], body["sources"], body["code_version"], actor,
         prev_hash, h),
    )
    return EvidenceRecord(evidence_id, h)


def verify_chain(store: Store) -> list[str]:
    """Recompute every hash in order; return the ids of records that do not match (empty list = intact)."""
    broken: list[str] = []
    prev = GENESIS
    for r in store.conn.execute("SELECT * FROM evidence ORDER BY seq"):
        # Hash the stored text exactly as stored, so any change of even one byte is detected.
        body = {k: r[k] for k in ("evidence_id", "tool", "inputs", "outputs", "sources", "code_version", "actor")}
        if r["prev_hash"] != prev or _digest(prev, body) != r["hash"]:
            broken.append(r["evidence_id"])
        prev = r["hash"]
    return broken
