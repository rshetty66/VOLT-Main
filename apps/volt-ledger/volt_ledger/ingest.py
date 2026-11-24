"""Trial balance ingestion (Phase 6 step 1). Every data row in the file is either stored or rejected with a reason:
stored + rejected == data rows, always."""
from __future__ import annotations

import csv
import hashlib
import io
import json
import re
import zipfile
from dataclasses import dataclass, field
from pathlib import Path
from xml.etree import ElementTree as ET

from .evidence import write_evidence
from .money import AmountError, parse_amount, to_wire
from .ontology import member_exists
from .store import Store

_PERIOD = re.compile(r"[0-9]{4}-(0[1-9]|1[0-2])")
_NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


class IngestError(ValueError):
    pass


@dataclass(frozen=True)
class ColumnMap:
    account_code: str = "account_code"
    account_name: str = "account_name"
    debit: str = "debit"
    credit: str = "credit"
    dimensions: dict[str, str] = field(default_factory=dict)   # dimension name -> column name


@dataclass(frozen=True)
class Rejected:
    row_number: int
    reason: str


@dataclass(frozen=True)
class IngestResult:
    doc_id: str
    created: bool
    data_rows: int
    stored: int
    rejected: list[Rejected]
    total_debit: int
    total_credit: int
    balanced: bool
    evidence_id: str


def read_rows(path: Path) -> list[list[str]]:
    """All rows as text, header first. Numbers are kept as the text written in the file, never as floats."""
    suffix = path.suffix.lower()
    if suffix == ".csv":
        text = path.read_bytes().decode("utf-8-sig")
        return [row for row in csv.reader(io.StringIO(text, newline=""))]
    if suffix == ".xlsx":
        return _xlsx_rows(path)
    raise IngestError(f"unsupported file type {suffix}; use .csv or .xlsx")


def _xlsx_rows(path: Path) -> list[list[str]]:
    """Reads the first worksheet's raw XML so numeric cells keep their exact text (openpyxl would give floats)."""
    with zipfile.ZipFile(path) as z:
        shared: list[str] = []
        if "xl/sharedStrings.xml" in z.namelist():
            for si in ET.fromstring(z.read("xl/sharedStrings.xml")).findall("m:si", _NS):
                shared.append("".join(t.text or "" for t in si.iter(f"{{{_NS['m']}}}t")))
        sheet = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))
    rows: list[list[str]] = []
    for r in sheet.iter(f"{{{_NS['m']}}}row"):
        cells: dict[int, str] = {}
        for c in r.findall("m:c", _NS):
            ref = re.match(r"([A-Z]+)", c.get("r", "A"))
            col = 0
            for ch in ref.group(1) if ref else "A":
                col = col * 26 + (ord(ch) - 64)
            t = c.get("t")
            v = c.find("m:v", _NS)
            if t == "s" and v is not None:
                cells[col - 1] = shared[int(v.text or "0")]
            elif t == "inlineStr":
                cells[col - 1] = "".join(x.text or "" for x in c.iter(f"{{{_NS['m']}}}t"))
            else:
                cells[col - 1] = (v.text or "") if v is not None else ""
        width = max(cells) + 1 if cells else 0
        rows.append([cells.get(i, "") for i in range(width)])
    return rows


def ingest_trial_balance(store: Store, path: str | Path, client: str, period: str, currency: str,
                         columns: ColumnMap = ColumnMap(), actor: str = "system") -> IngestResult:
    path = Path(path)
    if not _PERIOD.fullmatch(period):
        raise IngestError(f"period must be YYYY-MM, got {period!r}")
    if not re.fullmatch(r"[A-Za-z0-9_-]+", client):
        raise IngestError("client id may contain letters, digits, '-' and '_' only")
    raw = path.read_bytes()
    sha = hashlib.sha256(raw).hexdigest()

    existing = store.conn.execute(
        "SELECT d.doc_id, e.outputs, d.evidence_id FROM source_document d JOIN evidence e ON e.evidence_id = d.evidence_id "
        "WHERE d.sha256 = ? AND d.period = ? AND d.kind = 'trial_balance'", (sha, period)).fetchone()
    if existing:
        return _result_from_outputs(existing[0], json.loads(existing[1]), created=False, evidence_id=existing[2])

    rows = read_rows(path)
    if not rows:
        raise IngestError("the file is empty")
    header = [h.strip() for h in rows[0]]
    needed = [columns.account_code, columns.account_name, columns.debit, columns.credit, *columns.dimensions.values()]
    missing = [c for c in needed if c not in header]
    if missing:
        raise IngestError(f"missing columns: {', '.join(missing)}")
    idx = {name: header.index(name) for name in needed}

    stored: list[dict] = []
    rejected: list[Rejected] = []
    seen: dict[tuple, int] = {}
    for offset, row in enumerate(rows[1:]):
        row_number = offset + 2   # line number in the file, header is line 1
        cell = lambda name: (row[idx[name]] if idx[name] < len(row) else "").strip()  # noqa: E731
        if not any(v.strip() for v in row):
            rejected.append(Rejected(row_number, "blank row"))
            continue
        code, name = cell(columns.account_code), cell(columns.account_name)
        if not code:
            rejected.append(Rejected(row_number, "missing account code"))
            continue
        if not re.fullmatch(r"[A-Za-z0-9._-]+", code):
            rejected.append(Rejected(row_number, f"account code {code!r} has characters other than letters, digits, '.', '-', '_'"))
            continue
        try:
            debit = parse_amount(cell(columns.debit), currency) if cell(columns.debit) else 0
            credit = parse_amount(cell(columns.credit), currency) if cell(columns.credit) else 0
        except AmountError as e:
            rejected.append(Rejected(row_number, f"amount: {e}"))
            continue
        if debit < 0 or credit < 0:
            rejected.append(Rejected(row_number, "negative amount in a debit or credit column"))
            continue
        if debit and credit:
            rejected.append(Rejected(row_number, "both debit and credit are filled"))
            continue
        dims: dict[str, str] = {}
        bad_dim = None
        for dim, col in columns.dimensions.items():
            v = cell(col)
            if v:
                if not member_exists(store, dim, v):
                    bad_dim = f"unknown {dim} member {v!r}"
                    break
                dims[dim] = v
        if bad_dim:
            rejected.append(Rejected(row_number, bad_dim))
            continue
        key = (code, tuple(sorted(dims.items())))
        if key in seen:
            rejected.append(Rejected(row_number, f"duplicate of row {seen[key]} (same account and dimensions)"))
            continue
        seen[key] = row_number
        stored.append({"row_number": row_number, "code": code, "name": name or code, "debit": debit,
                       "credit": credit, "dims": dims, "raw": json.dumps(row)})

    data_rows = len(rows) - 1
    assert len(stored) + len(rejected) == data_rows, "every row must be stored or rejected"
    total_debit = sum(r["debit"] for r in stored)
    total_credit = sum(r["credit"] for r in stored)

    with store.transaction() as cur:
        n = cur.execute("SELECT COUNT(*) FROM source_document").fetchone()[0] + 1
        doc_id = f"D{n:04d}"
        outputs = {"doc_id": doc_id, "data_rows": data_rows, "stored": len(stored),
                   "rejected": [{"row": r.row_number, "reason": r.reason} for r in rejected],
                   "total_debit": to_wire(total_debit), "total_credit": to_wire(total_credit),
                   "balanced": total_debit == total_credit}
        ev = write_evidence(cur, "ingest_trial_balance",
                            {"file": path.name, "client": client, "period": period, "currency": currency,
                             "columns": columns.__dict__},
                            outputs, [{"file": path.name, "sha256": sha}], actor)
        cur.execute("INSERT INTO source_document (doc_id, kind, filename, sha256, period, currency, uploaded_by, evidence_id) "
                    "VALUES (?,?,?,?,?,?,?,?)", (doc_id, "trial_balance", path.name, sha, period, currency, actor, ev.evidence_id))
        for r in stored:
            account_id = f"acct:{client}:{r['code']}"
            cur.execute("INSERT OR IGNORE INTO element (element_id, element_type, label, traits, provenance, evidence_id) "
                        "VALUES (?,?,?,?,?,?)",
                        (account_id, "account", r["name"], json.dumps({"client_code": r["code"]}),
                         json.dumps({"source": "client_tb", "doc_id": doc_id, "row": r["row_number"]}), ev.evidence_id))
            cur.execute("INSERT INTO tb_row (doc_id, row_number, account_id, account_code, account_name, debit_minor, "
                        "credit_minor, currency, period, dimensions, raw) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                        (doc_id, r["row_number"], account_id, r["code"], r["name"], r["debit"], r["credit"], currency,
                         period, json.dumps(r["dims"], sort_keys=True), r["raw"]))
    return _result_from_outputs(doc_id, outputs, created=True, evidence_id=ev.evidence_id)


def _result_from_outputs(doc_id: str, out: dict, created: bool, evidence_id: str | None = None) -> IngestResult:
    return IngestResult(doc_id, created, out["data_rows"], out["stored"],
                        [Rejected(r["row"], r["reason"]) for r in out["rejected"]],
                        int(out["total_debit"]), int(out["total_credit"]), out["balanced"], evidence_id or "")
