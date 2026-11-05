# VOLT COA Designer

Build a chart of accounts (COA), check it, and map a legacy chart to it. Every verdict comes from tested code in
`shared/coa.ts`. The Claude assistant, which runs the VOLT `coa-designer` agent prompt from `plugins/volt`, may only
offer a chart or mapping for loading after the same checks have passed.

## Views

| View | What it does |
|---|---|
| Design | Edit the chart as CSV (`code,name,type,parent`), see the structure checks and the hierarchy, download the CSV |
| Mapping | Edit the legacy table (`code,name,target`; target is a new account code, `RETIRE`, or blank), see coverage and mapping checks |
| Assistant | Ask for a design, a rationalisation or a mapping. A verified result gets a "Load into Design / Mapping" button |

## Checks

| Id | Rule |
|---|---|
| `C_UNIQUE_CODES` | No duplicate account codes |
| `C_TYPE_RANGE` | Type matches the code's first digit: 1 asset, 2 liability, 3 equity, 4 revenue, 5-9 expense |
| `C_PARENT_EXISTS` | Every parent code exists |
| `C_NO_CYCLES` | No account is its own ancestor |
| `C_PARENT_TYPE` | A child has the same type as its parent |
| `C_NAMING` | Names are present and unique within a parent |
| `M_UNKNOWN_SOURCE` | Every mapping row refers to a legacy account |
| `M_NO_DUPLICATE_SOURCE` | Each legacy account is mapped once |
| `M_SOURCE_COVERAGE` | Every legacy account is mapped or retired |
| `M_TARGET_EXISTS` | Every target exists in the new chart |
| `M_POSTING_TARGET` | Every target is a posting account, not a roll-up parent |

## Run it

```bash
cd apps/volt-coa
npm install
cp .env.example .env     # optional: add ANTHROPIC_API_KEY for live mode
npm run dev              # API on :8788, UI on :5174
```

Without Claude credentials the app runs in demo mode: the Assistant reports the real checks and says it is not a
model answer. `VOLT_MODE=live|demo` forces a mode. Settings are in `.env.example`.

```bash
npm run typecheck && npm test && npm run build
```

## Layout

```
shared/coa.ts      types, checks, CSV, samples (pure, no I/O)
shared/events.ts   wire types
server/            Express API: /api/healthz, /api/validate, /api/assist (SSE); assist.ts is the Claude tool loop
src/               React UI
tests/             vitest; tests/mockAnthropic.ts stands in for the Claude API
```

## Not yet covered

Persistence beyond CSV download, authentication, multi-user editing and ERP load-file formats. Live Claude calls are
covered only against the mock in `tests/`; run once with a real key before relying on them.
