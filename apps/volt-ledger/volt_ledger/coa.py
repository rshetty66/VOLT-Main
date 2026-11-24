"""Chart-of-accounts design (the brain's primary output; approved 24 Nov 2026).

Four deterministic parts. The model proposes; this code decides whether a proposal is sound, and people approve it.
1. diagnose_coa: findings about the client's current chart from its ingested trial balance, mappings and gaps.
2. check_design: structure checks on a proposed target chart (ported from apps/volt-coa shared/coa.ts, extended with
   segments, concept anchoring and class checks).
3. check_mapping / recut: the old-to-new mapping, every trial-balance row placed exactly once, and the balances
   recut under the new chart, tied out against the old chart by total, by class and by concept.
4. coverage: which IFRS and US GAAP statement lines and v1 investor metrics a chart can produce.

Design JSON (what the model sends):
  {"name": str,
   "segments": [{"name": "NaturalAccount", "length": 5, "natural": true},
                {"name": "BusinessLine", "length": 3, "source_dimension": "BusinessLine"}, ...],
   "ranges": {"asset": ["1"], "liability": ["2"], ...}          (optional; first-digit prefixes per class)
   "accounts": [{"code": "10000", "name": "Assets", "class": "asset", "parent": ""},
                {"code": "10100", "name": "Cash at central banks", "class": "asset", "parent": "10000",
                 "concept_id": "canon:CashAndCentralBankBalances"}, ...],
   "decisions": [{"topic": str, "choice": str, "alternatives": [str], "rationale": str, "standard_refs": [str]}]}
A posting account is one that is no other account's parent. Every posting account names a canonical concept.

Mapping JSON: [{"legacy_code": "4300-RET", "when": {"BusinessLine": "Retail"}, "target": "41200",
                "segments": {"BusinessLine": "Retail"}}, ...]; target "RETIRE" for an account with no balance.
"""
from __future__ import annotations

import csv
import io
import json
import re
from collections import defaultdict
from typing import Any

from .evidence import write_evidence
from .mapping import _latest, _review, active_mapping, open_gaps
from .money import format_amount
from .reporting import STATEMENTS, load_metrics
from .store import Store

CLASSES = ("asset", "liability", "equity", "revenue", "expense")
DEFAULT_RANGES = {"asset": ["1"], "liability": ["2"], "equity": ["3"], "revenue": ["4"],
                  "expense": ["5", "6", "7", "8", "9"]}
RETIRE = "RETIRE"
ATTRIBUTION = {"canon:ProfitAttributableToShareholders", "canon:ProfitAttributableToNonControllingInterests"}
_TAIL = re.compile(r"(?:\s[-/]\s*|\()\s*([A-Za-z0-9 ]+?)\)?\s*$")


def dimension_in_name(name: str, members: set[str]) -> bool:
    """True when a name ends with a dimension value after a dash, slash or bracket ("Insurance commission - Retail")."""
    m = _TAIL.search(name)
    return bool(m and m.group(1).strip().lower() in members)


CATCH_ALL = re.compile(r"\b(sundry|suspense|misc(ellaneous)?|clearing|plug|unallocated|general)\b", re.I)


class CoaError(ValueError):
    def __init__(self, code: str, message: str, details: list | None = None) -> None:
        super().__init__(f"{code}: {message}")
        self.code = code
        self.details = details or []


def _check(cid: str, bad: list[str], ok: str, badtext: str, severity: str = "error") -> dict:
    return {"id": cid, "ok": not bad, "severity": severity, "detail": ok if not bad else f"{badtext}: {_list(bad)}",
            "items": bad}


def _list(xs: list[str], n: int = 8) -> str:
    return ", ".join(xs) if len(xs) <= n else f"{', '.join(xs[:n])} and {len(xs) - n} more"


# ---- concepts: class, descendants, presentation -----------------------------------------------------------------

class Concepts:
    def __init__(self, store: Store) -> None:
        self.info = {r[0]: {"label": r[1], "balance_type": r[2], "ifrs": r[3], "usgaap": r[4],
                            "statement": json.loads(r[5] or "{}").get("statement")}
                     for r in store.conn.execute("SELECT element_id, label, balance_type, xbrl_ifrs, xbrl_usgaap, traits "
                                                 "FROM element WHERE element_type = 'concept'")}
        self.parent: dict[str, str] = {}
        self.children: dict[str, list[str]] = defaultdict(list)
        for r in store.conn.execute("SELECT from_element, to_element FROM association WHERE association_type = 'calculation'"):
            self.parent[r[0]] = r[1]
            self.children[r[1]].append(r[0])
        self.presented: dict[str, set[str]] = defaultdict(set)   # gaap -> concepts on a statement
        roots = {v: k for k, v in STATEMENTS.items()}
        for r in store.conn.execute("SELECT from_element, to_element FROM association WHERE association_type = 'presentation'"):
            if r[0] in roots:
                self.presented[roots[r[0]][0]].add(r[1])

    def root(self, c: str) -> str:
        while c in self.parent:
            c = self.parent[c]
        return c

    def klass(self, c: str) -> str | None:
        """asset, liability, equity, revenue or expense; None for memo concepts outside the statements."""
        node = c
        while node in self.parent:
            if node in ("canon:TotalLiabilities", "canon:TotalEquity", "canon:TotalAssets"):
                break
            node = self.parent[node]
        if node == "canon:TotalAssets":
            return "asset"
        if node == "canon:TotalLiabilities":
            return "liability"
        if node == "canon:TotalEquity":
            return "equity"
        if c in self.presented["ifrs"] and c not in ("canon:TotalLiabilitiesAndEquity",):
            if self.root(c) in ("canon:ProfitAfterTax",) or c.startswith("canon:ProfitAttributable"):
                return "revenue" if self.info[c]["balance_type"] == "credit" else "expense"
        return None

    def reachable(self, concepts: set[str]) -> set[str]:
        """Concepts a chart can produce: those it posts to and every ancestor whose children it reaches."""
        out = set(concepts)
        changed = True
        while changed:
            changed = False
            for parent, kids in self.children.items():
                if parent not in out and any(k in out for k in kids):
                    out.add(parent)
                    changed = True
        return out


def coverage(store: Store, posting_concepts: set[str], segment_dimensions: set[str]) -> dict:
    """Which statement lines and v1 metrics a chart can produce from the concepts its posting accounts carry."""
    cs = Concepts(store)
    have = cs.reachable(posting_concepts)
    lines = {}
    for gaap in ("ifrs", "us-gaap"):
        # Profit attribution lines (owners, non-controlling interests) are computed at consolidation, not posted.
        on = sorted(c for c in cs.presented[gaap] if c not in ATTRIBUTION)
        missing = [c for c in on if c not in have]
        lines[gaap] = {"lines": len(on), "producible": len(on) - len(missing), "missing": missing,
                       "computed_at_consolidation": sorted(ATTRIBUTION & cs.presented[gaap])}
    metrics = []
    for m in load_metrics().values():
        needed = sorted(set(re.findall(r"canon:[A-Za-z]+", m["formula"])))
        miss = [c for c in needed if c not in have]
        dim = m.get("needs_dimension")
        dim_missing = [dim] if dim and dim not in segment_dimensions else []
        metrics.append({"metric_id": m["metric_id"], "label": m["label"], "producible": not miss and not dim_missing,
                        "missing_concepts": miss, "missing_segments": dim_missing})
    return {"statements": lines, "metrics": metrics,
            "metrics_producible": sum(1 for m in metrics if m["producible"]), "metrics_total": len(metrics)}


# ---- 1. diagnosis of the current chart --------------------------------------------------------------------------

def _norm_name(name: str, members: set[str]) -> str:
    words = [w for w in re.findall(r"[a-z0-9]+", name.lower()) if w not in members]
    return " ".join(words)


def diagnose_coa(store: Store, doc_id: str) -> dict:
    rows = store.conn.execute("SELECT account_id, account_code, account_name, debit_minor - credit_minor, dimensions, "
                              "currency FROM tb_row WHERE doc_id = ? ORDER BY row_number", (doc_id,)).fetchall()
    if not rows:
        raise CoaError("unknown_document", f"no trial balance rows for {doc_id}")
    cs = Concepts(store)
    currency = rows[0][5]
    accts: dict[str, dict] = {}
    dim_use: dict[str, int] = defaultdict(int)
    for acct, code, name, signed, dims, _ in rows:
        a = accts.setdefault(acct, {"code": code, "name": name, "balance": 0, "rows": 0, "dims": defaultdict(set)})
        a["balance"] += signed
        a["rows"] += 1
        for k, v in json.loads(dims).items():
            if v:
                a["dims"][k].add(v)
                dim_use[k] += 1
    dims_seen = sorted({k for r in rows for k in json.loads(r[4])})
    members = {m.lower() for r in store.conn.execute("SELECT label FROM element WHERE element_type = 'member'") for m in [r[0]]}
    members |= {v.lower() for a in accts.values() for vals in a["dims"].values() for v in vals}
    findings = []

    def finding(fid: str, severity: str, title: str, accounts: list[str], why: str, design_question: str) -> None:
        if accounts:
            findings.append({"id": fid, "severity": severity, "title": title, "accounts": accounts, "count": len(accounts),
                             "why_it_matters": why, "design_question": design_question})

    label = lambda a: f"{accts[a]['code']} {accts[a]['name']}"  # noqa: E731

    gap_types = {a: [json.loads(store.conn.execute("SELECT traits FROM element WHERE element_id = ?", (g,)).fetchone()[0])
                     .get("gap_type") for g in open_gaps(store, a)] for a in accts}
    finding("D_CATCH_ALL", "high", "Catch-all accounts",
            [label(a) for a in accts if CATCH_ALL.search(accts[a]["name"]) or "catch_all_account" in gap_types[a]],
            "Balances with no defined meaning cannot be mapped to a reporting line or explained to an auditor.",
            "Which specific natural accounts replace each catch-all, and what is the clearing rule for the rest?")
    code_suffix = re.compile(r"[^0-9]")
    finding("D_DIMENSION_IN_ACCOUNT", "high", "Dimensions built into account codes or names",
            [label(a) for a in accts if code_suffix.search(accts[a]["code"]) or "dimension_in_account" in gap_types[a]
             or dimension_in_name(accts[a]["name"], members)],
            "A business line or product in the account multiplies accounts and breaks consistent roll-ups.",
            "Move the dimension to its own segment and keep one natural account?")
    by_norm: dict[str, list[str]] = defaultdict(list)
    for a in accts:
        by_norm[_norm_name(accts[a]["name"], members)].append(a)
    finding("D_NEAR_DUPLICATE", "medium", "Accounts that differ only by a dimension word",
            [label(a) for group in by_norm.values() if len(group) > 1 for a in group],
            "The same economic item split across accounts.",
            "Merge into one natural account with a segment value?")
    wrong = []
    for a in accts:
        m = active_mapping(store, a)
        if m and accts[a]["balance"]:
            bt = cs.info.get(m["to_element"], {}).get("balance_type")
            if (bt == "debit" and accts[a]["balance"] < 0) or (bt == "credit" and accts[a]["balance"] > 0):
                wrong.append(label(a))
    finding("D_WRONG_SIGN", "medium", "Balances on the unexpected side for their mapped concept", wrong,
            "Netting or misposting inside one account hides gross amounts the statements need.",
            "Split gross and contra amounts into separate accounts?")
    finding("D_UNMAPPED", "high", "Accounts that do not reach any reporting line",
            [label(a) for a in accts if not active_mapping(store, a) and not open_gaps(store, a)],
            "An account with no reporting line drops out of the statements.",
            "Which canonical concept does each belong to?")
    range_bad = []
    for a in accts:
        m = active_mapping(store, a)
        k = cs.klass(m["to_element"]) if m else None
        if k and not any(accts[a]["code"].startswith(p) for p in DEFAULT_RANGES[k]):
            range_bad.append(f"{label(a)} ({k})")
    finding("D_CODE_RANGE", "low", "Codes outside the usual range for their class", range_bad,
            "Ranges by class let people and systems read an account from its code.",
            "Adopt fixed natural account ranges per class?")
    lengths = sorted({len(re.sub(r'[^0-9]', '', accts[a]['code'])) for a in accts})
    if len(lengths) > 1:
        finding("D_CODE_FORMAT", "low", "Mixed code formats", [f"{len(lengths)} lengths: {lengths}"],
                "Mixed formats make validation and range rules impossible.", "One fixed natural account length?")
    row_dims: dict[str, list[dict]] = defaultdict(list)
    for acct, _, _, _, dims, _ in rows:
        row_dims[acct].append(json.loads(dims))
    finding("D_DIMENSION_INCONSISTENT", "medium", "Accounts where a dimension is filled on some rows and blank on others",
            [f"{label(a)}: {k}" for a in accts for k in dims_seen
             if 0 < sum(1 for d in row_dims[a] if d.get(k)) < len(row_dims[a])],
            "A segment that is optional within one account cannot drive a complete management view.",
            "Make the segment mandatory, with a default value such as Unassigned?")
    pl_no_bl = []
    if "BusinessLine" in dims_seen:
        for a in accts:
            m = active_mapping(store, a)
            if m and cs.klass(m["to_element"]) in ("revenue", "expense") and not accts[a]["dims"].get("BusinessLine"):
                pl_no_bl.append(label(a))
    finding("D_PL_WITHOUT_BUSINESS_LINE", "medium", "Income and expense accounts with no business line on any row",
            pl_no_bl, "Business-line profitability then depends on allocation for these balances.",
            "Capture business line at posting, or define allocation rules (drivers) for each?")
    gaps = sorted({g for a in accts for g in gap_types[a] if g})
    finding("D_POLICY_GAPS", "high", "Open policy gaps that shape the design", gaps,
            "Each gap is a decision the target chart must encode (for example credit stage as a segment).",
            "Decide each gap before the target chart is fixed.")
    cov = coverage(store, {m["to_element"] for a in accts if (m := active_mapping(store, a))}, set(dims_seen))
    missing_lines = cov["statements"]["ifrs"]["missing"]
    finding("D_MISSING_DETAIL", "medium", "Statement lines the current chart cannot produce", missing_lines,
            "Lines with no account must be produced off-ledger, which breaks traceability.",
            "Add natural accounts for each line the client must report?")
    finding("D_METRICS_NOT_PRODUCIBLE", "low", "Investor and management metrics the current chart cannot produce",
            [f"{m['metric_id']} (needs {', '.join(m['missing_concepts'] + m['missing_segments'])})" for m in cov["metrics"]
             if not m["producible"]],
            "Each metric must be computable from the ledger, not rebuilt in spreadsheets.",
            "Which accounts or segments are needed for each metric?")
    order = {"high": 0, "medium": 1, "low": 2}
    findings.sort(key=lambda f: (order[f["severity"]], f["id"]))
    return {"doc_id": doc_id, "currency": currency,
            "stats": {"accounts": len(accts), "rows": len(rows), "dimensions": dims_seen,
                      "code_lengths": lengths, "mapped": sum(1 for a in accts if active_mapping(store, a)),
                      "with_gap": sum(1 for a in accts if open_gaps(store, a))},
            "findings": findings, "coverage": cov}


# ---- 2. target design checks (ported from apps/volt-coa shared/coa.ts) -------------------------------------------

def _accounts(design: dict) -> list[dict]:
    return [{"code": str(a.get("code", "")).strip(), "name": str(a.get("name", "")).strip(),
             "class": str(a.get("class", "")).strip(), "parent": str(a.get("parent") or "").strip(),
             "concept_id": a.get("concept_id")} for a in design.get("accounts", [])]


def posting_accounts(design: dict) -> list[dict]:
    accts = _accounts(design)
    parents = {a["parent"] for a in accts if a["parent"]}
    return [a for a in accts if a["code"] not in parents]


def check_design(store: Store, design: dict) -> list[dict]:
    cs = Concepts(store)
    accts = _accounts(design)
    segs = design.get("segments", [])
    ranges = design.get("ranges") or DEFAULT_RANGES
    by = {}
    dup = []
    for a in accts:
        (dup.append(a["code"]) if a["code"] in by else by.__setitem__(a["code"], a))
    natural = [s for s in segs if s.get("natural")]
    seg_names = [s.get("name", "") for s in segs]
    nat_len = natural[0].get("length") if len(natural) == 1 else None
    out = [
        _check("S_NATURAL_SEGMENT", [] if len(natural) == 1 else [f"{len(natural)} natural segments"],
               "Exactly one natural account segment", "There must be exactly one natural account segment"),
        _check("S_UNIQUE_SEGMENTS", sorted({n for n in seg_names if seg_names.count(n) > 1 or not n}),
               "Segment names are present and unique", "Segment names repeated or blank"),
        _check("S_SOURCE_DIMENSION", [f"{s['name']} -> {s['source_dimension']}" for s in segs if s.get("source_dimension")
                                      and not store.conn.execute("SELECT 1 FROM element WHERE element_id = ?",
                                                                 (f"dim:{s['source_dimension']}",)).fetchone()],
               "Every segment fed from a dimension names a known dimension", "Unknown source dimensions"),
        _check("C_UNIQUE_CODES", dup, "Every account code is unique", "Duplicate codes"),
        _check("C_CODE_LENGTH", [a["code"] for a in accts if nat_len and (len(a["code"]) != nat_len or not a["code"].isdigit())],
               "Every code has the natural segment's length and only digits", "Codes of the wrong length or format"),
        _check("C_CLASS", [f"{a['code']} ({a['class']})" for a in accts if a["class"] not in CLASSES],
               "Every account has a known class", "Unknown classes"),
        _check("C_TYPE_RANGE", [f"{a['code']} ({a['class']})" for a in accts if a["class"] in CLASSES
                                and not any(a["code"].startswith(p) for p in ranges.get(a["class"], []))],
               "Every account's class matches its code range", "Class disagrees with code range"),
        _check("C_PARENT_EXISTS", [f"{a['code']} -> {a['parent']}" for a in accts if a["parent"] and a["parent"] not in by],
               "Every parent exists", "Parent not found"),
    ]
    cyclic = []
    for a in accts:
        seen, cur = set(), a
        while cur and cur["parent"]:
            if cur["code"] in seen:
                cyclic.append(a["code"])
                break
            seen.add(cur["code"])
            cur = by.get(cur["parent"])
    out.append(_check("C_NO_CYCLES", cyclic, "No account is its own ancestor", "Cycle through"))
    out.append(_check("C_PARENT_TYPE", [f"{a['code']} ({a['class']}) under {a['parent']} ({by[a['parent']]['class']})"
                                        for a in accts if a["parent"] in by and by[a["parent"]]["class"] != a["class"]],
                      "Every child has the same class as its parent", "Child and parent classes differ"))
    naming, sib = [], set()
    for a in accts:
        if not a["name"]:
            naming.append(f"{a['code']} has a blank name")
            continue
        key = (a["parent"], a["name"].lower())
        if key in sib:
            naming.append(f"{a['code']} repeats \"{a['name']}\"")
        sib.add(key)
    out.append(_check("C_NAMING", naming, "Names are present and unique within each parent", "Naming problems"))
    post = posting_accounts(design)
    out.append(_check("C_POSTING_CONCEPT", [a["code"] for a in post if not a["concept_id"] or a["concept_id"] not in cs.info],
                      "Every posting account is anchored to a canonical concept", "Posting accounts with no known concept"))
    out.append(_check("C_CONCEPT_CLASS", [f"{a['code']} ({a['class']}) -> {a['concept_id']} ({cs.klass(a['concept_id'])})"
                                          for a in post if a["concept_id"] in cs.info and cs.klass(a["concept_id"])
                                          and cs.klass(a["concept_id"]) != a["class"]],
                      "Every posting account's class matches its concept", "Account class differs from its concept"))
    seg_members = {m.lower() for s in segs if s.get("source_dimension")
                   for m in [r[0] for r in store.conn.execute(
                       "SELECT e.label FROM association a JOIN element e ON e.element_id = a.to_element "
                       "WHERE a.association_type = 'dimension_member' AND a.from_element = ?", (f"dim:{s['source_dimension']}",))]}
    out.append(_check("C_NO_SEGMENT_IN_NAME", [f"{a['code']} {a['name']}" for a in post
                                               if dimension_in_name(a["name"], seg_members)],
                      "No posting account repeats a segment value in its name", "Segment values inside account names"))
    dec = design.get("decisions", [])
    out.append(_check("D_DECISIONS_COMPLETE", [str(i) for i, d in enumerate(dec) if not all(
        str(d.get(k, "")).strip() for k in ("topic", "choice", "rationale"))],
        "Every design decision states topic, choice and rationale", "Incomplete decisions (by index)"))
    return out


# ---- 3. old-to-new mapping and recut ----------------------------------------------------------------------------

def _rule_matches(rule: dict, code: str, dims: dict) -> bool:
    return rule.get("legacy_code") == code and all(dims.get(k) == v for k, v in (rule.get("when") or {}).items())


def recut(store: Store, design: dict, doc_id: str, rules: list[dict]) -> dict:
    """Place every trial-balance row under the new chart and tie the result out against the old chart."""
    cs = Concepts(store)
    rows = store.conn.execute("SELECT row_number, account_id, account_code, account_name, debit_minor - credit_minor, "
                              "dimensions, currency FROM tb_row WHERE doc_id = ? ORDER BY row_number", (doc_id,)).fetchall()
    if not rows:
        raise CoaError("unknown_document", f"no trial balance rows for {doc_id}")
    accts = {a["code"]: a for a in _accounts(design)}
    post = {a["code"] for a in posting_accounts(design)}
    segs = design.get("segments", [])
    legacy_codes = {r[2] for r in rows}
    unmatched, multi, retired_balance = [], [], []
    placed: dict[tuple, int] = defaultdict(int)
    old_concept, new_concept = defaultdict(int), defaultdict(int)
    old_class, new_class = defaultdict(int), defaultdict(int)
    for rn, acct, code, name, signed, dims_json, cur in rows:
        dims = json.loads(dims_json)
        hits = [r for r in rules if _rule_matches(r, code, dims)]
        if not hits:
            unmatched.append(f"row {rn} {code}")
            continue
        if len(hits) > 1:
            multi.append(f"row {rn} {code}")
            continue
        rule = hits[0]
        m = active_mapping(store, acct)
        oc = m["to_element"] if m else "(unmapped)"
        old_concept[oc] += signed
        old_class[cs.klass(oc) or "(unclassified)" if m else "(unmapped)"] += signed
        if rule.get("target") == RETIRE:
            if signed:
                retired_balance.append(f"row {rn} {code}")
            continue
        t = accts.get(rule.get("target"))
        if not t:
            continue
        segvals = tuple((s["name"], (rule.get("segments") or {}).get(s["name"]) or dims.get(s.get("source_dimension") or "", "")
                         or s.get("default", "")) for s in segs if not s.get("natural"))
        placed[(t["code"], segvals)] += signed
        new_concept[t["concept_id"] or "(none)"] += signed
        new_class[t["class"]] += signed
    checks = [
        _check("M_UNKNOWN_SOURCE", sorted({r.get("legacy_code", "") for r in rules if r.get("legacy_code") not in legacy_codes}),
               "Every rule names an account in the trial balance", "Rules for accounts not in the trial balance"),
        _check("M_ROW_COVERAGE", unmatched, "Every trial-balance row is placed", "Rows no rule places"),
        _check("M_ROW_UNIQUE", multi, "No row is placed by two rules", "Rows placed by more than one rule"),
        _check("M_TARGET_EXISTS", sorted({f"{r.get('legacy_code')} -> {r.get('target')}" for r in rules
                                          if r.get("target") != RETIRE and r.get("target") not in accts}),
               "Every target exists in the new chart", "Targets not in the new chart"),
        _check("M_POSTING_TARGET", sorted({f"{r.get('legacy_code')} -> {r.get('target')}" for r in rules
                                           if r.get("target") in accts and r.get("target") not in post}),
               "Every target is a posting account", "Targets that are roll-up parents"),
        _check("M_RETIRE_ZERO", retired_balance, "Only zero-balance rows are retired", "Retired rows that carry a balance"),
        _check("M_SEGMENT_NAMES", sorted({k for r in rules for k in (r.get("segments") or {})
                                          if k not in {s["name"] for s in segs}}),
               "Every segment value names a segment of the design", "Unknown segments in rules"),
    ]
    total_old = sum(r[4] for r in rows)
    total_new = sum(placed.values())
    ties = {
        "T_TOTAL": {"ok": total_old == total_new, "old": total_old, "new": total_new},
        "T_CLASS": {"ok": all(old_class.get(k, 0) == new_class.get(k, 0) for k in CLASSES)
                    and not any(old_class.get(k) for k in ("(unmapped)", "(unclassified)")),
                    "old": dict(old_class), "new": dict(new_class)},
    }
    reclass = sorted({c for c in set(old_concept) | set(new_concept) if old_concept.get(c, 0) != new_concept.get(c, 0)})
    ties["T_CONCEPT"] = {"ok": not reclass, "reclassified": [{"concept": c, "old": old_concept.get(c, 0),
                                                               "new": new_concept.get(c, 0)} for c in reclass]}
    lines = [{"account": k[0], "name": accts[k[0]]["name"], "segments": dict(k[1]), "signed": v}
             for k, v in sorted(placed.items())]
    currency = rows[0][6]
    return {"checks": checks, "tie_out": ties, "recut_lines": lines, "currency": currency,
            "ok": all(c["ok"] for c in checks) and ties["T_TOTAL"]["ok"]}


# ---- storing proposals, decisions and status ---------------------------------------------------------------------

def propose_design(store: Store, design: dict, actor: str, design_id: str | None = None) -> dict:
    checks = check_design(store, design)
    failed = [c for c in checks if not c["ok"]]
    if failed:
        raise CoaError("checks_failed", "the design fails structure checks; fix them and propose again",
                       [f"{c['id']}: {c['detail']}" for c in failed])
    post = posting_accounts(design)
    cov = coverage(store, {a["concept_id"] for a in post},
                   {s["source_dimension"] for s in design.get("segments", []) if s.get("source_dimension")})
    with store.transaction() as cur:
        if design_id:
            if not cur.execute("SELECT 1 FROM coa_design WHERE design_id = ?", (design_id,)).fetchone():
                raise CoaError("unknown_design", design_id)
            version = cur.execute("SELECT MAX(version) FROM coa_design WHERE design_id = ?", (design_id,)).fetchone()[0] + 1
        else:
            design_id = f"coa:{cur.execute('SELECT COUNT(DISTINCT design_id) FROM coa_design').fetchone()[0] + 1:04d}"
            version = 1
        ev = write_evidence(cur, "propose_coa_design", {"design_id": design_id, "version": version, "design": design},
                            {"checks": checks, "coverage": cov}, [{"design_id": design_id}], actor)
        item = _review(cur, "coa_design", f"{design_id}@{version}", "always_review", ev.evidence_id)
        decisions = []
        for i, d in enumerate(design.get("decisions", []), start=1):
            dev = write_evidence(cur, "coa_decision", {"design_id": design_id, "version": version, "decision": d},
                                 {"ref": f"{design_id}@{version}#D{i}"}, [{"design_id": design_id}], actor)
            decisions.append({"ref": f"{design_id}@{version}#D{i}", "topic": d["topic"],
                              "review_item_id": _review(cur, "coa_decision", f"{design_id}@{version}#D{i}", "always_review",
                                                        dev.evidence_id)})
        cur.execute("INSERT INTO coa_design (design_id, version, definition, proposed_by, review_item_id, evidence_id) "
                    "VALUES (?,?,?,?,?,?)", (design_id, version, json.dumps(design, sort_keys=True), actor, item, ev.evidence_id))
    return {"design_id": design_id, "version": version, "review_item_id": item, "evidence_id": ev.evidence_id,
            "decisions": decisions, "checks": checks, "coverage": cov, "accounts": len(_accounts(design)),
            "posting_accounts": len(post)}


def load_design(store: Store, design_id: str, version: int | None = None) -> tuple[dict, int, str]:
    q = "SELECT definition, version, review_item_id FROM coa_design WHERE design_id = ?"
    r = store.conn.execute(q + (" AND version = ?" if version else " ORDER BY version DESC LIMIT 1"),
                           (design_id, version) if version else (design_id,)).fetchone()
    if r is None:
        raise CoaError("unknown_design", design_id)
    return json.loads(r[0]), r[1], r[2]


def propose_mapping(store: Store, design_id: str, doc_id: str, rules: list[dict], actor: str) -> dict:
    design, version, _ = load_design(store, design_id)
    result = recut(store, design, doc_id, rules)
    failed = [c for c in result["checks"] if not c["ok"]]
    if failed or not result["tie_out"]["T_TOTAL"]["ok"]:
        raise CoaError("checks_failed", "the mapping fails its checks; fix them and propose again",
                       [f"{c['id']}: {c['detail']}" for c in failed] or ["T_TOTAL: totals differ"])
    summary = {k: v for k, v in result.items() if k != "recut_lines"} | {"recut_line_count": len(result["recut_lines"])}
    with store.transaction() as cur:
        mapping_id = f"{design_id}@{version}:M{cur.execute('SELECT COUNT(*) FROM coa_mapping').fetchone()[0] + 1:03d}"
        ev = write_evidence(cur, "propose_coa_mapping", {"design_id": design_id, "version": version, "doc_id": doc_id,
                                                         "rules": rules}, summary, [{"doc_id": doc_id}], actor)
        item = _review(cur, "coa_mapping", mapping_id, "always_review", ev.evidence_id)
        cur.execute("INSERT INTO coa_mapping (mapping_id, design_id, design_version, doc_id, definition, proposed_by, "
                    "review_item_id, evidence_id) VALUES (?,?,?,?,?,?,?,?)",
                    (mapping_id, design_id, version, doc_id, json.dumps(rules, sort_keys=True), actor, item, ev.evidence_id))
    return {"mapping_id": mapping_id, "review_item_id": item, "evidence_id": ev.evidence_id, **result}


def design_status(store: Store, design_id: str) -> dict:
    design, version, item = load_design(store, design_id)
    ref = f"{design_id}@{version}"
    state = lambda i: {"engagement_lead": _latest(store, i, "engagement_lead"), "client": _latest(store, i, "client")}  # noqa: E731
    decisions = [{"ref": r[1], "review_item_id": r[0], **state(r[0])} for r in store.conn.execute(
        "SELECT item_id, ref_id FROM review_item WHERE kind = 'coa_decision' AND ref_id LIKE ? ORDER BY item_id", (f"{ref}#%",))]
    for d, src in zip(decisions, design.get("decisions", [])):
        d.update({k: src.get(k) for k in ("topic", "choice", "alternatives", "rationale", "standard_refs")})
    mappings = [{"mapping_id": r[0], "doc_id": r[1], "review_item_id": r[2], **state(r[2])} for r in store.conn.execute(
        "SELECT mapping_id, doc_id, review_item_id FROM coa_mapping WHERE design_id = ? AND design_version = ? ORDER BY seq",
        (design_id, version))]
    approved = state(item)["engagement_lead"] == "approve" and all(d["engagement_lead"] == "approve" for d in decisions)
    return {"design_id": design_id, "version": version, "name": design.get("name", ""), "review_item_id": item,
            "design": state(item), "decisions": decisions, "mappings": mappings, "approved_by_lead": approved,
            "signed_off_by_client": approved and state(item)["client"] == "approve"
            and all(d["client"] == "approve" for d in decisions)}


# ---- exports --------------------------------------------------------------------------------------------------------

def _csv(header: list[str], rows: list[list[Any]]) -> str:
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\n")
    w.writerow(header)
    w.writerows(rows)
    return buf.getvalue()


def export(store: Store, design_id: str, what: str) -> str:
    """CSV downloads: chart, hierarchy, mapping (latest), decisions."""
    design, version, _ = load_design(store, design_id)
    cs = Concepts(store)
    accts = _accounts(design)
    by = {a["code"]: a for a in accts}
    post = {a["code"] for a in posting_accounts(design)}
    if what == "chart":
        return _csv(["code", "name", "class", "parent", "posting", "concept_id", "ifrs_xbrl", "us_gaap_xbrl"],
                    [[a["code"], a["name"], a["class"], a["parent"], "Y" if a["code"] in post else "N", a["concept_id"] or "",
                      cs.info.get(a["concept_id"] or "", {}).get("ifrs") or "",
                      cs.info.get(a["concept_id"] or "", {}).get("usgaap") or ""] for a in accts])
    if what == "hierarchy":
        rows = []
        for a in accts:
            if a["code"] not in post:
                continue
            path, cur = [], by.get(a["parent"])
            while cur:
                path.append(f"{cur['code']} {cur['name']}")
                cur = by.get(cur["parent"])
            line, c = "", a["concept_id"]
            while c and c not in cs.presented["ifrs"]:
                c = cs.parent.get(c)
            line = cs.info.get(c or "", {}).get("label", "")
            rows.append([a["code"], a["name"], " > ".join(reversed(path)), line, cs.klass(a["concept_id"] or "") or ""])
        return _csv(["code", "name", "management_rollup", "statement_line", "class"], rows)
    if what == "mapping":
        r = store.conn.execute("SELECT definition FROM coa_mapping WHERE design_id = ? AND design_version = ? "
                               "ORDER BY seq DESC LIMIT 1", (design_id, version)).fetchone()
        if r is None:
            raise CoaError("no_mapping", f"no mapping proposed for {design_id} version {version}")
        return _csv(["legacy_code", "when", "target", "target_name", "segments"],
                    [[x.get("legacy_code"), json.dumps(x.get("when") or {}, sort_keys=True), x.get("target"),
                      by.get(x.get("target"), {}).get("name", "") if x.get("target") != RETIRE else "",
                      json.dumps(x.get("segments") or {}, sort_keys=True)] for x in json.loads(r[0])])
    if what == "decisions":
        st = design_status(store, design_id)
        return _csv(["ref", "topic", "choice", "alternatives", "rationale", "standard_refs", "engagement_lead", "client"],
                    [[d["ref"], d.get("topic"), d.get("choice"), "; ".join(d.get("alternatives") or []), d.get("rationale"),
                      "; ".join(f"{s} [UNVERIFIED]" for s in d.get("standard_refs") or []), d["engagement_lead"] or "pending",
                      d["client"] or "pending"] for d in st["decisions"]])
    raise CoaError("bad_export", "export is chart, hierarchy, mapping or decisions")


def display_amount(n: int, currency: str) -> str:
    return f"{format_amount(n, currency)} {currency}"
