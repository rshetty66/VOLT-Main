# VOLT Ledger Brain

**Primary output: chart-of-accounts design** (refocused 24 Nov 2026). The brain diagnoses a client's current chart
from its trial balance, proposes a target chart (segments, natural account ranges, hierarchy, multi-GAAP roll-ups),
maps old accounts to new with a tie-out, and logs every design decision for review. Statements, ratios, allocation
and peer results are supporting inputs. See "Chart-of-accounts design" below.

The deterministic accounting engine behind VOLT's accounting-policy and ledger work. Claude in the VOLT Console
reads, maps and explains; this service does every calculation and keeps the records. See `docs/` for the approved
design: `intent.md`, `spec.md`, `ratio-catalogue.md` and the Phase 2 to 5 specs.

Status: Phase 6 steps 1 to 3 are built (ingestion, ontology loader, posting service), plus the engine side of step 4
(mapping, policy gaps, review queue). The HTTP API, the console tools that let Claude call these, and the allocation
engine come next. The system prompts Claude will use are in `prompts/`.

## Chart-of-accounts design (`volt_ledger/coa.py`)

The checks from `apps/volt-coa` (`shared/coa.ts`) are ported here so every verdict is tested code with evidence.

| Step | Tool | What code decides |
|---|---|---|
| Diagnose | `diagnose_coa` | Findings from the ingested, mapped trial balance: catch-alls, dimensions built into codes or names, near-duplicates, wrong-sign balances, unmapped accounts, dimensions filled inconsistently, income and expense with no business line, open policy gaps, statement lines and metrics the chart cannot produce |
| Draft | `check_coa_design` | A dry run: structure checks and coverage, nothing stored |
| Propose | `propose_coa_design` | Stored only if every check passes; the design and each decision go to the review queue; a new version supersedes |
| Map | `propose_coa_mapping` | Every trial-balance row placed exactly once; balances recut under the new chart; tie-out by total, class and concept, with every reclassified concept listed |
| Status and export | `coa_status`, `/v1/people/coa_export` | Review state; CSV of the chart, hierarchy, mapping and decision log |

Design checks: `S_NATURAL_SEGMENT`, `S_UNIQUE_SEGMENTS`, `S_SOURCE_DIMENSION`, `C_UNIQUE_CODES`, `C_CODE_LENGTH`,
`C_CLASS`, `C_TYPE_RANGE`, `C_PARENT_EXISTS`, `C_NO_CYCLES`, `C_PARENT_TYPE`, `C_NAMING`, `C_POSTING_CONCEPT`,
`C_CONCEPT_CLASS`, `C_NO_SEGMENT_IN_NAME`, `D_DECISIONS_COMPLETE`. Mapping checks: `M_UNKNOWN_SOURCE`,
`M_ROW_COVERAGE`, `M_ROW_UNIQUE`, `M_TARGET_EXISTS`, `M_POSTING_TARGET`, `M_RETIRE_ZERO`, `M_SEGMENT_NAMES`.

Every posting account carries a canonical concept, so its IFRS and US GAAP line and XBRL tags follow from the
ontology. Profit attribution lines (owners, non-controlling interests) are computed at consolidation, not posted.
The golden target chart for the synthetic bank is `tests/golden/synbank_target_coa.json`.

Not in v1: ERP load formats (Oracle, SAP, Workday), local statutory taxonomies beyond IFRS and US GAAP, and
PDF statement ingestion as a diagnosis input.

## Run the tests

```bash
cd apps/volt-ledger
python3 -m venv .venv && . .venv/bin/activate
pip install -e '.[dev]'
python -m pytest                                          # 67 tests, a few seconds
VOLT_PROPERTY_EXAMPLES=10000 python -m pytest tests/property   # the full property run, about 6 minutes
```

## What each step does

### Step 1: ingest a trial balance (`volt_ledger/ingest.py`)

Reads a CSV or Excel trial balance and stores every row, or rejects it with a reason (blank, no account code,
an amount with too many decimals, both debit and credit filled, an unknown business line, a duplicate). The rule
"stored + rejected = rows in the file" is checked on every run. Amounts are read as text and turned into whole
cents; floating point is never used. Excel numbers are read from the file's raw XML for the same reason.

```bash
python -c "
from volt_ledger.store import Store; from volt_ledger.ontology import load_ontology
from volt_ledger.ingest import ingest_trial_balance, ColumnMap
s = Store(); load_ontology(s)
r = ingest_trial_balance(s, 'data/synthetic/tb_2026-09.csv', 'SYNBANK', '2026-09', 'USD',
    ColumnMap(dimensions={'BusinessLine': 'business_line', 'CostCentre': 'cost_centre', 'CreditStage': 'credit_stage'}))
print(r.data_rows, r.stored, len(r.rejected), r.balanced)"
# expected: 64 64 0 True
```

The synthetic bank (`data/synthetic/make_synthetic.py`) is fictional. It carries one example of each policy gap the
brain must find in step 4; they are marked `GAP` in the script.

### Step 2: load the ontology (`volt_ledger/ontology.py`)

Loads the minimum viable graph (`data/ontology/mvg-bank-v1.json`): 62 canonical concepts with IFRS and US GAAP
XBRL names, calculation arcs for every subtotal, presentation arcs for both GAAPs, and four dimensions (business
line, credit stage, product, cost centre). Loading twice does nothing; loading changed content under the same
version is refused. XBRL names are marked unverified until checked against the official taxonomies.

```bash
python -c "
from volt_ledger.store import Store; from volt_ledger.ontology import load_ontology, presentation_children
s = Store(); load_ontology(s)
for c in presentation_children(s, 'stmt:IFRS:IS', 'ifrs')[:4]: print(c['ord'], c['element_id'])"
# expected:
# 10 canon:InterestIncome
# 20 canon:InterestExpense
# 30 canon:NetInterestIncome
# 40 canon:FeeAndCommissionIncome
```

### Step 3: the posting service (`volt_ledger/posting.py`)

`post_journal_entry` is the only way to write to the proposal ledger. It refuses unbalanced journals, lines with
both or neither side filled, unknown accounts or business lines, mixed currencies and locked periods. Sending the
same journal twice with the same key stores it once. `reverse_journal_entry` swaps every debit and credit; a
journal can be reversed once. Every table refuses UPDATE and DELETE at the database level, and every write adds
an evidence record to a SHA-256 hash chain, so any later edit to history is detected by `verify_chain`.

```bash
python -c "
from volt_ledger.store import Store; from volt_ledger.ontology import load_ontology
from volt_ledger.posting import JournalIn, LineIn, PostingError, post_journal_entry
s = Store(); load_ontology(s)
s.conn.execute(\"INSERT INTO element VALUES ('acct:X:1','account','Cash',NULL,NULL,NULL,NULL,'{}','{}','E0')\")
s.conn.execute(\"INSERT INTO element VALUES ('acct:X:2','account','Deposits',NULL,NULL,NULL,NULL,'{}','{}','E0')\")
try: post_journal_entry(s, JournalIn('k1','2026-09','adjustment','test',[LineIn('acct:X:1',debit=100),LineIn('acct:X:2',credit=99)]),'me')
except PostingError as e: print(e)"
# expected: unbalanced: debits 100 != credits 99 (minor units)
```

### Step 4a: mapping, policy gaps and review (`volt_ledger/mapping.py`)

The tools Claude will call to map accounts. `map_line_item_to_element` records a proposed mapping from a client
account to a canonical concept, with a confidence and a rationale, and links it to the trial-balance rows it came
from. A later mapping supersedes an earlier one; both stay in history. `flag_policy_gap` records an account that
needs a policy decision; standard references are stored as unverified. Mappings below 0.90 confidence, all
mappings in a first client run, and every gap go to the review queue. The engagement lead must approve an item
before the client can see it or sign it off, and only a signed-in person can record a decision.

`coverage` proves every account is either mapped or has a gap. In the tests a scripted stand-in plays the model,
mapping all 54 synthetic accounts and flagging all 8 seeded gap types; the live Claude run comes with step 4b.

### Step 4b: the HTTP API (`volt_ledger/api.py`)

The service the VOLT Console calls. It refuses to start without `VOLT_LEDGER_TOKEN`, and every call must carry it.
Amounts travel as integer strings of cents (a JSON number for an amount is rejected), and every answer uses the
same envelope: status, evidence id, data, and display strings the model copies instead of formatting numbers
itself. Routes under `/v1/tools/` are for the model; routes under `/v1/people/` (review decisions) need a signed-in
person and are never offered to the model.

```bash
VOLT_LEDGER_TOKEN=local-secret VOLT_LEDGER_DB=/tmp/ledger.db python -m volt_ledger.api   # listens on :8790
curl -s localhost:8790/healthz                                                          # {"ok":true}
```

### Step 4c: the console tools (`apps/volt-console/server/ledger.ts`)

The lead agent in the VOLT chat gets `ledger_*` tools when `VOLT_LEDGER_HOSTPORT` (or `VOLT_LEDGER_URL`) and
`VOLT_LEDGER_TOKEN` are set; `render.yaml` sets both for the `volt-ledger` private service. Every result the model can
cite becomes a source key, and a journal amount is accepted only if it appears in an earlier ledger result.

### Step 5: driver-based allocation (`volt_ledger/drivers.py`, `volt_ledger/allocation.py`)

This is driver-based allocation logic. A person enters driver values (FTEs, transaction counts or RWA) in the
console's Ledger review screen; the model proposes a rule (pool accounts, pool filter, driver, targets); the
engagement lead approves it; only then does `run_allocation` split each pool balance by largest remainder and propose
one `allocation` journal. Golden case: the IT01 pool of 143,000,000.00 by FTE 120 / 45 / 35 gives Retail
85,800,000.00, Commercial 32,175,000.00 and Wealth 25,025,000.00, to the cent.

### Step 6: statements, ratios and the output gate (`volt_ledger/reporting.py`)

`build_statement` rolls the mapped trial balance up the calculation arcs into an IFRS or US GAAP balance sheet or
income statement, lists unmapped accounts as excluded and policy-gap accounts as flagged, and checks that the
balance-sheet difference is fully explained by the excluded accounts. `compute_ratio` evaluates the 14 v1 metrics in
`data/metrics/metrics-v1.json` with a small evaluator (no `eval`). `check_output` is the gate: every figure in a
sentence that cites a ledger result must appear in that result's evidence; the console runs it on every draft and
sends a misquoted figure back for correction. In the console, people approve items and enter drivers on the
**Ledger review** screen.

Thin slice in the chat: attach `data/synthetic/tb_2026-09.csv` and ask "Load this trial balance for SYNBANK,
September 2026, map it to IFRS statements with policy gaps, and propose an IT cost allocation to the business lines by
FTE." Approve the rule and enter FTEs on Ledger review, then ask it to run the allocation and explain the result.

### Step 7: peer results search (`volt_ledger/peers.py`, `data/peers/peers.json`)

For internal benchmarking only: peer figures are not reproduced in client deliverables.

- `data/peers/peers.json` is built by `tools/make_peers.py` from the 24 Nov 2026 corpus manifest. It holds 23 peers
  (Big 6, mid-size banks, credit unions, insurers, Maple 8 pensions, asset managers) with fiscal year ends, cadence,
  estimated release lags (P2), registered investor-relations domains, URL templates and the corpus documents with
  their hashes.
- `resolve_peer_period` works out each peer's latest released period from its fiscal calendar. A named period that
  is not out yet comes back `not_yet_released`; it is never swapped for the prior period.
- `fetch_peer_documents` downloads PDFs in parallel (8 at once, 2 per domain), only from a peer's registered domains
  (news wires are accepted as secondary). Off-domain redirects, non-PDF responses and scanned PDFs are refused.
  Files are stored by SHA-256, and a second fetch of the same URL creates nothing new.
- `peer_metrics` reads the supplementary pack with pdfplumber. A figure is accepted only where net interest income
  plus non-interest income equals the printed total revenue in the requested quarter's column and the next two (P5),
  and the column is found from the page header (P6). Otherwise the peer is reported as not verified.
- `import_corpus` loads the corpus files a person downloaded, checking each hash against the manifest.

Verified on the corpus: RBC, TD, BMO, Scotiabank, CIBC, National Bank, EQB, Laurentian and ATB all tie. Desjardins,
Servus and the insurers are not verified yet; the insurers need an IFRS 17 pack reader.

Routes: `/v1/tools/resolve_peer_period`, `/v1/tools/fetch_peer_documents`, `/v1/tools/peer_metrics`. Each writes
evidence with display values, so the console's figure gate checks quoted peer figures too. Set
`VOLT_LEDGER_PEER_FILES` for where PDFs are kept (default: `peer_files` next to the database) and
`VOLT_LEDGER_MAILBOX` for the contact address in the User-Agent (use a shared research mailbox, never a person's).

## Tests

| File | What it proves |
|---|---|
| `tests/unit/test_money.py` | Amount parsing and formatting are exact; bad amounts are refused |
| `tests/unit/test_ingest.py` | Every row of the synthetic TB is stored; bad rows are rejected with reasons; re-ingesting is a no-op |
| `tests/unit/test_ontology.py` | Presentation and calculation queries; one canonical node per XBRL name |
| `tests/unit/test_posting.py` | Validation, reversals, period locks, idempotency, append-only tables |
| `tests/unit/test_mapping.py` | Coverage of every account, all 8 gap types, traceability to TB rows, review routing, two-stage approval |
| `tests/api/test_api.py` | Token required, integer-string amounts, refusals in the envelope, person-only review routes |
| `tests/unit/test_allocation.py` | Golden IT allocation and 100.00 three-way split; approval, missing drivers, replay, bad rules |
| `tests/unit/test_reporting.py` | Golden income statement, balance-sheet tie, NII, efficiency and loan-to-deposit; the safe evaluator; the gate |
| `tests/property/test_properties.py` | P1 to P10 from `docs/phase3-engine.md`, on random data |
