---
name: banking-wiki-trainer
description: >
  This skill should be used when the user asks to "train the wiki on banking",
  "ingest banking documents", "build banking knowledge base",
  "learn from bank docs", "train on financial services content",
  "add banking reference material", "build industry wiki",
  "ingest SOW for banking project", "learn from RFP responses",
  "train on Oracle banking config", "ingest OSFI guidelines",
  "build knowledge from bank interviews", "process discovery notes",
  or needs to systematically ingest banking/financial services documents
  into the project wiki for contextual AI responses.
version: 1.0.0
disable-model-invocation: true
---

# Banking Wiki Trainer

Systematic ingestion and training methodology for building project-specific banking knowledge bases. Transforms raw documents (SOWs, interview notes, config guides, regulatory documents) into structured wiki pages that VOLT agents use for contextual responses.

## When to Use

- Starting a new banking project — ingest all source documents into the wiki
- Client provides new reference material (SOW amendments, policy docs, config exports)
- After discovery workshops — process interview notes into structured knowledge
- Regulatory updates — ingest new OSFI/Basel guidelines relevant to the engagement
- Post-deliverable generation — feed outputs back as learned context

## Ingestion Pipeline

### Step 1: Document Classification

Classify each source document before ingestion:

| Category | Examples | Wiki Section |
|----------|----------|-------------|
| **Governance** | SOW, MSA, Project Charter, RACI | `wiki/governance/` |
| **Discovery** | Interview transcripts, workshop notes, self-assessments | `wiki/discovery/` |
| **Technical** | Config guides, FBDI specs, data dictionaries | `wiki/technical/` |
| **Regulatory** | OSFI guidelines, IFRS standards, Basel frameworks | `wiki/regulatory/` |
| **Process** | Current-state flows, SOPs, pain-point registers | `wiki/processes/` |
| **Architecture** | Solution designs, integration maps, data models | `wiki/architecture/` |
| **Deliverables** | Generated outputs, approved designs, test results | `wiki/deliverables/` |

### Step 2: Entity Extraction

For each document, extract and create wiki pages for:

| Entity Type | What to Capture | Page Format |
|------------|-----------------|-------------|
| **People** | Name, role, org, responsibilities, pain points voiced | `wiki/people/{name}.md` |
| **Systems** | Name, vendor, version, modules, integrations | `wiki/systems/{name}.md` |
| **Processes** | Name, owner, frequency, pain points, automation % | `wiki/processes/{name}.md` |
| **Decisions** | What was decided, by whom, alternatives rejected, date | `wiki/decisions/{slug}.md` |
| **Metrics** | KPI name, current value, target, measurement method | `wiki/metrics/{name}.md` |
| **Risks** | Description, likelihood, impact, mitigation, owner | `wiki/risks/{slug}.md` |
| **Requirements** | ID, description, priority, source, status | `wiki/requirements/{id}.md` |

### Step 3: Cross-Linking

Every wiki page must link to related pages using `[[wikilinks]]`:

```markdown
# GL Close Process

**Owner:** [[John Smith]] (Controller)
**System:** [[Oracle Cloud GL]]
**Frequency:** Monthly
**Current Duration:** 12 business days
**Target Duration:** 5 business days

## Pain Points
- Heavy [[Manual Journal Entries]] (200+/month)
- [[Reconciliation]] done in Excel (see [[Current State Assessment]])
- No automated [[Intercompany Elimination]]

## Related
- [[Cash Management]] depends on GL close
- [[Financial Reporting]] blocked until close complete
- Impacted by [[COA Redesign]] decision
```

### Step 4: Index Maintenance

After each ingestion batch, update:
- `wiki/index.md` — master alphabetical index
- `wiki/overview.md` — narrative summary of wiki contents
- `wiki/log.md` — chronological ingestion log

## Banking-Specific Ingestion Templates

### SOW Ingestion
Extract from Statement of Work:
1. Scope modules (in/out)
2. Timeline and phases
3. Team structure and roles
4. Assumptions and constraints
5. Success criteria
6. Deliverable list with owners

### Interview/Workshop Ingestion
Extract from discovery sessions:
1. Attendees and their roles
2. Current state pain points (verbatim quotes are gold)
3. Workarounds and manual processes
4. Volume metrics (transactions/month, FTEs, time-to-close)
5. Quick wins identified
6. Political dynamics and resistance signals

### Oracle Config Guide Ingestion
Extract from configuration workbooks:
1. Chart of Accounts structure (segments, hierarchies)
2. Ledger and legal entity setup
3. Business unit configuration
4. Approval workflows and limits
5. FBDI template specifications
6. Integration endpoints

### OSFI Guideline Ingestion
Extract from regulatory documents:
1. Guideline number and title
2. Effective date and transition period
3. Key requirements (numbered)
4. Impact on project scope
5. Compliance evidence needed
6. Examination expectations

## Quality Gates

Before marking ingestion complete, verify:

| Gate | Check |
|------|-------|
| **Completeness** | Every source document has at least one wiki page |
| **Cross-linking** | No orphan pages (every page linked from ≥1 other page) |
| **Accuracy** | Metrics and dates match source documents |
| **Currency** | Index and overview reflect latest state |
| **Actionability** | Pain points link to deliverables that address them |

## Training the AI Context

Once wiki is populated, VOLT agents automatically:
1. Search wiki pages for relevant context before generating deliverables
2. Reference specific pain points, metrics, and decisions in outputs
3. Maintain consistency across deliverables (same terminology, same metrics)
4. Flag when a deliverable contradicts a wiki-documented decision

### Contextual Prompt Enhancement

When a user asks VOLT Chat a project question, the system:
```
User: "What's the current close timeline?"
→ Wiki search: [[GL Close Process]] + [[Current State Assessment]]
→ Context injected: "Current close: 12 days, target: 5 days, main blockers: manual JEs, Excel recons"
→ Response: Contextually accurate, project-specific answer
```

## Maintenance Cadence

| Trigger | Action |
|---------|--------|
| New document received | Ingest → classify → extract → link |
| Workshop completed | Process notes within 24 hours |
| Decision made | Create decision page immediately |
| Deliverable approved | Feed back into wiki as reference |
| Weekly | Review orphan pages, update overview |
| Phase transition | Major wiki refresh, archive stale content |