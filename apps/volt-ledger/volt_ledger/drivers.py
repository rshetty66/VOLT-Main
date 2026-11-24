"""Driver values: non-GL inputs such as FTEs, transaction counts, RWA or share counts (spec.md 3.5).

A driver value is entered by a person or read from an uploaded file, never estimated by the model. Values are
append-only: a later value for the same key, period and dimensions supersedes the earlier one, and both stay.
"""
from __future__ import annotations

import json
import re
from decimal import Decimal, InvalidOperation
from typing import Mapping

from .evidence import write_evidence
from .store import Store

KINDS = ("plan", "driver", "reg", "market")
_PERIOD = re.compile(r"[0-9]{4}-(0[1-9]|1[0-2])")


class DriverError(ValueError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(f"{code}: {message}")
        self.code = code


def _dims(dimensions: Mapping[str, str]) -> str:
    return json.dumps(dict(sorted(dimensions.items())), sort_keys=True)


def record_driver_value(store: Store, kind: str, key: str, period: str, dimensions: Mapping[str, str], value: str,
                        unit: str, source: dict, actor: str) -> tuple[str, str]:
    """Store one driver value; returns (value_id, evidence_id). Only people or uploads may enter values."""
    if actor == "model" or not (actor.startswith("user:") or actor.startswith("upload:")):
        raise DriverError("not_a_person", "driver values are entered by people or read from uploaded files")
    if kind not in KINDS:
        raise DriverError("bad_kind", f"kind must be one of {', '.join(KINDS)}")
    if not re.fullmatch(r"[a-z][a-z0-9_]*", key):
        raise DriverError("bad_key", "key is lower_snake_case, e.g. fte")
    if not _PERIOD.fullmatch(period):
        raise DriverError("bad_period", "period is YYYY-MM")
    if not isinstance(value, str):
        raise DriverError("bad_value", "value is a decimal string, never a float")
    try:
        d = Decimal(value)
    except InvalidOperation:
        raise DriverError("bad_value", f"{value!r} is not a decimal number") from None
    if not d.is_finite():
        raise DriverError("bad_value", "value must be finite")
    for dim, member in dimensions.items():
        if store.conn.execute("SELECT 1 FROM element WHERE element_id = ? AND element_type = 'member'",
                              (f"mem:{dim}:{member}",)).fetchone() is None:
            raise DriverError("unknown_member", f"unknown {dim} member {member!r}")
    with store.transaction() as cur:
        value_id = f"V{cur.execute('SELECT COUNT(*) FROM driver_value').fetchone()[0] + 1:06d}"
        ev = write_evidence(cur, "record_driver_value",
                            {"kind": kind, "key": key, "period": period, "dimensions": dict(dimensions),
                             "value": value, "unit": unit},
                            {"value_id": value_id}, [source], actor)
        cur.execute("INSERT INTO driver_value (value_id, kind, key, period, dimensions, value, unit, source, entered_by, "
                    "evidence_id) VALUES (?,?,?,?,?,?,?,?,?,?)",
                    (value_id, kind, key, period, _dims(dimensions), value, unit, json.dumps(source, sort_keys=True),
                     actor, ev.evidence_id))
    return value_id, ev.evidence_id


def latest_driver(store: Store, key: str, period: str, dimensions: Mapping[str, str]) -> dict | None:
    """The latest value for key, period and exact dimensions, with its evidence id, or None."""
    r = store.conn.execute("SELECT value_id, value, unit, evidence_id FROM driver_value WHERE key = ? AND period = ? "
                           "AND dimensions = ? ORDER BY seq DESC LIMIT 1", (key, period, _dims(dimensions))).fetchone()
    return {"value_id": r[0], "value": Decimal(r[1]), "unit": r[2], "evidence_id": r[3]} if r else None
