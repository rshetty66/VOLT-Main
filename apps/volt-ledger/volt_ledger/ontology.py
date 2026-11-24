"""Ontology loader and graph queries (Phase 2): elements and associations in the SQLite store."""
from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path

from .evidence import write_evidence
from .store import Store

DEFAULT_ONTOLOGY = Path(__file__).resolve().parent.parent / "data" / "ontology" / "mvg-bank-v1.json"
GAAPS = ("ifrs", "us-gaap")


class OntologyError(ValueError):
    pass


@dataclass(frozen=True)
class LoadResult:
    version: str
    created: bool
    elements: int
    associations: int
    evidence_id: str | None


def load_ontology(store: Store, path: Path = DEFAULT_ONTOLOGY, actor: str = "system") -> LoadResult:
    """Load the minimum viable graph. Loading the same file twice is a no-op; a different file with the same
    version is refused, because stored elements are never changed."""
    raw = Path(path).read_bytes()
    sha = hashlib.sha256(raw).hexdigest()
    doc = json.loads(raw)
    version = doc["version"]
    for r in store.conn.execute("SELECT outputs FROM evidence WHERE tool = 'load_ontology'"):
        out = json.loads(r[0])
        if out["version"] == version:
            if out["sha256"] != sha:
                raise OntologyError(f"ontology {version} is already loaded with different content")
            return LoadResult(version, False, out["elements"], out["associations"], None)

    elements: list[tuple] = []
    assocs: list[tuple] = []
    prov = json.dumps({"source": f"volt-ledger {version}", "added_by": "loader"})

    def el(eid, etype, label, ifrs=None, us=None, bal=None, ptype=None, traits=None):
        elements.append((eid, etype, label, ifrs, us, bal, ptype, json.dumps(traits or {}, sort_keys=True), prov))

    def arc(src, dst, atype, gaap=None, weight=None, order=None):
        assocs.append((f"{atype}:{gaap or '-'}:{src}->{dst}", src, dst, atype, gaap, weight, order))

    for gaap, roots in doc["statements"].items():
        for kind, root in roots.items():
            el(root, "line_item", f"{gaap} {'balance sheet' if kind == 'BS' else 'income statement'}",
               traits={"statement": kind, "gaap": gaap})
    for c in doc["concepts"]:
        traits = {"monetary": True, "xbrl_verified": False}
        if not c["xbrl"]["ifrs"] and not c["xbrl"]["us-gaap"]:
            traits["no_standard_term"] = True
        el(c["id"], "concept", c["label"], c["xbrl"]["ifrs"], c["xbrl"]["us-gaap"], c["balance_type"],
           c["period_type"], traits)
    for c in doc["concepts"]:
        if c["calc_parent"]:
            arc(c["id"], c["calc_parent"], "calculation", weight="1")
        if c["statement"]:
            for gaap in GAAPS:
                arc(doc["statements"][gaap][c["statement"]], c["id"], "presentation", gaap=gaap, order=c["order"])
    for dim, members in doc["dimensions"].items():
        el(f"dim:{dim}", "dimension", dim)
        for i, m in enumerate(members):
            el(f"mem:{dim}:{m}", "member", m)
            arc(f"dim:{dim}", f"mem:{dim}:{m}", "dimension_member", order=(i + 1) * 10)

    ids = {e[0] for e in elements}
    for a in assocs:
        if a[1] not in ids or a[2] not in ids:
            raise OntologyError(f"arc {a[0]} points at an unknown element")
    _check_no_cycles(assocs)

    with store.transaction() as cur:
        ev = write_evidence(cur, "load_ontology", {"path": Path(path).name},
                            {"version": version, "sha256": sha, "elements": len(elements), "associations": len(assocs)},
                            [{"file": Path(path).name, "sha256": sha}], actor)
        cur.executemany("INSERT INTO element (element_id, element_type, label, xbrl_ifrs, xbrl_usgaap, balance_type, "
                        "period_type, traits, provenance, evidence_id) VALUES (?,?,?,?,?,?,?,?,?,?)",
                        [e + (ev.evidence_id,) for e in elements])
        cur.executemany("INSERT INTO association (association_id, from_element, to_element, association_type, gaap, "
                        "weight, ord, evidence_id) VALUES (?,?,?,?,?,?,?,?)",
                        [a + (ev.evidence_id,) for a in assocs])
    return LoadResult(version, True, len(elements), len(assocs), ev.evidence_id)


def _check_no_cycles(assocs: list[tuple]) -> None:
    parent = {a[1]: a[2] for a in assocs if a[3] == "calculation"}
    for start in parent:
        seen, node = set(), start
        while node in parent:
            if node in seen:
                raise OntologyError(f"calculation cycle through {node}")
            seen.add(node)
            node = parent[node]


def get_element(store: Store, element_id: str) -> dict | None:
    r = store.conn.execute("SELECT * FROM element WHERE element_id = ?", (element_id,)).fetchone()
    return dict(r) if r else None


def presentation_children(store: Store, parent_id: str, gaap: str) -> list[dict]:
    """Ordered presentation children of an element under one GAAP."""
    rows = store.conn.execute(
        "SELECT e.element_id, e.label, e.balance_type, a.ord FROM association a JOIN element e ON e.element_id = a.to_element "
        "WHERE a.association_type = 'presentation' AND a.from_element = ? AND a.gaap = ? ORDER BY a.ord, e.element_id",
        (parent_id, gaap)).fetchall()
    return [dict(r) for r in rows]


def calculation_children(store: Store, concept_id: str) -> list[dict]:
    rows = store.conn.execute(
        "SELECT a.from_element AS element_id, e.label, a.weight FROM association a JOIN element e ON e.element_id = a.from_element "
        "WHERE a.association_type = 'calculation' AND a.to_element = ? ORDER BY a.from_element", (concept_id,)).fetchall()
    return [dict(r) for r in rows]


def dimension_members(store: Store, dimension: str) -> list[str]:
    rows = store.conn.execute(
        "SELECT e.label FROM association a JOIN element e ON e.element_id = a.to_element "
        "WHERE a.association_type = 'dimension_member' AND a.from_element = ? ORDER BY a.ord", (f"dim:{dimension}",))
    return [r[0] for r in rows]


def member_exists(store: Store, dimension: str, member: str) -> bool:
    return store.conn.execute("SELECT 1 FROM element WHERE element_id = ? AND element_type = 'member'",
                              (f"mem:{dimension}:{member}",)).fetchone() is not None
