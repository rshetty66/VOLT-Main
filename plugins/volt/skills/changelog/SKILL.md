---
name: changelog
description: Maintain CHANGELOG.md by hand as part of a PR - decide whether a change deserves an entry, pick its scope and category, and cut a release. Use when adding a changelog entry or tagging a version, not for generating release notes from git history.
category: Engineering Practice
disable-model-invocation: true
---

# CHANGELOG maintenance

Keep `CHANGELOG.md` at the repo root in [Keep a Changelog](https://keepachangelog.com)
format with [Semantic Versioning](https://semver.org).

> **Not the same as `changelog-generator`.** That skill mines git history to *produce*
> customer-facing release notes after the fact. This skill is the per-PR discipline:
> one deliberate line, written by the person who made the change, while they still
> remember why it mattered.

## The one question

**Does a user's or operator's behaviour change because of this PR?**

- Yes → one entry.
- No → no entry. Do not pad the file.

**Entry-worthy:** new capability, changed API surface or response shape, bug fix with a
visible symptom, new/renamed/removed env var, changed default, security fix, breaking change.

**Not entry-worthy:** pure refactor, test-only change, CI/workflow change, docstring or
comment edits, formatting, dependency bump with no behaviour change, internal renames.

## Entry format

```text
- [scope] Imperative description of the change (#PR)
```

- **Imperative mood**, present tense: "Add", "Fix", "Gate" — not "Added", "Fixes".
- **One line.** If it needs two, it is probably two entries.
- **Describe the effect, not the diff.** `Fix supervisor dropping tools when Haiku is
  unprovisioned` beats `Update supervisor.py error handling`.
- Reference the PR number. Omit it only if there is genuinely no PR.

### Scopes

Use exactly one, lowercase, from this set. Add a new scope only when a genuinely new
subsystem lands, and add it to this list in the same PR.

| Scope | Covers |
|---|---|
| `graph` | routing brain — `api/graph/` nodes, state, supervisor, sub-graphs |
| `agent` | the agentic tool loop and tool registry |
| `skills` | skill content, vendoring, the skill index |
| `api` | FastAPI routes and response schemas |
| `web` | Next.js frontend |
| `recon` | reconciliation engine |
| `erp` | Oracle ERP / EPM integration |
| `deliverables` | DOCX/PPTX/XLSX/HTML rendering |
| `auth` | authentication, shared secrets, ingress |
| `deploy` | Docker, env vars, cluster config |
| `docs` | user-visible documentation only |

### Categories

Place entries under `[Unreleased]` in one of these, in this order. Omit empty ones.

`Added` · `Changed` · `Deprecated` · `Removed` · `Fixed` · `Security`

Judgement calls:
- New env var that changes a default → `Changed`, not `Added`.
- Bug that was never in a release → no entry at all; it never reached anyone.
- Behaviour behind a default-off flag → `Added`, and say it is opt-in.

## Example

```markdown
## [Unreleased]

### Added

- [graph] Add market & credit research desk sub-graph with an evidence gate that names
  missing data instead of inferring it (#142)
- [agent] Add `read_skill_resource` so router skills can open their own workflow files (#142)

### Changed

- [skills] Retune vendored LLMQuant skill descriptions for the VOLT retrieval index (#142)

### Fixed

- [graph] Fall back to the default model when Haiku is unprovisioned, instead of losing
  the tool surface (#138)

### Security

- [auth] Require the shared secret on all ingress paths, not just `/chat` (#140)
```

## Cutting a release

1. Confirm `[Unreleased]` is accurate — read the merge log since the last tag and check
   nothing user-visible is missing.
2. Choose the version:
   - **major** — a breaking change to the API surface, response shape, or config contract.
   - **minor** — any `Added`, or a `Changed` that is backwards compatible.
   - **patch** — only `Fixed` / `Security`.
   A `Removed` entry is major unless the thing removed was never released.
3. Rename `## [Unreleased]` to `## [X.Y.Z] - YYYY-MM-DD` and open a fresh empty
   `## [Unreleased]` above it.
4. Update the comparison links at the bottom of the file.
5. Tag: `git tag -a vX.Y.Z -m "vX.Y.Z"`.

Never edit a released section afterwards. A wrong released entry is corrected by a new
entry in the next version that says so.

## Quality checks before you commit

- [ ] Every entry names an observable effect, not a file
- [ ] Imperative mood, one line, valid scope, PR number
- [ ] Correct category (especially `Changed` vs `Added` for altered defaults)
- [ ] No refactor/test/CI-only entries
- [ ] Breaking changes flagged with **BREAKING** at the start of the description
- [ ] New env vars also documented wherever env vars are documented — a changelog entry
      is not a substitute for the reference doc

Template: [`references/changelog-template.md`](references/changelog-template.md)
