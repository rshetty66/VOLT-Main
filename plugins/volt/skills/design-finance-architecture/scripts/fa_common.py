"""Shared helpers for the offline finance-architecture validators (standard library only)."""
from __future__ import annotations

import decimal
import hashlib
import json
import re
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

METHODOLOGY_VERSION = "2.0.0"
SOFTWARE_VERSION = "volt-design-finance-architecture-validators/1.0.0"
MAX_DIGITS = 38
# Explicit local arithmetic: exact for every supported operand, independent of the caller's context.
EXACT = decimal.Context(
    prec=200, rounding=decimal.ROUND_HALF_EVEN,
    traps=[decimal.InvalidOperation, decimal.Inexact, decimal.Overflow, decimal.DivisionByZero],
)
UNSIGNED_RE = re.compile(r"^\d+(\.\d+)?$")
SIGNED_RE = re.compile(r"^-?\d+(\.\d+)?$")


def parse_decimal(value, signed: bool):
    """Return a Decimal for a fixed-point decimal string of at most 38 digits, else None."""
    if not isinstance(value, str) or not (SIGNED_RE if signed else UNSIGNED_RE).match(value):
        return None
    if sum(ch.isdigit() for ch in value) > MAX_DIGITS:
        return None
    return decimal.Decimal(value)


def nonblank(value) -> bool:
    return isinstance(value, str) and bool(value.strip())


class Report:
    """Collects check outcomes and renders a result.schema.json-shaped document."""

    def __init__(self, doc, check_scopes: dict, not_run: dict):
        self.started = _now()
        self.doc = doc
        self.scopes = check_scopes
        self.not_run = not_run
        self.status: dict = {}
        self.blockers: list = []

    def fail(self, check_id: str, message: str):
        self.status[check_id] = "FAIL"
        self.blockers.append(f"{check_id}: {message}")

    def done(self, check_id: str):
        self.status.setdefault(check_id, "PASS")

    def skip(self, check_id: str, reason: str):
        self.status.setdefault(check_id, "NOT_RUN")
        self.not_run.setdefault(check_id, reason)

    def render(self, limitations: list) -> dict:
        checks = []
        for cid, scope in self.scopes.items():
            checks.append({"check_id": cid, "status": self.status.get(cid, "NOT_RUN"), "scope": scope, "evidence_ref": None})
        for cid, reason in self.not_run.items():
            if cid not in self.scopes:
                checks.append({"check_id": cid, "status": "NOT_RUN", "scope": reason, "evidence_ref": None})
        any_fail = any(c["status"] == "FAIL" for c in checks)
        tenant = self.doc.get("tenant_id") if isinstance(self.doc, dict) else None
        return {
            "schema_version": METHODOLOGY_VERSION,
            "tenant_id": tenant if nonblank(tenant) else "UNKNOWN",
            "run_id": str(uuid.uuid4()),
            "status": "BLOCKED" if any_fail else "VALIDATED_SCOPED",
            "methodology_version": METHODOLOGY_VERSION,
            "started_at": self.started,
            "finished_at": _now(),
            "input_manifest_hash": hashlib.sha256(
                json.dumps(self.doc, sort_keys=True, separators=(",", ":"), default=str).encode("utf-8")
            ).hexdigest(),
            "versions": {"policy": "not-supplied", "rules": "as-supplied-in-document", "model": "none-deterministic",
                         "prompt": "none", "software": SOFTWARE_VERSION},
            "artifacts": [],
            "checks": checks,
            "blockers": self.blockers,
            "limitations": limitations,
            "approval_evidence_refs": [],
        }


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def cli(validate, argv=None) -> int:
    argv = sys.argv[1:] if argv is None else argv
    if len(argv) != 1:
        print(f"usage: python3 -I {Path(sys.argv[0]).name} FILE.json", file=sys.stderr)
        return 2
    try:
        doc = json.loads(Path(argv[0]).read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        print(json.dumps({"error": "INPUT_INVALID", "detail": str(exc)}))
        return 2
    report = validate(doc)
    print(json.dumps(report, indent=2))
    return 1 if report["status"] == "BLOCKED" else 0
