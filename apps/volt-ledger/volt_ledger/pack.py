"""Industry knowledge packs: the "pre-trained" content the brain works from (CFO brain plan, section 5).

A pack is versioned files plus a manifest of their SHA-256 hashes, so a pack version cannot change silently. The
financial services bank pack v1 (`packs/fs-bank/v1`) holds the reference chart, the ontology, the information model
schema, the map rules, the data requirements catalogue and the exam. Two things are built from it here:

- the finance data requirements register: for every posting account of a chart, the source attributes it needs,
  why, and the data quality rule (worked backwards from report line to source attribute);
- the exam: scores the brain on the pack's test bank (mapping, policy gaps, tie-out, design) against answer keys
  written by people.
"""
from __future__ import annotations

import csv
import hashlib
import io
import json
from pathlib import Path

from .coa import CoaError, check_design, load_design
from .mapping import active_mapping, open_gaps
from .store import Store

APP = Path(__file__).resolve().parent.parent
PACKS = APP / "packs"


class PackError(ValueError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(f"{code}: {message}")
        self.code = code


def _sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_pack(pack_id: str = "fs-bank", version: str = "1") -> dict:
    """Read a pack's manifest and check every file against its recorded hash."""
    root = PACKS / pack_id / f"v{version}"
    manifest_path = root / "pack.json"
    if not manifest_path.exists():
        raise PackError("unknown_pack", f"{pack_id} v{version} not found")
    manifest = json.loads(manifest_path.read_text())
    changed = [k for k, f in manifest["files"].items() if _sha(APP / f["path"]) != f["sha256"]]
    if changed:
        raise PackError("pack_changed", f"files changed since the pack was sealed: {', '.join(changed)}")
    files = {k: APP / f["path"] for k, f in manifest["files"].items()}
    return {"id": manifest["id"], "version": manifest["version"], "title": manifest["title"],
            "industry": manifest["industry"], "manifest": manifest, "files": files,
            "reference_chart": json.loads(files["reference_chart"].read_text())["design"],
            "map_rules": json.loads(files["map_rules"].read_text())["rules"],
            "attributes": json.loads(files["attributes"].read_text()),
            "exam": json.loads(files["exam"].read_text())}


def pack_info(pack: dict) -> dict:
    m = pack["manifest"]
    return {"id": pack["id"], "version": pack["version"], "title": pack["title"], "industry": pack["industry"],
            "contents": [{"item": k, "what": f["what"], "path": f["path"]} for k, f in m["files"].items()],
            "reference_chart_accounts": len(pack["reference_chart"]["accounts"]), "map_rules": len(pack["map_rules"])}


# ---- data requirements register -----------------------------------------------------------------------------------

def _labels(store: Store) -> dict[str, str]:
    return {r[0]: r[1] for r in store.conn.execute("SELECT element_id, label FROM element WHERE element_type = 'concept'")}


def data_requirements(store: Store, pack: dict, design: dict | None = None) -> dict:
    """The register for a chart (the pack's reference chart unless a design is given)."""
    chart = design or pack["reference_chart"]
    accounts = chart["accounts"]
    parents = {a.get("parent") for a in accounts if a.get("parent")}
    posting = [a for a in accounts if a["code"] not in parents]
    attrs = pack["attributes"]
    rules: dict[str, list[dict]] = {}
    for r in pack["map_rules"]:
        rules.setdefault(r["account"], []).append(r)
    labels = _labels(store)
    rows = []

    def add(a, backing, item, products=""):
        rows.append({"account": a["code"], "account_name": a["name"], "concept_id": a.get("concept_id") or "",
                     "concept": labels.get(a.get("concept_id") or "", ""), "backing": backing, "products": products,
                     "attribute": item["attribute"], "why": item["why"], "dq_rule": item["dq_rule"]})

    for a in posting:
        for item in attrs["every_account"]:
            add(a, "all", item)
        acct_rules = rules.get(a["code"], [])
        types = sorted({r["balance_type"] for r in acct_rules})
        products = ", ".join(sorted({r["product"] for r in acct_rules}))
        if "IFRS17_LRC_LIC" in types:
            for item in attrs["ifrs17_group"]:
                add(a, "ifrs17_group", item, products)
        elif types:
            for item in attrs["instrument"]["common"]:
                add(a, "instrument", item, products)
            for bt in types:
                for item in attrs["instrument"][bt]:
                    add(a, f"instrument:{bt}", item, products)
        elif a.get("concept_id") in attrs["event_driven_concepts"]:
            for item in attrs["event"]:
                add(a, "event", item)
        else:
            for item in attrs["gl"]:
                add(a, "gl", item)
    by_backing: dict[str, int] = {}
    for a in posting:
        b = next((r["backing"].split(":")[0] for r in rows if r["account"] == a["code"] and r["backing"] != "all"), "gl")
        by_backing[b] = by_backing.get(b, 0) + 1
    return {"chart": chart.get("name", "reference chart"), "pack": f"{pack['id']} v{pack['version']}",
            "posting_accounts": len(posting), "accounts_by_backing": by_backing, "requirements": len(rows),
            "rows": rows}


def register_csv(register: dict) -> str:
    out = io.StringIO()
    cols = ["account", "account_name", "concept_id", "concept", "backing", "products", "attribute", "why", "dq_rule"]
    w = csv.DictWriter(out, fieldnames=cols, lineterminator="\n")
    w.writeheader()
    for r in register["rows"]:
        w.writerow(r)
    return out.getvalue()


# ---- exam ---------------------------------------------------------------------------------------------------------

def _section(sid: str, title: str, pass_pct: int, correct: int, total: int, misses: list[str]) -> dict:
    score = round(100 * correct / total, 1) if total else 0.0
    return {"id": sid, "title": title, "status": "pass" if total and score >= pass_pct else "fail",
            "score_pct": score, "pass_pct": pass_pct, "correct": correct, "total": total, "misses": misses[:25]}


def run_exam(store: Store, pack: dict, doc_id: str | None = None, design_id: str | None = None) -> dict:
    """Score what is in the ledger now against the pack's answer keys. Sections without their input are skipped."""
    from . import fim
    exam = pack["exam"]
    client = exam["test_bank"]["client"]
    out = []
    for sec in exam["sections"]:
        sid, title, bar = sec["id"], sec["title"], sec["pass_pct"]
        if sid in ("mapping", "gaps"):
            if not doc_id:
                out.append({"id": sid, "title": title, "status": "skipped", "reason": "no trial balance (doc_id) given"})
                continue
            key = json.loads((APP / sec["answer_key"]).read_text())
            in_doc = {r[0] for r in store.conn.execute("SELECT DISTINCT account_id FROM tb_row WHERE doc_id = ?", (doc_id,))}
            expected = key["mappings"] if sid == "mapping" else key["gaps"]
            ok, misses = 0, []
            for code, want in sorted(expected.items()):
                acct = f"acct:{client}:{code}"
                if acct not in in_doc:
                    misses.append(f"{code}: not in the trial balance")
                    continue
                if sid == "mapping":
                    m = active_mapping(store, acct)
                    got = m["to_element"] if m else None
                    if got == want:
                        ok += 1
                    else:
                        misses.append(f"{code}: mapped to {got or 'nothing'}, expected {want}")
                elif open_gaps(store, acct):
                    ok += 1
                else:
                    misses.append(f"{code}: no policy gap flagged (expected {want})")
            out.append(_section(sid, title, bar, ok, len(expected), misses))
        elif sid == "tie_out":
            if fim.dataset(store) is None:
                out.append({"id": sid, "title": title, "status": "skipped", "reason": "information model not loaded"})
                continue
            rec = fim.reconcile(store)
            misses = [f"{b['account']} {b['filters']}: untraced {b['untraced_minor']}" for b in rec["breaks"]]
            out.append(_section(sid, title, bar, rec["ties"], rec["balances_checked"], misses))
        elif sid == "design":
            if not design_id:
                out.append({"id": sid, "title": title, "status": "skipped", "reason": "no design (design_id) given"})
                continue
            try:
                design, _, _ = load_design(store, design_id)
            except CoaError as e:
                out.append({"id": sid, "title": title, "status": "skipped", "reason": str(e)})
                continue
            checks = check_design(store, design)
            failed = [c["id"] for c in checks if not c["ok"]]
            ref = {a["concept_id"] for a in pack["reference_chart"]["accounts"] if a.get("concept_id")}
            have = {a.get("concept_id") for a in design.get("accounts", [])}
            missing = sorted(ref - have)
            misses = [f"check {c} fails" for c in failed] + [f"concept {c} not on any account" for c in missing]
            total = len(checks) + len(ref)
            out.append(_section(sid, title, bar, total - len(failed) - len(missing), total, misses))
    scored = [s for s in out if s["status"] != "skipped"]
    overall = "pass" if scored and all(s["status"] == "pass" for s in scored) else "fail" if scored else "not_run"
    return {"pack": f"{pack['id']} v{pack['version']}", "overall": overall, "sections": out}


def seal(pack_id: str, version: str) -> Path:
    """Record each file's hash in the manifest. Run after a reviewed change: python -m volt_ledger.pack fs-bank 1"""
    path = PACKS / pack_id / f"v{version}" / "pack.json"
    manifest = json.loads(path.read_text())
    for f in manifest["files"].values():
        f["sha256"] = _sha(APP / f["path"])
    path.write_text(json.dumps(manifest, indent=2) + "\n")
    return path


if __name__ == "__main__":   # pragma: no cover
    import sys
    print(seal(sys.argv[1], sys.argv[2]))
