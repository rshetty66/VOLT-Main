"""Peer results search (peer-results-search-spec.md; Phase 6 step 7).

Three deterministic steps the model can call:
1. resolve_peer_period: which fiscal period is "latest" for each peer, from the registry calendar only.
2. fetch_peer_documents: download each peer's official PDFs concurrently from registered domains, store them by hash.
3. peer_metrics: read the supplementary pack's tables with code and return reported figures that tie to printed totals,
   plus figures computed from them. The model never types a peer number.

Assumptions (P-numbers, so they do not clash with the brain's A-numbers):
P2 release lags in the registry are estimates, used only to pick the "latest" period.
P3 the registry is JSON, not YAML.
P4 all registered peers report in Canadian dollars.
P5 a reported figure is accepted only where net interest income + non-interest income = total revenue on the same
   page, for the requested quarter's column and the next two columns; otherwise it is returned as not verified.
P6 the requested quarter's column is found from the page header (Q3, Q3/26 or the period-end month); never assumed.
"""
from __future__ import annotations

import asyncio
import calendar
import hashlib
import json
import re
import shutil
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from decimal import ROUND_HALF_EVEN, Decimal
from pathlib import Path
from typing import Any, Callable
from urllib.parse import urlparse

from .evidence import write_evidence
from .store import Store

PEERS_FILE = Path(__file__).resolve().parent.parent / "data" / "peers" / "peers.json"
MAX_CONCURRENT = 8
MAX_PER_DOMAIN = 2
TIMEOUT_S = 30
CONNECT_TIMEOUT_S = 10
RETRIES = 2
RETRY_STATUS = {403, 408, 425, 429, 500, 502, 503, 504}
USER_AGENT = "Mozilla/5.0 (compatible; VOLT-Ledger/0.1; peer results research; +mailto:{mailbox})"
HEADERS = {"Accept": "application/pdf,application/octet-stream;q=0.9,*/*;q=0.8", "Accept-Language": "en-CA,en;q=0.9"}
_PERIOD = re.compile(r"FY(\d{4})(?:-(Q[1-4]|H[12]))?")


class PeerError(ValueError):
    def __init__(self, code: str, message: str, details: list | None = None) -> None:
        super().__init__(f"{code}: {message}")
        self.code = code
        self.details = details or []


# ---- registry and calendars -------------------------------------------------------------------------------------

@dataclass(frozen=True)
class Registry:
    peers: dict[str, dict]
    groups: dict[str, list[str]]
    secondary_domains: list[str]

    def expand(self, ids: list[str]) -> list[str]:
        out: list[str] = []
        for i in ids:
            members = self.groups.get(i, [i])
            for m in members:
                if m not in self.peers:
                    raise PeerError("unknown_peer", f"{m} is not a registered peer or group",
                                    sorted(self.peers) + sorted(self.groups))
                if m not in out:
                    out.append(m)
        return out


def load_registry(path: Path = PEERS_FILE) -> Registry:
    doc = json.loads(Path(path).read_text())
    return Registry({p["peer_id"]: p for p in doc["peers"]}, doc["groups"], doc["secondary_domains"])


def _month_end(year: int, month: int) -> date:
    return date(year, month, calendar.monthrange(year, month)[1])


def _minus_months(d: date, months: int) -> date:
    m = d.year * 12 + (d.month - 1) - months
    return _month_end(m // 12, m % 12 + 1)


def period_end(peer: dict, period: str) -> date:
    m = _PERIOD.fullmatch(period)
    if not m:
        raise PeerError("bad_period", "period is FY2026-Q3, FY2026-H1 or FY2026")
    fy, part = int(m.group(1)), m.group(2)
    month, day = (int(x) for x in peer["fiscal_year_end"].split("-"))
    year_end = date(fy, month, day)
    cadence = peer["cadence"]
    if part is None:
        return year_end
    if part.startswith("Q") and cadence != "quarterly":
        raise PeerError("bad_period", f"{peer['peer_id']} reports {cadence}, not quarterly")
    if part.startswith("H") and cadence == "annual":
        raise PeerError("bad_period", f"{peer['peer_id']} reports annually")
    back = (4 - int(part[1])) * 3 if part.startswith("Q") else (2 - int(part[1])) * 6
    return _minus_months(year_end, back)


def _periods_back(peer: dict, start_fy: int, years: int = 3) -> list[str]:
    parts = {"quarterly": ["Q4", "Q3", "Q2", "Q1"], "semiannual": ["H2", "H1"], "annual": [None]}[peer["cadence"]]
    out = []
    for fy in range(start_fy, start_fy - years, -1):
        for p in parts:
            out.append(f"FY{fy}" if p is None else f"FY{fy}-{p}")
    return out


def resolve_peer_period(registry: Registry, peer_ids: list[str], as_of: date, period: str | None = None) -> list[dict]:
    """Per peer: the fiscal period, its end, the expected release date and whether it should be out by as_of.
    'latest' (period None) is the most recent period whose expected release date has passed, or a later period
    the registry already holds documents for. A named period not yet due is 'not_yet_released', never swapped
    for the prior one (spec section 8 item 7)."""
    out = []
    for pid in registry.expand(peer_ids):
        peer = registry.peers[pid]
        lag = timedelta(days=peer["release_lag_days"])
        known = {d["period"] for d in peer["known_documents"]}
        if period:
            p = period
            end = period_end(peer, p)
            status = "available" if (end + lag <= as_of or p in known) else "not_yet_released"
        else:
            candidates = [c for c in _periods_back(peer, as_of.year + 1) if period_end(peer, c) <= as_of]
            p = next(c for c in candidates if period_end(peer, c) + lag <= as_of or c in known)
            end = period_end(peer, p)
            status = "available"
        out.append({"peer_id": pid, "name": peer["name"], "segment": peer["segment"], "period": p,
                    "period_end": end.isoformat(), "expected_release": (end + lag).isoformat(), "status": status,
                    "cadence": peer["cadence"], "documents_known": sorted(d["doc_type"] for d in peer["known_documents"]
                                                                          if d["period"] == p)})
    return out


def document_url(peer: dict, period: str, doc_type: str) -> tuple[str, str] | None:
    """(url, source_tier) for a document: a known URL first, then the registry template."""
    for d in peer["known_documents"]:
        if d["period"] == period and d["doc_type"] == doc_type:
            return d["url"], d["source_tier"]
    t = peer["templates"].get(doc_type)
    m = _PERIOD.fullmatch(period)
    if not t or not m or not (m.group(2) or "").startswith("Q"):
        return None
    fy = m.group(1)
    return t.format(fy=fy, yy=fy[2:], q=m.group(2)[1]), "primary"


def allowed(registry: Registry, peer: dict, url: str) -> str | None:
    """The source tier a URL may carry for this peer, or None when its domain is not registered."""
    u = urlparse(url)
    if u.scheme != "https" and u.hostname not in ("127.0.0.1", "localhost"):
        return None
    if u.hostname in peer["ir_domains"]:
        return "primary"
    if u.hostname in registry.secondary_domains:
        return "secondary"
    return None


# ---- fetching ---------------------------------------------------------------------------------------------------

def _files_dir(store: Store, files_dir: str | Path | None) -> Path:
    if files_dir:
        return Path(files_dir)
    return Path(__file__).resolve().parent.parent / "data" / "peer_files"


def _pdf_info(path: Path) -> tuple[int, bool]:
    import pdfplumber
    with pdfplumber.open(path) as pdf:
        pages = len(pdf.pages)
        text = any((pg.extract_text() or "").strip() for pg in pdf.pages[:3])
    return pages, text


def _existing(store: Store, url: str) -> dict | None:
    r = store.conn.execute("SELECT * FROM peer_document WHERE url = ? ORDER BY doc_id DESC LIMIT 1", (url,)).fetchone()
    return dict(r) if r else None


def _store_file(store: Store, registry: Registry, item: dict, data: bytes, url: str, tier: str, files: Path,
                retrieved: str) -> dict:
    sha = hashlib.sha256(data).hexdigest()
    same = store.conn.execute("SELECT * FROM peer_document WHERE url = ? AND sha256 = ?", (url, sha)).fetchone()
    if same:
        return {**dict(same), "created": False}
    files.mkdir(parents=True, exist_ok=True)
    path = files / f"{sha}.pdf"
    path.write_bytes(data)
    pages, has_text = _pdf_info(path)
    if not has_text:
        path.unlink(missing_ok=True)
        raise PeerError("scanned", "the PDF has no text layer in its first pages; it needs OCR, which v1 does not do")
    peer = registry.peers[item["peer_id"]]
    known_sha = next((d["sha256"] for d in peer["known_documents"] if d["url"] == url), None)
    with store.transaction() as cur:
        doc_id = f"P{cur.execute('SELECT COUNT(*) FROM peer_document').fetchone()[0] + 1:05d}"
        ev = write_evidence(cur, "fetch_peer_document",
                            {"peer_id": item["peer_id"], "period": item["period"], "doc_type": item["doc_type"], "url": url},
                            {"doc_id": doc_id, "sha256": sha, "pages": pages, "bytes": len(data), "retrieved_utc": retrieved},
                            [{"url": url, "sha256": sha}], "system")
        cur.execute("INSERT INTO peer_document (doc_id, peer_id, period, doc_type, url, source_tier, retrieved_utc, sha256, "
                    "pages, bytes, path, evidence_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                    (doc_id, item["peer_id"], item["period"], item["doc_type"], url, tier, retrieved, sha, pages,
                     len(data), str(path), ev.evidence_id))
    row = dict(store.conn.execute("SELECT * FROM peer_document WHERE doc_id = ?", (doc_id,)).fetchone())
    if known_sha and known_sha != sha:
        row["warning"] = "differs from the hash recorded in the corpus manifest (the issuer may have replaced the file)"
    return {**row, "created": True}


async def _download(client, url: str, sems: dict, overall: asyncio.Semaphore) -> tuple[bytes, str]:
    """(content, final url). Network errors, timeouts and the status codes servers use for transient refusals
    (403 from bot screens, 408, 429, 5xx) are retried with backoff; other errors fail at once."""
    import httpx
    host = urlparse(url).hostname or ""
    sem = sems.setdefault(host, asyncio.Semaphore(MAX_PER_DOMAIN))
    last = ""
    for attempt in range(RETRIES + 1):
        async with overall, sem:
            try:
                r = await client.get(url, timeout=httpx.Timeout(TIMEOUT_S, connect=CONNECT_TIMEOUT_S), follow_redirects=True)
            except httpx.TransportError as e:
                last = f"network error: {type(e).__name__}"
            else:
                if r.status_code == 200:
                    if not r.content.startswith(b"%PDF"):
                        raise PeerError("not_pdf", "the response is not a PDF (an HTML page or a bot challenge)")
                    return r.content, str(r.url)
                if r.status_code not in RETRY_STATUS:
                    raise PeerError("http_error", f"HTTP {r.status_code}")
                last = f"HTTP {r.status_code}"
        if attempt < RETRIES:
            await asyncio.sleep(2 ** attempt)
    raise PeerError("http_error" if last.startswith("HTTP") else "network",
                    f"{last} after {RETRIES + 1} tries; if the issuer blocks scripted downloads, download the PDF in a "
                    "browser and attach it in the chat (ledger_add_peer_upload)")


def fetch_peer_documents(store: Store, registry: Registry, items: list[dict], files_dir: str | Path | None = None,
                         mailbox: str = "volt-research@example.invalid",
                         client_factory: Callable[[], Any] | None = None) -> list[dict]:
    """items: [{peer_id, period, doc_types: [...], url?: str}]. A url names a document found by restricted search
    and is accepted only on the peer's registered domains (or a registered news wire, as secondary).
    Returns one entry per requested document: stored (with doc_id) or failed (with a reason); stored + failed ==
    requested. Already-stored URLs are served from disk without a download."""
    files = _files_dir(store, files_dir)
    jobs, results = [], []
    for it in items:
        if it["peer_id"] not in registry.peers:
            raise PeerError("unknown_peer", it["peer_id"])
        peer = registry.peers[it["peer_id"]]
        for dt in it.get("doc_types") or ["supplementary_financial_info"]:
            job = {"peer_id": it["peer_id"], "period": it["period"], "doc_type": dt}
            if it.get("url"):
                url, tier = it["url"], allowed(registry, peer, it["url"])
                if tier is None:
                    results.append({**job, "status": "failed", "reason": "domain_not_registered", "url": url})
                    continue
            else:
                found = document_url(peer, it["period"], dt)
                if not found:
                    results.append({**job, "status": "failed", "reason": "no_url",
                                    "hint": f"search only {', '.join(peer['ir_domains'])} and pass the PDF url"})
                    continue
                url, tier = found
                if allowed(registry, peer, url) is None:
                    results.append({**job, "status": "failed", "reason": "domain_not_registered", "url": url})
                    continue
            prior = _existing(store, url)
            if prior and Path(prior["path"]).exists():
                results.append({**job, "status": "stored", "created": False, **_public(prior)})
                continue
            jobs.append((job, url, tier))

    async def run() -> list[dict]:
        import httpx
        overall = asyncio.Semaphore(MAX_CONCURRENT)
        sems: dict = {}
        headers = {"User-Agent": USER_AGENT.format(mailbox=mailbox), **HEADERS}
        async with (client_factory() if client_factory else httpx.AsyncClient(headers=headers)) as client:
            async def one(job, url, tier):
                try:
                    data, final = await _download(client, url, sems, overall)
                    _check_final_host(registry, registry.peers[job["peer_id"]], url, final, data)
                    retrieved = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
                    row = _store_file(store, registry, job, data, url, tier, files, retrieved)
                    return {**job, "status": "stored", "created": row["created"], **_public(row)}
                except PeerError as e:
                    return {**job, "status": "failed", "reason": e.code, "detail": str(e), "url": url}
            return list(await asyncio.gather(*(one(*j) for j in jobs)))

    if jobs:
        results.extend(asyncio.run(run()))
    return results


def _check_final_host(registry: Registry, peer: dict, url: str, final: str, data: bytes) -> None:
    """A redirect may end on the peer's registered domains (including its document CDNs), or anywhere when the file
    is byte-identical to the one recorded in the corpus manifest for this URL. Anything else is refused."""
    if urlparse(final).hostname == urlparse(url).hostname or allowed(registry, peer, final):
        return
    known = {d["url"]: d.get("sha256") for d in peer["known_documents"]}
    if known.get(url) and hashlib.sha256(data).hexdigest() == known[url]:
        return
    raise PeerError("redirected_off_domain", f"redirected to {urlparse(final).hostname}, which is not registered for "
                    f"{peer['peer_id']}; add it to cdn_domains in the registry if the issuer links to it")


def _public(row: dict) -> dict:
    return {k: row[k] for k in ("doc_id", "url", "source_tier", "retrieved_utc", "sha256", "pages") if k in row} | \
        ({"warning": row["warning"]} if row.get("warning") else {})


def import_corpus(store: Store, registry: Registry, corpus_dir: str | Path, files_dir: str | Path | None = None) -> list[dict]:
    """Load the 24 Nov 2026 corpus files (downloaded by a person) as if fetched: each file's hash must match the
    manifest, and its URL keeps its original domain and tier. Returns one entry per known PDF."""
    files, out = _files_dir(store, files_dir), []
    for peer in registry.peers.values():
        for d in peer["known_documents"]:
            if d.get("file_type") != "pdf" or not d.get("corpus_path"):
                continue
            src = Path(corpus_dir) / d["corpus_path"]
            job = {"peer_id": peer["peer_id"], "period": d["period"], "doc_type": d["doc_type"]}
            if not src.exists():
                out.append({**job, "status": "failed", "reason": "missing_file"})
                continue
            data = src.read_bytes()
            if hashlib.sha256(data).hexdigest() != d["sha256"]:
                out.append({**job, "status": "failed", "reason": "hash_mismatch"})
                continue
            row = _store_file(store, registry, job, data, d["url"], d["source_tier"], files, "2026-11-24T00:00:00Z")
            out.append({**job, "status": "stored", "created": row["created"], **_public(row)})
    return out


# ---- reading figures --------------------------------------------------------------------------------------------

ROWS = {
    "nii": re.compile(r"^\s*net interest income(?![a-z])(?!.*(?:adjusted|sensitivity|margin|\bratio\b))", re.I),
    "non_interest_income": re.compile(r"^\s*(?:non-?interest (?:income|revenue)|other income)(?![a-z])(?!.*adjusted)", re.I),
    "total_operating_income": re.compile(r"^\s*(?:total revenues?|revenues?)(?![a-z])(?!.*(?:adjusted|\bby\b|\bfrom\b))", re.I),
    "non_interest_expense": re.compile(r"^\s*(?:total )?non-?interest expenses?(?![a-z])(?!.*adjusted)", re.I),
    "efficiency_ratio": re.compile(r"^\s*efficiency ratio(?:\s*[\u2013-]\s*reported)?(?![a-z])(?!.*adjusted)", re.I),
}
_NUM = re.compile(r"^\(?-?\d{1,3}(?:,\d{3})*(?:\.\d+)?\)?$|^\(?-?\d+(?:\.\d+)?\)?$")
_DASH = {"\u2014", "\u2013", "-", "n/a", "nm", "n.m."}


def _values(rest: str) -> dict[tuple[bool, bool], list[Decimal | None]]:
    """Candidate readings of a row's numbers, keyed by (kerning gaps joined, leading line number dropped): as printed,
    with gaps joined (RBC prints '8 ,744' and '1 8,538'), and each with a leading line-number column dropped (TD and
    BMO print one). Every row on a page must be read the same way as the rows that tie."""
    if rest[:1].isdigit():                                   # footnote digits glued to the label, e.g. 'income2,3'
        rest = re.sub(r"^[\d,]+", "", rest)
    rest = re.sub(r"\([^)]*[A-Za-z][^)]*\)", " ", rest).strip()   # '(see page 5)', '(TEB)'
    rest = re.sub(r"^\(\d{1,2}\)\s", "", rest)                     # a footnote marker such as '(4)'
    joined = re.sub(r"(?<![\d,.])(\d) (\d{1,2},\d{3})", r"\1\2", re.sub(r"(\d) ,(\d{3})", r"\1,\2", rest))
    joined = re.sub(r"(?<![\d,.])(\d) (\d\.\d)", r"\1\2", joined)       # '5 2.8%' -> '52.8%'

    out: dict[tuple[bool, bool], list[Decimal | None]] = {}
    for join, text in ((False, rest), (True, joined)):
        toks = [t for t in text.replace("$", " ").replace("%", " ").split() if t]
        vals: list[Decimal | None] = []
        for t in toks:
            if t.lower() in _DASH:
                vals.append(None)
            elif _NUM.match(t):
                neg = t.startswith("(") or t.startswith("-")
                n = Decimal(t.strip("()").lstrip("-").replace(",", ""))
                vals.append(-n if neg else n)
        out[(join, False)] = vals
        first = toks[0] if toks else ""
        if vals and vals[0] is not None and re.fullmatch(r"\d{1,2}", first):
            out[(join, True)] = vals[1:]
    return out


def _target_column(text: str, period: str, end: date) -> tuple[int, str] | None:
    """Index and printed label of the requested quarter in the page's first column header (P6). Where the header
    prints years (on the same line or the next), the column must match the period-end year too, so a prior-year
    column with the same month or quarter is never taken."""
    q = (_PERIOD.fullmatch(period).group(2) or "")
    lines = text.split("\n")[:40]
    for i, line in enumerate(lines):
        nxt = lines[i + 1] if i + 1 < len(lines) else ""
        quarters = re.findall(r"\bQ\s?([1-4])(?:\s?/\s?(\d{2})|\s+(\d{4}))?\b", line)
        if len(quarters) >= 3 and q.startswith("Q"):
            years = [(y2 and 2000 + int(y2)) or (y4 and int(y4)) or None for _, y2, y4 in quarters]
            fiscal = int(_PERIOD.fullmatch(period).group(1))
            for k, (qq, _, _) in enumerate(quarters):
                if qq == q[1] and years[k] in (None, fiscal, fiscal % 100 + 2000):
                    return k, f"Q{qq}" + (f" {years[k]}" if years[k] else "")
            return None
        months = re.findall(r"\b(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)\s+(\d{1,2})\b",
                            line.upper())
        if len(months) >= 3:
            want = calendar.month_name[end.month].upper()
            years = re.findall(r"\b(20\d{2})\b", line[line.upper().rfind(months[-1][0]):]) or re.findall(r"\b(20\d{2})\b", nxt)
            paired = len(years) >= len(months)
            for k, (m, d) in enumerate(months):
                if m == want and (not paired or int(years[k]) == end.year):
                    return k, f"{m.title()} {d}" + (f", {years[k]}" if paired else "")
            return None
    return None


def _scale(text: str) -> int:
    """Minor units (cents) per printed unit: millions unless the page says thousands."""
    head = text[:1500].lower()
    return 100_000 if "thousands of dollars" in head or "in thousands" in head or "($ thousands" in head else 100_000_000


def read_pack(path: str | Path, period: str, end: date, max_pages: int = 30) -> dict:
    """Find the first page whose NII, non-interest income and total revenue rows tie for the requested column and
    the next two; return the figures with page, row text and column. Nothing is accepted without the tie."""
    import pdfplumber
    tried = []
    with pdfplumber.open(path) as pdf:
        for pno, page in enumerate(pdf.pages[:max_pages], start=1):
            text = page.extract_text() or ""
            rows: dict[str, list[tuple[str, list]]] = {k: [] for k in ROWS}
            for line in text.split("\n"):
                for key, pat in ROWS.items():
                    m = pat.match(line)
                    if m and re.search(r"\d", line[m.end():]):
                        rows[key].append((line, _values(line[m.end():])))
            if not (rows["nii"] and rows["non_interest_income"] and rows["total_operating_income"]):
                continue
            found_col = _target_column(text, period, end)
            if found_col is None:
                tried.append({"page": pno, "reason": "requested period not found in the column header"})
                continue
            col, col_label = found_col
            tied = _tie(rows, col)
            if not tied:
                tried.append({"page": pno, "reason": "rows found but they do not tie"})
                continue
            hit, reading = tied
            scale = _scale(text)
            figures = {k: {"value": v, "row": r, "page": pno, "column": col, "column_label": col_label} for k, (r, v) in hit.items()}
            revenue = abs(hit["total_operating_income"][1])
            # Rows outside the tie are read the same way, or with a leading footnote or line number dropped, and kept
            # only if plausible: expenses below revenue; a reported efficiency ratio within 5 points of expenses / revenue.
            for key in ("non_interest_expense", "efficiency_ratio"):
                for line, cands in rows[key]:
                    found = None
                    for k in (reading, (reading[0], not reading[1])):
                        vals = cands.get(k)
                        if not vals or len(vals) <= col or vals[col] is None:
                            continue
                        v = abs(vals[col])
                        if key == "non_interest_expense" and 0 < v < revenue:
                            found = v
                        elif key == "efficiency_ratio" and "non_interest_expense" in figures:
                            computed = figures["non_interest_expense"]["value"] / revenue * 100
                            if abs(v - computed) <= 5:
                                found = v
                        if found is not None:
                            break
                    if found is not None:
                        figures[key] = {"value": found, "row": line, "page": pno, "column": col, "column_label": col_label}
                        break
            return {"status": "ok", "page": pno, "column": col, "scale_minor": scale, "figures": figures, "tried": tried}
    return {"status": "not_verified", "tried": tried[:10]}


def _tie(rows: dict, col: int) -> tuple[dict, tuple[bool, bool]] | None:
    """The first NII, non-interest income and total revenue rows that, read the same way, satisfy
    NII + non-interest income = total revenue for the requested column and the next two (at least two columns)."""
    for nl, ncs in rows["nii"]:
        for il, ics in rows["non_interest_income"]:
            for rl, rcs in rows["total_operating_income"]:
                for key in ((False, False), (False, True), (True, False), (True, True)):
                    n, i, r = ncs.get(key), ics.get(key), rcs.get(key)
                    if not (n and i and r):
                        continue
                    cols = [c for c in (col, col + 1, col + 2) if c < min(len(n), len(i), len(r))]
                    if len(cols) < 2 or cols[0] != col:
                        continue
                    if all(None not in (n[c], i[c], r[c]) and abs(r[c]) >= 100 and n[c] + i[c] == r[c] for c in cols):
                        return {"nii": (nl, n[col]), "non_interest_income": (il, i[col]),
                                "total_operating_income": (rl, r[col])}, key
    return None


METRICS = {
    "nii": ("Net interest income", "money"),
    "non_interest_income": ("Non-interest income", "money"),
    "total_operating_income": ("Total revenue", "money"),
    "non_interest_expense": ("Non-interest expenses", "money"),
    "efficiency_ratio": ("Efficiency ratio", "percent"),
}


def _money_display(minor: int) -> str:
    millions = Decimal(minor) / Decimal(100_000_000)
    return f"C${millions.quantize(Decimal(1) if millions == millions.to_integral() else Decimal('0.001')):,} million"


def peer_metrics(store: Store, doc_ids: list[str], metric_ids: list[str] | None = None) -> list[dict]:
    """Reported figures from each document (tie-checked, P5) and computed figures from them. Every entry names its
    doc, page, row text and column; missing inputs come back as not_computable."""
    metric_ids = metric_ids or list(METRICS)
    unknown = [m for m in metric_ids if m not in METRICS]
    if unknown:
        raise PeerError("unknown_metric", f"peer metrics in v1: {', '.join(METRICS)}", unknown)
    out = []
    for doc_id in doc_ids:
        d = store.conn.execute("SELECT * FROM peer_document WHERE doc_id = ?", (doc_id,)).fetchone()
        if d is None:
            raise PeerError("unknown_document", doc_id)
        registry = load_registry()
        peer = registry.peers[d["peer_id"]]
        read = read_pack(d["path"], d["period"], period_end(peer, d["period"]))
        base = {"peer_id": d["peer_id"], "name": peer["name"], "period": d["period"], "doc_id": doc_id,
                "source_tier": d["source_tier"], "url": d["url"]}
        if read["status"] != "ok":
            out.append({**base, "status": "not_verified", "metrics": {m: {"status": "not_computable"} for m in metric_ids},
                        "tried": read["tried"]})
            continue
        f, scale = read["figures"], read["scale_minor"]
        metrics: dict[str, dict] = {}
        for m in metric_ids:
            label, unit = METRICS[m]
            if m in f and unit == "money":
                minor = int(f[m]["value"] * scale)
                metrics[m] = {"status": "ok", "basis": "reported", "label": label, "unit": unit, "value_minor": str(minor),
                              "currency": "CAD", "display": _money_display(minor), "printed": f"{f[m]['value']:,}",
                              "evidence": {k: f[m][k] for k in ("page", "row", "column", "column_label")},
                              "check": "tied" if m != "non_interest_expense" else "row found on the tied page"}
            elif m == "efficiency_ratio":
                entry: dict = {"label": label, "unit": unit}
                if "efficiency_ratio" in f:
                    entry["reported"] = {"value": str(f[m]["value"]), "display": f"{f[m]['value']}%",
                                         "definition": "the issuer's own definition, as printed",
                                         "evidence": {k: f[m][k] for k in ("page", "row", "column", "column_label")}}
                if "non_interest_expense" in f:
                    pct = (Decimal(f["non_interest_expense"]["value"]) / Decimal(f["total_operating_income"]["value"]) * 100)
                    pct = pct.quantize(Decimal("0.1"), ROUND_HALF_EVEN)
                    entry["computed"] = {"value": str(pct), "display": f"{pct}%",
                                         "definition": "VOLT default: non-interest expenses / total revenue, both as printed"}
                entry["status"] = "ok" if ("reported" in entry or "computed" in entry) else "not_computable"
                metrics[m] = entry
            else:
                metrics[m] = {"status": "not_computable", "missing": [m]}
        out.append({**base, "status": "ok", "page": read["page"], "metrics": metrics})
    return out
