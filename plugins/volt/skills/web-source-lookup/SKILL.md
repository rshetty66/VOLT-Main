---
name: web-source-lookup
description: When the user asks you to check, verify, or cite a published external source — a regulator's guideline, a filed annual report, an accounting standard, a central bank rate, an industry benchmark. Also use when the user gives you a URL, says "look this up," "what does OSFI/FINTRAC/IFRS actually say," "find the current rate," "check the filing," or asks you to confirm a figure you would otherwise be recalling from memory. Covers OSFI CAR and B-series guidelines, FINTRAC guidance, IFRS/IAS standards summaries, Bank of Canada and Payments Canada publications, SEDAR+ and EDGAR filings, and regulator news releases.
metadata:
  version: 1.1.0
disable-model-invocation: true
---

# Looking Up a Published Source

You have one tool for this: **`fetch_web_page`**, which takes a `url` and returns that
page as text. Nothing else in this skill can reach the network — this file is
instructions, and the tool is the only thing that acts.

## When it is worth a fetch

Fetch when the answer has to be **current or exact** and a wrong version of it would
be embarrassing in front of a client:

- a threshold, ratio, or rate that changes (CET1 buffers, the DSTI limit, the
  overnight rate, FINTRAC reporting thresholds)
- the actual wording of a guideline the client will quote back at you
- a figure from a specific filing, for a specific quarter
- anything the user has asked you to *verify* rather than to explain

Do **not** fetch for durable concepts. How a CET1 ratio is constructed, what a
three-way match is, why IFRS 17 splits the CSM — that is in your training and in the
domain skills, and a fetch adds latency and a citation that says less than you already
know.

## How to do it well

1. **Go to the primary source.** `osfi-bsif.gc.ca` over a consultancy's summary of
   OSFI. A regulator's own page is the one a client cannot argue with.
2. **One page, then decide.** Read what came back before fetching again. Chaining five
   speculative fetches burns the loop's iteration budget and usually returns the same
   navigation text five times.
3. **Cite what you fetched.** Give the URL and the date, in the body next to the
   figure. A number with no source is worse than no number, because it looks settled.
4. **Quote short and exact.** For regulatory wording, a sentence verbatim beats a
   paraphrase that shifts the obligation.

## Which sources actually work

**There is no approved-domain list. Any public host is allowed** — go to whichever site
actually holds the answer, including one not named here.

**A failed fetch is retried for you, on a different network.** When a fetch cannot
connect, or the site returns 403 to an automated client, the tool asks a hosted fetching
service for the same URL and hands you that page instead. You will know it happened
because the result says the page "was read through a hosted fetching service" — cite it
to the URL and say it was retrieved. So:

- **Do not conclude a host is unreachable from one failed fetch.** The retry has already
  happened by the time you see the error, which means the error is about the page, not
  about this environment's connectivity.
- **`web_search` goes out through that same hosted service**, so it can succeed when a
  direct fetch of the same host did not. Search before you declare anything unavailable.
- A dead URL is one dead URL. It is not evidence about the next host you were going to try.

**OSFI (`osfi-bsif.gc.ca`)** and **Payments Canada (`payments.ca`)** WAF-block automated
clients with a **403** — their fingerprint check is not a header problem and we will not
spoof a browser to defeat it. Those two now come back through the hosted retry (verified
against OSFI's IFRS 18 reporting-instructions page). If a specific OSFI page still does
not come back, fall back to the `osfi-regulatory-expert` skill and **say the wording is
from training rather than verified against the live Guidance Library** — then give the
user the URL. That sentence is not optional; an **unverified** regulatory quote presented
as verified is the failure this whole tool exists to prevent.

Worth knowing where the good primary sources are, so you spend one fetch instead of
three: Bank of Canada (`bankofcanada.ca` — the Valet JSON API at
`/valet/observations/<series>/json?recent=1` is the cleanest way to get a rate, far
better than scraping a rates page. **`V39079` is the policy rate** — "Target for the
overnight rate", business daily; it is NOT the Bank Rate, which sits 25bp above it.
**`BD.CDN.5YR.DQ.YLD`** is the 5-year benchmark bond yield, a different series. Neither
code is retired: both were confirmed live against `/valet/series/<code>/json` on
2026-09-11, which returns each one's own label. A wrong code returns **HTTP 404 with
`{"message": "Series X not found."}`** — never a 200 with an empty `observations` array,
so there is no silent-null failure mode here to warn anyone about. The group path
`/valet/observations/group/bank_canada_rates/json` does not exist and 404s.)
· FINTRAC (`fintrac-canafe.canada.ca`) · IFRS
Foundation and the IASB standard pages (`ifrs.org`) · SEC EDGAR (`data.sec.gov`,
`efts.sec.gov`, `sec.gov/files/...`) · Statistics Canada (`www150.statcan.gc.ca`) · BIS
Basel Framework (`bis.org`) · CDIC (`cdic.ca`) · SEDAR+ (`sedarplus.ca`).

## The limits — state them, do not paper over them

**It does not run JavaScript.** It is an HTTP fetch, not a browser. A page that builds
itself client-side (most dashboards, many "explore the data" tools, some investor
relations sites) comes back nearly empty or as a navigation shell. When that happens,
**say the page did not render as text and give the user the URL** so they can look
themselves. Do not infer what the page probably said — a plausible invented figure is
the single worst output this tool can lead to.

**Public hosts only.** Internal addresses, cluster service names, loopback and cloud
metadata are refused by design, and so are unusual ports. If you want internal data,
the Oracle ERP and SharePoint tools are the way in; this one will not reach it.

**Read the error, do not theorise past it.** The tool tells you which kind of failure it
was, and the kinds mean different things: a 403 is the site refusing a bot, a timeout
means the host answered but is slow, a connection error means this environment could not
reach it. Report the one you got. Do not upgrade a failure you did not diagnose into a
claim about firewalls, certificates, or TLS handshakes — that has already happened once
in front of a user, and a confident wrong explanation is worse than "the fetch failed."

**Never describe a source you could not read.** When a fetch fails, search snippets
*about* that source are still there, and they are more than enough to build a confident
and wrong account of how it works. This has already happened in front of a user. With
`bankofcanada.ca` unreachable, snippets produced three claims — that `V39079` was a
retired CANSIM-style code, that it was the 5-year bond yield, and that a retired code
returns HTTP 200 with an empty `observations` array — and then a two-part recommendation
to re-point a downstream process, with the identifier change called the half that
"matters more than the first". All three claims were false. The issuer's own
`/valet/series/V39079/json` returns "Target for the overnight rate (business daily)", the
5-year yield is a separate series, and a bad code 404s with a message. A `[Verify]` tag
sat on one of those claims and did not stop the recommendation being made.

So: a snippet can tell you a source **exists** and roughly what it covers. It is never
evidence about that source's identifiers, schema, error behaviour, versioning, or whether
something is retired — if you could not open it, you do not know those things. Say it was
unreachable and stop. Do not recommend changing anything on that basis.

**A long page comes back clipped, and the clip takes the END.** The tool says so
explicitly when it happens. This matters most for exactly the sources you want: a Valet
series or a StatCan table is ordered **oldest-first**, so what gets cut is the recent
data you were after. Never read the last visible row of a truncated series as current —
re-fetch with a recency or date-range parameter (`?recent=1` on Valet) instead.

**No credentials, no client data in a URL.** Query strings end up in logs and in
someone's referrer header. Never assemble a URL containing a client name, an account
number, a token, or anything out of an engagement file.

**PDFs work — scanned ones do not.** The tool extracts text from PDFs, so a guideline,
MPR, staff paper, or filing published only as a PDF is fully usable, and there is no
need to hunt for an HTML version. The exception is a PDF that is images of pages with no
text layer: there is no OCR, so nothing comes back. The tool says so explicitly when it
happens — pass that on and give the user the URL. Never fill the gap from memory.

## Reporting

Fold what you fetched into the answer the way you would any other evidence — figures
inline, with the source next to them. If a fetch failed or came back empty, that
belongs in the answer too, in one sentence, not silently dropped. An answer that hides
a failed lookup is how a recalled-from-memory number gets presented as a verified one.
