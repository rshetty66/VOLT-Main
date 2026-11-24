"""Peer results search (step 7): registry, calendars, domain rules, parallel fetch and the corpus golden figures."""
from __future__ import annotations

import os
import re
from datetime import date
from pathlib import Path

import httpx
import pytest

from volt_ledger.peers import (PeerError, allowed, document_url, fetch_peer_documents, import_corpus, load_registry,
                               peer_metrics, period_end, resolve_peer_period)

CORPUS = Path(os.environ.get("VOLT_PEER_CORPUS", "/mnt/project-files/volt-ledger/corpus"))


def tiny_pdf(text: str = "Supplementary Financial Information Q3 2026") -> bytes:
    """A one-page PDF with a text layer, built by hand so the tests need no PDF writer."""
    stream = f"BT /F1 12 Tf 72 720 Td ({text}) Tj ET".encode()
    objs = [b"<< /Type /Catalog /Pages 2 0 R >>",
            b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
            b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R "
            b"/Resources << /Font << /F1 5 0 R >> >> >>",
            b"<< /Length %d >>\nstream\n" % len(stream) + stream + b"\nendstream",
            b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"]
    out, offsets = bytearray(b"%PDF-1.4\n"), []
    for i, o in enumerate(objs, 1):
        offsets.append(len(out))
        out += b"%d 0 obj\n" % i + o + b"\nendobj\n"
    xref = len(out)
    out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objs) + 1)
    out += b"".join(b"%010d 00000 n \n" % off for off in offsets)
    out += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objs) + 1, xref)
    return bytes(out)


@pytest.fixture(scope="module")
def registry():
    return load_registry()


def test_templates_reproduce_the_manifest_urls(registry):
    checked = 0
    for peer in registry.peers.values():
        for d in peer["known_documents"]:
            t = peer["templates"].get(d["doc_type"])
            m = re.fullmatch(r"FY(\d{4})-Q(\d)", d["period"])
            if not t or not m or d["source_tier"] != "primary":
                continue
            assert t.format(fy=m.group(1), yy=m.group(1)[2:], q=m.group(2)) == d["url"], (peer["peer_id"], d["doc_type"])
            checked += 1
    assert checked >= 10
    # A period not in the corpus comes from the template.
    url, tier = document_url(registry.peers["td"], "FY2026-Q4", "supplementary_financial_info")
    assert url.endswith("/2026/q4/2026-q4-financial-supppack-en.pdf") and tier == "primary"


def test_fiscal_calendars(registry):
    assert period_end(registry.peers["td"], "FY2026-Q3") == date(2026, 7, 31)
    assert period_end(registry.peers["td"], "FY2026-Q1") == date(2026, 1, 31)
    assert period_end(registry.peers["atb"], "FY2027-Q1") == date(2026, 6, 30)
    assert period_end(registry.peers["manulife"], "FY2026-Q3") == date(2026, 9, 30)
    assert period_end(registry.peers["otpp"], "FY2026-H1") == date(2026, 6, 30)
    with pytest.raises(PeerError):
        period_end(registry.peers["otpp"], "FY2026-Q1")


def test_latest_period_and_not_yet_released(registry):
    as_of = date(2026, 11, 24)
    rows = {r["peer_id"]: r for r in resolve_peer_period(registry, ["big6"], as_of)}
    assert set(rows) == {"rbc", "td", "bmo", "bns", "cibc", "nbc"}
    assert all(r["period"] == "FY2026-Q3" and r["status"] == "available" for r in rows.values())
    q4 = resolve_peer_period(registry, ["td"], as_of, "FY2026-Q4")[0]
    assert q4["status"] == "not_yet_released" and q4["period"] == "FY2026-Q4"
    with pytest.raises(PeerError):
        resolve_peer_period(registry, ["no_such_bank"], as_of)


def test_only_registered_domains(registry):
    td = registry.peers["td"]
    assert allowed(registry, td, "https://www.td.com/x.pdf") == "primary"
    assert allowed(registry, td, "https://www.newswire.ca/x.pdf") == "secondary"
    assert allowed(registry, td, "https://finance.yahoo.com/x.pdf") is None
    assert allowed(registry, td, "http://www.td.com/x.pdf") is None


def _client(routes: dict[str, tuple[int, bytes]], calls: list[str]):
    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(str(request.url))
        status, body = routes.get(str(request.url), (404, b"not found"))
        return httpx.Response(status, content=body)
    return lambda: httpx.AsyncClient(transport=httpx.MockTransport(handler))


def test_parallel_fetch_stores_by_hash_and_accounts_for_every_document(store, registry, tmp_path):
    pdf = tiny_pdf()
    base = "https://www.td.com/content/dam/tdcom/canada/about-td/pdf/quarterly-results/2026/q4/"
    routes = {base + "2026-q4-financial-supppack-en.pdf": (200, pdf),
              base + "2026-q4-earnings-newsrelease-en.pdf": (200, b"<html>bot challenge</html>")}
    calls: list[str] = []
    items = [{"peer_id": "td", "period": "FY2026-Q4",
              "doc_types": ["supplementary_financial_info", "press_release", "report_to_shareholders"]},
             {"peer_id": "td", "period": "FY2026-Q4", "doc_types": ["press_release"],
              "url": "https://finance.yahoo.com/td.pdf"},
             {"peer_id": "sprott", "period": "FY2025-Q1", "doc_types": ["press_release"]}]
    out = fetch_peer_documents(store, registry, items, tmp_path, client_factory=_client(routes, calls))
    assert len(out) == 5  # every requested document is accounted for: stored + failed == requested
    stored = [r for r in out if r["status"] == "stored"]
    assert len(stored) == 1 and stored[0]["created"] and stored[0]["pages"] == 1
    assert (tmp_path / f"{stored[0]['sha256']}.pdf").exists()
    reasons = sorted(r["reason"] for r in out if r["status"] == "failed")
    assert reasons == ["domain_not_registered", "http_error", "no_url", "not_pdf"]
    assert "finance.yahoo.com" not in " ".join(calls)

    calls.clear()
    again = fetch_peer_documents(store, registry, items[:1], tmp_path, client_factory=_client(routes, calls))
    sup = next(r for r in again if r["doc_type"] == "supplementary_financial_info")
    assert sup["status"] == "stored" and sup["created"] is False and sup["doc_id"] == stored[0]["doc_id"]
    assert base + "2026-q4-financial-supppack-en.pdf" not in calls
    assert store.conn.execute("SELECT COUNT(*) FROM peer_document").fetchone()[0] == 1


def test_off_domain_redirect_is_refused(store, registry, tmp_path):
    src = "https://www.td.com/content/dam/tdcom/canada/about-td/pdf/quarterly-results/2026/q4/2026-q4-financial-supppack-en.pdf"

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.host == "www.td.com":
            return httpx.Response(302, headers={"location": "https://evil.example/x.pdf"})
        return httpx.Response(200, content=tiny_pdf())
    factory = lambda: httpx.AsyncClient(transport=httpx.MockTransport(handler))  # noqa: E731
    out = fetch_peer_documents(store, registry, [{"peer_id": "td", "period": "FY2026-Q4",
                                                  "doc_types": ["supplementary_financial_info"]}], tmp_path,
                               client_factory=factory)
    assert out == [{"peer_id": "td", "period": "FY2026-Q4", "doc_type": "supplementary_financial_info",
                    "status": "failed", "reason": "redirected_off_domain", "detail": out[0]["detail"], "url": src}]


def test_a_pack_without_a_tied_table_is_not_verified(store, registry, tmp_path):
    url = "https://www.td.com/content/dam/tdcom/canada/about-td/pdf/quarterly-results/2026/q4/2026-q4-financial-supppack-en.pdf"
    calls: list[str] = []
    out = fetch_peer_documents(store, registry, [{"peer_id": "td", "period": "FY2026-Q4",
                                                  "doc_types": ["supplementary_financial_info"]}], tmp_path,
                               client_factory=_client({url: (200, tiny_pdf())}, calls))
    r = peer_metrics(store, [out[0]["doc_id"]])[0]
    assert r["status"] == "not_verified"
    assert all(v["status"] == "not_computable" for v in r["metrics"].values())
    with pytest.raises(PeerError):
        peer_metrics(store, [out[0]["doc_id"]], ["roe"])


GOLDEN = {  # printed values on the tied page, in the issuer's own units (thousands for LB and ATB)
    "rbc": ("8,744", "9,794", "18,538"), "td": ("9,296", "7,589", "16,885"), "bmo": ("5,567", "4,329", "9,896"),
    "bns": ("5,866", "4,669", "10,535"), "cibc": ("4,507", "3,861", "8,368"), "eqb": ("319.2", "73.8", "393.0"),
    "lb": ("189,454", "52,280", "241,734"),
}


@pytest.mark.skipif(not (CORPUS / "manifest.csv").exists(), reason="the 24 Nov 2026 peer corpus is not on this machine")
def test_corpus_golden_figures_tie(store, registry, tmp_path):
    imported = [r for r in import_corpus(store, registry, CORPUS, tmp_path) if r["status"] == "stored"]
    assert not [r for r in import_corpus(store, registry, CORPUS, tmp_path) if r.get("created")]  # re-import adds nothing
    sups = {r["peer_id"]: r["doc_id"] for r in imported
            if r["doc_type"] == "supplementary_financial_info" and r["period"] == "FY2026-Q3" and r["peer_id"] in GOLDEN}
    assert set(sups) == set(GOLDEN)
    for r in peer_metrics(store, list(sups.values()), ["nii", "non_interest_income", "total_operating_income"]):
        assert r["status"] == "ok", r["peer_id"]
        got = tuple(r["metrics"][m]["printed"] for m in ("nii", "non_interest_income", "total_operating_income"))
        assert got == GOLDEN[r["peer_id"]], r["peer_id"]
        assert all(v["check"] == "tied" and v["evidence"]["page"] for v in r["metrics"].values())
    rbc = next(r for r in peer_metrics(store, [sups["rbc"]], ["efficiency_ratio"]))
    assert rbc["metrics"]["efficiency_ratio"]["reported"]["value"] == "52.8"
