# VOLT Ledger Brain: Phase 4 language-model layer spec

Status: draft for approval. Date: 24 Nov 2026. Builds on `spec.md` section 5 (LLM boundary), `phase2-ontology.md`
and `phase3-engine.md`.

For the MVP the model is Claude, running in the VOLT Console's existing tool loop, steered by system prompts and
few-shot examples. Nothing is fine-tuned in v1. Section 6 specifies the fine-tuning path for later.

## 1. Where the model sits

```
Person in VOLT Console
   -> Rudra (console orchestrator, existing)
        -> "ledger" specialist run (new): system prompt from section 4 + ledger_* tools
             -> ledger_* tool call -> volt-ledger (Phase 3 engine) -> result + evidence_id
             -> each evidence_id is added to the console's existing source register as a citable key (L01, L02...)
        -> draft answer -> ledger_check_output (gates G1 to G6) -> console research gates -> person
```

Reuse: the console already keeps a source register (`server/research.ts`), where every tool result gets a key
(`S01`...) and the model may cite only those keys, checked by code gates. The ledger plugs into the same mechanism:
each ledger result gets an `L` key that maps one-to-one to a volt-ledger `evidence_id`. Two layers of gates then
apply: the ledger's own (exact numbers, balances, tie-outs) and the console's (citations, residue).

## 2. Tool-use protocol

### 2.1 Envelope

Every `ledger_*` tool returns the same envelope to the model:

```json
{
  "status": "ok",
  "evidence_id": "E000231",
  "cite_as": "L07",
  "data": { "...": "tool-specific, see 2.2" },
  "display": { "amounts": { "nii": "48,210,330.17 USD" } },
  "warnings": []
}
```

- `status` is one of `ok`, `not_computable`, `undefined`, `refused`, `error`. On anything but `ok`, `data` says why
  (for example the missing inputs), and the model must say so in plain words rather than work around it.
- `display` carries every number already formatted. The model copies these strings; it never reformats, rounds or
  combines them. Gate G1 matches numbers in the final text against these exact strings.
- Amounts in `data` are integer minor units as strings (spec section 1). The model does not need to read them.

### 2.2 Tool schemas (what the model sends)

JSON Schema, as the console will register them. Required fields only are shown as required.

```json
{
  "name": "ledger_map_line_item",
  "description": "Propose the canonical concept for one trial-balance account. Use ledger_get_ontology_context first. If no concept fits, or a policy decision is needed, call ledger_flag_policy_gap instead.",
  "input_schema": {
    "type": "object",
    "required": ["account_id", "concept_id", "confidence", "rationale", "source_refs"],
    "properties": {
      "account_id": {"type": "string", "description": "acct:<client>:<code>"},
      "concept_id": {"type": "string", "description": "canon:<Name> from the ontology"},
      "confidence": {"type": "number", "minimum": 0, "maximum": 1},
      "rationale": {"type": "string", "maxLength": 600},
      "uncertainty": {"type": "array", "items": {"type": "string"}, "description": "What could make this mapping wrong"},
      "source_refs": {"type": "array", "items": {"type": "string"}, "description": "cite_as keys used, e.g. L03"}
    }
  }
}
```

```json
{
  "name": "ledger_flag_policy_gap",
  "input_schema": {
    "type": "object",
    "required": ["element_ids", "gap_type", "decision_needed", "standard_refs", "rationale", "confidence"],
    "properties": {
      "element_ids": {"type": "array", "items": {"type": "string"}, "minItems": 1},
      "gap_type": {"enum": ["recognition_basis_mixed", "stage_not_captured", "catch_all_account",
                            "dimension_in_account", "lease_model_difference", "capitalisation_policy",
                            "gross_vs_net", "unmappable_sign", "other"]},
      "decision_needed": {"type": "string"},
      "standard_refs": {"type": "array", "items": {"type": "string"},
                        "description": "e.g. 'IFRS 9 B5.4.1'. Stored as [UNVERIFIED] unless a standard_paragraph element exists"},
      "rationale": {"type": "string"},
      "confidence": {"type": "number", "minimum": 0, "maximum": 1}
    }
  }
}
```

```json
{
  "name": "ledger_propose_journal",
  "description": "Propose a journal in the proposal ledger. Amounts must be copied from earlier tool results (cite them in source_refs); never calculate an amount yourself.",
  "input_schema": {
    "type": "object",
    "required": ["idempotency_key", "period", "kind", "description", "lines", "source_refs"],
    "properties": {
      "idempotency_key": {"type": "string"},
      "period": {"type": "string", "pattern": "^[0-9]{4}-(0[1-9]|1[0-2])$"},
      "kind": {"enum": ["adjustment", "reclass", "gaap_adjustment"]},
      "gaap": {"enum": ["base", "us-gaap", "ifrs"]},
      "description": {"type": "string"},
      "lines": {"type": "array", "minItems": 2, "items": {
        "type": "object", "required": ["account_id", "side", "amount_minor", "amount_source"],
        "properties": {
          "account_id": {"type": "string"},
          "side": {"enum": ["debit", "credit"]},
          "amount_minor": {"type": "string", "pattern": "^[0-9]+$"},
          "amount_source": {"type": "string", "description": "cite_as key of the result this amount was copied from"},
          "dimensions": {"type": "object", "additionalProperties": {"type": "string"}}
        }}},
      "source_refs": {"type": "array", "items": {"type": "string"}}
    }
  }
}
```

The console checks before forwarding that every `amount_minor` appears verbatim in the `data` of the result named by
`amount_source`. A journal whose amounts the model invented is refused before it reaches the ledger. Allocation
journals are never proposed this way; they come only from `ledger_run_allocation`.

The remaining tools follow the same pattern; their inputs are the Phase 3 signatures with ids and strings only:

| Tool | Required inputs |
|---|---|
| `ledger_get_ontology_context` | `query` or `element_id`, optional `gaap` |
| `ledger_get_balances` | `period`, `element_ids`, optional `dimensions`, `gaap`, `include` |
| `ledger_tie_out` | `tb_doc`, `fs_doc`, `gaap`, `period` |
| `ledger_reverse_journal` | `journal_id`, `period`, `reason`, `idempotency_key` |
| `ledger_run_allocation` | `rule_id` (an approved rule), `period`, `idempotency_key` |
| `ledger_propose_allocation_rule` | `pool_accounts`, `pool_filter`, `basis`, `target_dimension`, `targets`, `rationale` (goes to review; a person approves it) |
| `ledger_compute_ratio` | `metric_id` or `pack`, `period`, optional `dimensions`, `gaap` |
| `ledger_retrieve_standard` | `query` or `concept_id`, optional `gaap` (section 3) |
| `ledger_drilldown` | `statement_line`, `gaap`, `period` |
| `ledger_check_output` | `draft`, `cited_keys` |

Not available to the model: `record_review_decision`, `record_driver_values`, `lock_period`, `unlock_period`,
`ingest_trial_balance` (the console calls ingestion when a person uploads a file).

### 2.3 Evidence written after every call

volt-ledger writes the evidence record (Phase 3, section 4). The console adds one line to its source register:
`{key: "L07", title: "<tool>: <short description>", publisher: "volt-ledger", type: "calculation" | "client
document" | "ontology" | "standard reference", evidence_id: "E000231"}`. The research bundle download already writes
the register to `sources/registry.jsonl`, so every ledger number in a download traces to its evidence id.

## 3. Retrieval (RAG)

### 3.1 What is searched in v1

There is no licensed standards text in v1 (A8), so the searchable corpus is:

| Corpus | Contents | Source |
|---|---|---|
| Ontology | Concept labels, XBRL names, presentation lines, gap types, reconciliation paths | `phase2-ontology.md` loader data |
| Standard references | Standard, paragraph number, a one-line topic written by us (not standards text), GAAP | Hand-curated list, every entry [UNVERIFIED] until checked |
| Client documents | Accounting policy notes and statement tables from the uploaded PDF, by page | Upload |
| VOLT skill packs | Existing VOLT methods (for example IFRS 9, IFRS 17, COA design) | `plugins/volt/skills` |

### 3.2 How retrieval works

1. **Ontology anchor first.** The query is matched to canonical concepts (exact label, synonym and XBRL name match).
   For each hit, the graph is expanded one step along `cites`, `reconciliation_path` and `presentation` arcs, for
   every GAAP in scope. So a question about "lease liability" lands on `canon:LeaseLiabilities` and brings back both
   the IFRS 16 and ASC 842 references and the reconciliation path between them, even if the words in the question
   match only one.
2. **Keyword search (BM25)** over all four corpora, using SQLite's built-in FTS5 full-text index. No extra service.
3. **Merge** the two lists by reciprocal rank fusion, keep the top 12, and return each with its source and `cite_as` key.

Dense vector search is left out of v1. It needs an embeddings provider (Anthropic does not offer one; Voyage AI is
the usual pairing) and a vector index, and on a corpus this small and this structured, the ontology anchor does the
work vectors would do. It is added when licensed standards text is loaded (decision for later, section 8).

## 4. Prompt templates

Both prompts are the system prompt of a dedicated "ledger" specialist the console runs. Variables are in
`{{double_braces}}` and are filled by the console from stored data, never by the model.

### 4.1 Policy reconstruction

```text
You are the VOLT Ledger policy analyst. You reconstruct a financial institution's accounting policies from its own
financial statements and trial balance, for review by an engagement lead and then the client's controller.

Client: {{client_name}} ({{institution_type}}), primary GAAP {{primary_gaap}}, other views {{other_gaaps}},
period {{period}}.

Rules you must follow:
1. You do not calculate. Every amount, total, difference, ratio or percentage you mention must be copied exactly
   from the "display" strings of a ledger tool result, and cited with that result's key (for example [L07]).
   If you need a number no tool has given you, call a tool. If no tool can give it, say it is not available.
2. Every statement about the client's policy cites the page of the client's statements it comes from ([L03 p.47]).
   Every statement about what a standard requires cites a standard reference; if the reference is not backed by
   a stored paragraph, write it with [UNVERIFIED] after it. Never quote standards text. Never invent a paragraph.
3. If the statements are silent or ambiguous on a policy, say so and record it as an uncertainty. Do not fill
   the gap from general practice and present it as the client's policy.
4. You propose; people decide. Nothing you produce is final until reviewed.

Task: for each policy area in {{policy_areas}}, determine the client's policy and its ledger impact.

Return only JSON matching this schema:
{
  "determinations": [
    {
      "policy_area": "string, e.g. 'Loan origination fees'",
      "client_policy": "plain-language statement of what the client does",
      "client_evidence": ["cite keys with page, e.g. 'L03 p.47'"],
      "standard_basis": [{"ref": "e.g. 'IFRS 9 B5.4.1'", "verified": false}],
      "consistent_with_standard": "yes | no | unclear",
      "ledger_impact": {
        "affected_accounts": ["acct ids"],
        "proposed_action": "none | reclass | gaap_adjustment | coa_change",
        "tool_calls_made": ["cite keys of any ledger_propose_journal or ledger_flag_policy_gap results"]
      },
      "confidence": 0.0,
      "uncertainty_flags": ["what could make this wrong, or what information is missing"]
    }
  ],
  "not_determined": [{"policy_area": "string", "reason": "string"}]
}
```

Few-shot example (one of three kept with the prompt; amounts are from the synthetic data set):

```json
{
  "determinations": [{
    "policy_area": "Loan origination fees",
    "client_policy": "Origination fees on retail mortgages are recognised in fee income when received.",
    "client_evidence": ["L03 p.41"],
    "standard_basis": [{"ref": "IFRS 9 B5.4.1-B5.4.3", "verified": false}],
    "consistent_with_standard": "no",
    "ledger_impact": {
      "affected_accounts": ["acct:SYNBANK:4100"],
      "proposed_action": "reclass",
      "tool_calls_made": ["L11", "L12"]
    },
    "confidence": 0.78,
    "uncertainty_flags": [
      "Note 2 does not say whether fees are deferred; the conclusion rests on account 4100 holding both fee types.",
      "The size of the fees that are integral to the yield is not in the TB; L12 is a gap flag, not an amount."
    ]
  }],
  "not_determined": []
}
```

### 4.2 Chart-of-accounts diagnosis

```text
You are the VOLT Ledger chart-of-accounts analyst. You map a client's trial-balance accounts to VOLT's canonical,
XBRL-labelled concepts and diagnose where the chart of accounts cannot support the reporting the client needs:
statutory ({{gaaps}}), management reporting, FP&A, and business-line and product profitability.

Rules you must follow:
1. Use ledger_get_ontology_context before every mapping. Map each account to exactly one canonical concept with
   ledger_map_line_item. Never create a new category when a canonical concept exists.
2. If an account mixes economic events, carries a dimension in its code, holds a catch-all balance, or has a sign
   that does not fit its likely concept, do not force a mapping: call ledger_flag_policy_gap.
3. Confidence is your honest probability that a reviewer will accept the mapping. Use values below 0.90 whenever
   the account name is generic, the balance sign is unusual, or two concepts fit.
4. You do not calculate. Coverage counts, balances and tie-out differences come from ledger_get_balances and
   ledger_tie_out; copy their display strings and cite them.
5. Recommendations for a target chart of accounts are proposals for the COA Designer, not changes.

Work in this order: map all accounts, flag gaps, run ledger_tie_out, then write the diagnosis.

Return only JSON matching this schema:
{
  "coverage": {"accounts_total_cite": "cite key", "mapped_cite": "cite key", "gaps_cite": "cite key"},
  "tie_out": {"status": "pass | fail", "cite": "cite key", "failing_lines": ["statement line ids"]},
  "gaps": [{"gap_cite": "cite key", "gap_type": "string", "summary": "string", "reporting_blocked": ["statutory | management | fpa | business_line | product"]}],
  "coa_recommendations": [
    {"recommendation": "string, e.g. 'Move business line from account code to a BusinessLine dimension'",
     "affected_accounts": ["acct ids"], "reason_cites": ["cite keys"], "priority": "high | medium | low"}
  ],
  "confidence": 0.0,
  "uncertainty_flags": ["string"]
}
```

The coverage counts appear only as cite keys: the console renders the numbers from the cited results, so the model
never types a count.

### 4.3 Narrative

The client-facing explanation (for example "why did the efficiency ratio move?") uses the console's existing
deliverable format, with the rules from 4.1 (no calculation, cite every number and claim). It is always reviewed (A9).

## 5. Reading PDF financial statements

Reading numbers out of a PDF is where a language model is most likely to slip, so v1 keeps the model away from it:

1. **Code extracts the tables.** `extract_statement_tables` uses `pdfplumber` on text-based PDFs to pull every table
   cell with its page, table index, row and column position. Scanned (image-only) PDFs are out of scope in v1 and are
   refused with a clear message.
2. **The model only labels.** It is shown the extracted table (with cell ids, not numbers to retype) and says which
   rows are which statement lines ("row 7 is Net interest income"). Its output is a list of `{cell_id, concept_id}`
   pairs, so it never transcribes a number.
3. **Code checks the result.** The calculation arcs are applied to the printed figures: if the labelled rows do not
   add up to the printed subtotals, the labelling is rejected and sent back once, then to a person.
4. **Code ties statements to the TB** (`tie_out`).

## 6. Fine-tuning strategy (after the MVP)

Fine-tuning is worth doing only once there are enough reviewed decisions to learn from, and it does not change the
boundary: a fine-tuned model still calls tools for every number.

### 6.1 Dataset: Accounting Instruction Tuning (AIT)

One record per reviewed determination:

```json
{
  "id": "ait-000123",
  "input": {
    "task": "policy_reconstruction | coa_mapping | gap_detection",
    "institution_type": "bank",
    "gaaps": ["ifrs", "us-gaap"],
    "fact_pattern": "Account 4100 'Loan and card fees', credit balance; policy note says fees recognised when received...",
    "tb_context": [{"account": "4100", "name": "Loan and card fees", "sign": "credit", "size_band": "material"}],
    "ontology_context": ["canon:FeeAndCommissionIncome", "canon:InterestIncome"]
  },
  "output": {
    "determination": "...same JSON shape as section 4...",
    "tool_calls": [{"name": "ledger_flag_policy_gap", "input": {"...": "..."}}],
    "citations": ["IFRS 9 B5.4.1", "client p.41"]
  },
  "label_source": "engagement_lead_approved | client_approved | synthetic",
  "reviewer_edits": "diff between model proposal and approved version"
}
```

- Amounts are replaced by size bands ("material", "small") and signs. The dataset never teaches the model to produce
  numbers.
- Sources: reviewed decisions from real engagements, only with client consent and after removing client names and
  identifiers; plus synthetic cases generated from the ontology's gap types and checked by a person.
- Target before a first training run: about 2,000 reviewed records across at least 3 institution types, held out by
  client (no client appears in both training and test data) [ASSUMPTION A21].

### 6.2 Training

- Method: LoRA or QLoRA adapters on a Mistral-Small base model, as the master prompt proposes. Rank, learning rate
  and epochs are set by a small sweep on the held-out set [UNVERIFIED: no hyperparameters are recommended here
  without that sweep].
- Evaluation: the same Phase 5 metrics as Claude (mapping precision and recall against human review, gap recall on
  seeded gaps, citation validity, and zero numbers not produced by tools). The fine-tuned model replaces Claude for a
  task only if it matches or beats Claude on all of them.
- Hosting: a GPU inference endpoint, which does not fit on the current Render plan. This is a cost and hosting decision
  for later (section 8).

## 7. Validation checklist (Phase 4 acceptance)

- [ ] Does the model ever output a number not produced by a tool? Test: 50 synthetic runs, gate G1 on every final
      answer; also the journal-amount check in 2.2. Pass = zero.
- [ ] Does every policy claim cite a client page or a standard reference? Test: gate G2 and G3 on the same runs, plus
      a person's check on 20 determinations (Phase 5). Pass = zero uncited claims.
- [ ] Is every unbacked standard reference marked [UNVERIFIED]? Pass = all of them.
- [ ] Do both prompt templates return JSON that validates against their schema? Pass = 100% after at most one retry.
- [ ] Do confidence scores mean something? Test: mappings below 0.90 should be rejected by reviewers more often than
      those above. Checked in Phase 5.
- [ ] Does ontology-anchored retrieval return both GAAPs? Test: "lease liability", "expected credit loss", "fee
      income", "software costs" each return IFRS and US GAAP references and the reconciliation path where one exists.
- [ ] Is PDF extraction number-free for the model? Test: the labelling output contains cell ids and concept ids only.

## 8. Decisions for later (not blocking the MVP)

1. Dense vector search and an embeddings provider: when licensed standards text is loaded.
2. Licensing IFRS and FASB standards text (A8).
3. Fine-tuning and GPU hosting: when about 2,000 reviewed records exist.
4. Scanned PDF support (OCR).

## 9. Assumptions added in this phase

| Id | Assumption | Validate by |
|---|---|---|
| A21 | About 2,000 reviewed records across 3 institution types are needed before fine-tuning is worth trying | When the dataset reaches that size |
| A22 | Client financial statements in v1 are text-based PDFs, not scans | First real client file |
| A23 | The ledger specialist runs on the console's configured Claude model (currently the console default), with the console's existing effort settings | Phase 6 step 4 |
