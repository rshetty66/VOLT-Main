# VOLT Ledger Brain: Phase 3 deterministic engine spec

Status: approved 24 Nov 2026 (A19 approved for now). Date: 24 Nov 2026. Builds on `spec.md` (sections 3 and 4), `phase2-ontology.md` and
`ratio-catalogue.md`.

This is the computational core. The language model calls it through the console's `ledger_*` tools; it never does
these calculations itself. Everything here is plain Python 3.12, SQLite and the standard library `decimal` module.

## 1. Ground rules for every function

1. **Money is an integer number of minor units (cents).** The type is `int`. A `float` never touches money, not even
   for a moment. Parsing goes text to `Decimal` to `int`, never through `float`.
2. **Rates, ratios and driver values are `Decimal`.** The decimal context is fixed at 34 digits of precision and
   `ROUND_HALF_EVEN` (banker's rounding). Every result records the rounding rule it used.
3. **Too much precision is an error, not a rounding.** An amount like `10.005` USD is rejected with a reason, because
   silently rounding source data hides problems.
4. **Append-only is enforced by the database, not just by the code.** SQLite triggers refuse every `UPDATE` and
   `DELETE` on ledger, evidence, mapping and driver tables. A bug in Python still cannot change history.
5. **One writer.** Every write to the proposal ledger goes through `post_journal_entry`. Reversals and allocations
   call it too.
6. **Every call writes one evidence record** in the same database transaction as the data it describes. Either both
   are stored or neither is.
7. **Same inputs, same outputs.** No clocks, random numbers or dictionary ordering in results. Ties are broken by
   sorting on ids.

## 2. Package layout

```
apps/volt-ledger/
  pyproject.toml
  volt_ledger/
    money.py        parse and format amounts; currency minor units
    store.py        SQLite connection, schema, append-only triggers, transactions
    evidence.py     write evidence records, SHA-256 hash chain, verify the chain
    ingest.py       trial balance and statement-table ingestion
    ontology.py     elements, associations, loader, graph queries
    posting.py      post_journal_entry, reverse_journal_entry, period locks
    balances.py     get_balances, tie_out, tie_out_control, drilldown
    allocation.py   allocation rules and run_allocation
    metrics.py      metric registry and compute_ratio (safe formula evaluator)
    gate.py         check_output (gates G1 to G6)
    api.py          FastAPI routes the console calls
  data/
    ontology/       minimum viable graph (JSON-LD)
    metrics/        default metric registry (from ratio-catalogue.md)
    synthetic/      synthetic bank data set (A2, A15)
  tests/
    unit/  property/  golden/  api/
```

## 3. Money

```python
# volt_ledger/money.py
MINOR_UNITS: dict[str, int] = {"USD": 2, "CAD": 2, "EUR": 2, "GBP": 2, "JPY": 0, "KWD": 3}

class AmountError(ValueError): ...

def parse_amount(text: str, currency: str) -> int:
    """'1,234.56' USD -> 123456. Accepts thousands separators, a leading minus or brackets for negatives.
    Raises AmountError for empty text, non-numbers, unknown currencies or more decimals than the currency has."""

def format_amount(minor: int, currency: str) -> str:
    """123456 USD -> '1,234.56'. Used by the gate to match numbers in narratives exactly."""

def to_wire(minor: int) -> str: ...        # 123456 -> "123456"  (JSON-safe for JavaScript)
def from_wire(text: str) -> int: ...       # "123456" -> 123456, rejects anything but an optional minus and digits
```

Invariants: `parse_amount(format_amount(x, c), c) == x` for every integer `x`; `from_wire(to_wire(x)) == x`.

## 4. Store and evidence

```python
# volt_ledger/store.py
class Store:
    def __init__(self, path: str) -> None: ...          # opens SQLite, WAL mode, foreign keys on, creates schema
    def transaction(self) -> ContextManager[Cursor]: ... # BEGIN IMMEDIATE ... COMMIT, ROLLBACK on any exception

# Schema includes, for each append-only table T:
#   CREATE TRIGGER T_no_update BEFORE UPDATE ON T BEGIN SELECT RAISE(ABORT, 'append-only'); END;
#   CREATE TRIGGER T_no_delete BEFORE DELETE ON T BEGIN SELECT RAISE(ABORT, 'append-only'); END;
```

```python
# volt_ledger/evidence.py
@dataclass(frozen=True)
class EvidenceRecord:
    evidence_id: str; tool: str; inputs: dict; outputs: dict; sources: list[dict]
    code_version: str; actor: str; prev_hash: str; hash: str

def write_evidence(cur: Cursor, tool: str, inputs: dict, outputs: dict,
                   sources: list[dict], actor: str) -> EvidenceRecord:
    """hash = sha256(prev_hash + canonical_json(tool, inputs, outputs, sources, code_version, actor)).
    canonical_json sorts keys and uses no spaces, so the same record always hashes the same."""

def verify_chain(store: Store) -> list[str]:
    """Recomputes every hash in order. Returns the ids of broken records; an empty list means intact."""
```

## 5. Posting service

### 5.1 Data shapes

```python
@dataclass(frozen=True)
class LineIn:
    account_id: str            # an element with element_type == "account"
    debit: int = 0             # minor units, >= 0
    credit: int = 0            # minor units, >= 0; exactly one of debit/credit is > 0
    currency: str = "USD"
    dimensions: Mapping[str, str] = field(default_factory=dict)   # e.g. {"BusinessLine": "Retail"}

@dataclass(frozen=True)
class JournalIn:
    idempotency_key: str
    period: str                # "YYYY-MM"
    kind: Literal["adjustment", "reclass", "allocation", "gaap_adjustment", "reversal"]
    description: str
    lines: Sequence[LineIn]
    gaap: Literal["base", "us-gaap", "ifrs"] = "base"   # A13: GAAP views via adjustment journals
    source_refs: Sequence[dict] = ()                     # documents, gaps or evidence that justify it

@dataclass(frozen=True)
class JournalOut:
    journal_id: str; evidence_id: str; created: bool    # created=False when the idempotency key was seen before
```

### 5.2 The single write path

```python
class PostingError(Exception): code: str   # "unbalanced", "empty", "bad_line", "unknown_account",
                                           # "not_posting_account", "period_locked", "bad_period",
                                           # "mixed_currency", "idempotency_conflict", "already_reversed"

def post_journal_entry(store: Store, journal: JournalIn, actor: str) -> JournalOut:
    """The only function that writes journal rows. Inside one transaction:
    1. If the idempotency key exists with the same payload hash, return that journal (created=False).
       Same key with a different payload raises idempotency_conflict.
    2. Validate: at least 2 lines; each line has exactly one side > 0; accounts exist and are posting
       accounts; dimension members exist; one currency per journal in v1; period is well formed.
    3. Refuse if the period is locked.
    4. Refuse unless sum(debits) == sum(credits), as integers.
    5. Insert header, lines and one evidence record. Commit."""
```

The tool `propose_journal_entry` (spec section 4) is a thin wrapper that converts wire strings to integers and
calls this function. All journals have status `proposed` (the brain never posts to a client GL).

### 5.3 Reversals

```python
def reverse_journal_entry(store: Store, journal_id: str, period: str, reason: str,
                          idempotency_key: str, actor: str) -> JournalOut:
    """Builds a journal with every line's debit and credit swapped, kind='reversal',
    reverses_journal_id=journal_id, and posts it through post_journal_entry.
    A journal can be reversed once (unique index on reverses_journal_id); a reversal cannot be reversed
    (re-propose the original instead). The reversal period must be open; it may be later than the original."""
```

### 5.4 Period locks

```python
def lock_period(store: Store, period: str, actor: str, reason: str) -> str: ...
def unlock_period(store: Store, period: str, actor: str, reason: str) -> str: ...  # engagement lead only
def is_locked(store: Store, period: str) -> bool: ...   # state = the latest lock or unlock event for the period
```

Locks are events, not flags, so the history of who locked and unlocked what is kept. In the console only the
engagement lead role can unlock.

## 6. Balances, tie-outs and drilldown

```python
@dataclass(frozen=True)
class BalanceQuery:
    period: str
    element_ids: Sequence[str]                 # accounts or concepts; concepts are expanded through mappings
    dimensions: Mapping[str, str] = field(default_factory=dict)
    gaap: str = "base"                         # "base" or a GAAP view that adds its adjustment journals
    include: Literal["tb_only", "tb_and_approved", "tb_and_all_proposals"] = "tb_and_approved"

def get_balances(store: Store, q: BalanceQuery) -> dict[str, int]:
    """Signed balance per element (debit positive). Balance sheet elements: TB closing balance for the period
    plus included proposal lines up to and including the period. Income statement elements: TB year-to-date
    plus included proposal lines in the same fiscal year up to the period (A16, A17)."""

def tie_out(store: Store, tb_doc: str, fs_doc: str, gaap: str, period: str) -> TieOutResult:
    """For every statement line: TB-derived amount (through mappings and calculation arcs), statement amount,
    difference. Passes only if every difference is 0."""

def tie_out_control(store: Store, account_id: str, dimension: str, period: str) -> TieOutResult:
    """A control account must equal the sum of its rows across all members of a dimension, including an
    explicit 'Unassigned' member. Catches business-line or stage splits that lose or double money."""

def drilldown(store: Store, statement_line: str, gaap: str, period: str) -> DrillNode:
    """Tree from a statement line to concepts, to accounts, to TB rows and proposal journal lines, to their
    evidence and source document (file, row, or page and table). Every leaf is a stored record."""
```

## 7. Allocation engine

**This is driver-based allocation logic.** A cost pool is split across targets in proportion to a measured driver
(FTEs, transaction counts, balances or RWA) for the same period. Every driver value is a stored, sourced input
(`driver_value`, uploaded or typed in by a person), never an estimate by the model. The engine does not do
activity-based costing (cost pools built from activities and activity rates), step-down or reciprocal allocation,
or fixed-percentage splits in v1; each can be added later as a new rule type.

### 7.1 Rules

```python
@dataclass(frozen=True)
class AllocationRule:
    rule_id: str
    pool_accounts: Sequence[str]               # e.g. the IT cost accounts
    pool_filter: Mapping[str, str]             # e.g. {"CostCentre": "IT01"}
    basis: Literal["fte", "transaction_count", "balance", "rwa"]
    target_dimension: str                      # e.g. "BusinessLine"
    targets: Sequence[str]                     # members that receive cost
    rounding: Literal["largest_remainder"] = "largest_remainder"
```

The language model may propose a rule (which pool, which basis, which targets) and explain the result. A person
approves the rule. The engine executes it.

### 7.2 Execution

```python
@dataclass(frozen=True)
class AllocationResult:
    rule_id: str; period: str; pool: int; currency: str
    drivers: dict[str, Decimal]                # per target, each with its driver_value evidence id
    shares: dict[str, int]                     # minor units per target; sum == pool exactly
    journal_id: str; evidence_id: str

def run_allocation(store: Store, rule: AllocationRule, period: str,
                   idempotency_key: str, actor: str) -> AllocationResult:
    """1. pool = get_balances over pool_accounts and pool_filter (one currency).
    2. drivers = stored driver_value rows for basis, period and each target; 'balance' reads get_balances
       instead. Any missing, negative or all-zero driver raises AllocationError with the list.
    3. shares = largest_remainder(pool, drivers).
    4. Propose one allocation journal through post_journal_entry: credit the pool accounts in the pool cost
       centre, debit the same natural accounts with the target dimension set, so expense type is kept and
       allocated cost is visible as kind='allocation'."""

def largest_remainder(pool: int, weights: Mapping[str, Decimal]) -> dict[str, int]:
    """Exact split of an integer pool by weights.
    raw_i = pool * w_i / sum(w); base_i = raw_i truncated toward zero; leftover = pool - sum(base).
    Give one minor unit (with the pool's sign) to each of the |leftover| targets with the largest fractional
    part; ties go to the target id that sorts first. Result sums to pool exactly, and no share differs from
    its exact value by 1 minor unit or more."""
```

Worked example: IT pool 100,000.00 USD (10,000,000 cents), FTEs Retail 120, Commercial 45, Wealth 35.
Exact shares 6,000,000 / 2,250,000 / 1,750,000 cents: no rounding needed. With FTEs 1, 1, 1 on 100.00 the exact
shares are 33.333... each: base 33.33 x 3 = 99.99, leftover 1 cent goes to the first target by id. Sum 100.00.

Step-down and reciprocal allocations (support functions allocating to each other) are out of v1 scope.

## 8. Metrics

```python
def compute_ratio(store: Store, metric_id: str, period: str,
                  dimensions: Mapping[str, str] = {}, gaap: str = "base") -> RatioResult:
    """Loads the metric definition, resolves every input through get_balances or driver_value rows, evaluates
    the formula and returns value (Decimal string), each input with its evidence id, and the definition version.
    Missing input: status 'not_computable' with the missing list. Zero denominator: status 'undefined'."""
```

Formulas are parsed by a small evaluator that knows only numbers, concept ids, driver keys, `+ - * /`, brackets and
the functions `avg(x)` (opening and closing average), `prior(x)` (previous period), `annualise(x)` and `sum(...)`.
Python's `eval` is never used, so a stored formula cannot run code.

## 9. Ingestion

```python
def ingest_trial_balance(store: Store, upload_path: str, columns: ColumnMap, period: str,
                         currency: str, actor: str) -> IngestResult:
    """Reads CSV or XLSX. Each row is stored as a tb_row or listed in rejected with a reason.
    Invariant: len(stored) + len(rejected) == number of data rows in the file.
    Reports total debits, total credits and whether they are equal (an unbalanced TB is stored but flagged)."""
```

PDF statement extraction (`extract_statement_tables`) is specified in Phase 4, because reading PDF tables reliably
needs a model-assisted step whose output is then checked by code.

## 10. Validation harness (test plan)

Tests use `pytest` and `hypothesis`. Hypothesis generates thousands of random inputs per property and shrinks any
failure to the smallest example, which is how we prove rules hold for all inputs rather than a few examples.

### 10.1 Property-based tests

| Id | Property | Generator |
|---|---|---|
| P1 | A journal is stored if and only if debits equal credits; an unbalanced one raises `unbalanced` and writes nothing | Random lines on random accounts, amounts 0 to 10^15 cents, then one line nudged by +/- 1 cent |
| P2 | Original plus its reversal leaves every account and dimension balance exactly as before | Random ledger state, random journal, then its reversal |
| P3 | No journal can be written into a locked period, and the failed attempt writes no rows and no evidence | Random periods, random lock and unlock sequences |
| P4 | Posting the same journal twice with the same key gives one journal; same key with a different payload raises | Random journals, replayed |
| P5 | `largest_remainder` sums to the pool exactly, and each share is within 1 minor unit of its exact value | Random pools (including negative and 0), 1 to 50 targets, random positive weights |
| P6 | After `run_allocation`, the pool cost centre is reduced by the pool and the targets increase by exactly the pool in total | Random pools and drivers on the synthetic chart |
| P7 | `parse_amount(format_amount(x)) == x` and wire round-trips are exact | Random integers and currencies |
| P8 | Any UPDATE or DELETE on an append-only table fails, whatever the row | Random rows, direct SQL |
| P9 | Editing any stored evidence row is detected by `verify_chain` | Random evidence chains, one byte changed in a copy |
| P10 | Ingestion accounts for every row: stored + rejected == input | Random CSVs with good, malformed, blank and duplicate rows |

### 10.2 Golden tests (known answers to the cent)

Hand-checked cases stored as files in `tests/golden/`: the synthetic TB maps to statements that tie exactly; a
three-line reclass journal; the IT allocation above; the 100.00 three-way split; NII, efficiency ratio and loan-to-deposit
on the synthetic data, each against a value computed by hand in a spreadsheet and recorded with the
spreadsheet's file name.

### 10.3 API tests

FastAPI's test client calls every route with good and bad input: amounts as numbers instead of strings are
refused; a missing or wrong `VOLT_LEDGER_TOKEN` is refused; every successful call returns an `evidence_id`.

### 10.4 Static checks

- A CI step fails if `float(` or a float literal appears in `money.py`, `posting.py`, `balances.py` or
  `allocation.py`.
- `ruff` for style, `mypy --strict` for types.
- The suite runs on every pull request that touches `apps/volt-ledger` (a new GitHub Actions job, added in Phase 6).

## 11. Acceptance checklist for Phase 3

- [ ] Every function above has a signature, inputs, outputs and invariants (this document).
- [ ] No money path uses floating point (rule 1, static check 10.4).
- [ ] Double entry, append-only, single writer, idempotency and period locks are each enforced in code and tested by
      a property (P1 to P4, P8).
- [ ] Allocations tie to the pool exactly, with a stated rounding rule (P5, P6).
- [ ] Every number can be drilled down to a stored source row or page (`drilldown`).
- [ ] Every write is covered by a tamper-evident evidence record (P9).

## 12. Assumptions added in this phase

| Id | Assumption | Validate by |
|---|---|---|
| A16 | Trial balances give closing balances; income statement accounts are year-to-date | First real client file |
| A17 | Fiscal year = calendar year in v1; a client fiscal calendar is a later setting | Phase 6 step 1 |
| A18 | One currency per journal and per engagement in v1; multi-currency and translation are out of scope (intent.md) | Phase 6 |
| A19 | Allocations move cost between business lines on the same natural account (kind = allocation), rather than to separate "allocated in / out" accounts | Approved for now (24 Nov 2026); revisit in Phase 5 |
| A20 | Banker's rounding (half-even) for ratios; ratios shown to 4 decimal places | Phase 5 |
