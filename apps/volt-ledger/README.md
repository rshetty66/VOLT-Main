# VOLT Ledger Brain

The deterministic accounting engine behind VOLT's accounting-policy and ledger work. Claude in the VOLT Console
reads, maps and explains; this service does every calculation and keeps the records. See `docs/` for the approved
design: `intent.md`, `spec.md`, `ratio-catalogue.md` and the Phase 2 to 5 specs.

Status: Phase 6 steps 1 to 3 are built (ingestion, ontology loader, posting service), plus the engine side of step 4
(mapping, policy gaps, review queue). The HTTP API, the console tools that let Claude call these, and the allocation
engine come next. The system prompts Claude will use are in `prompts/`.

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

## Tests

| File | What it proves |
|---|---|
| `tests/unit/test_money.py` | Amount parsing and formatting are exact; bad amounts are refused |
| `tests/unit/test_ingest.py` | Every row of the synthetic TB is stored; bad rows are rejected with reasons; re-ingesting is a no-op |
| `tests/unit/test_ontology.py` | Presentation and calculation queries; one canonical node per XBRL name |
| `tests/unit/test_posting.py` | Validation, reversals, period locks, idempotency, append-only tables |
| `tests/unit/test_mapping.py` | Coverage of every account, all 8 gap types, traceability to TB rows, review routing, two-stage approval |
| `tests/api/test_api.py` | Token required, integer-string amounts, refusals in the envelope, person-only review routes |
| `tests/property/test_properties.py` | P1 to P4 and P7 to P10 from `docs/phase3-engine.md`, on random data |
