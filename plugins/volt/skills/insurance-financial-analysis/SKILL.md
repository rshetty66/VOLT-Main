---
name: insurance-financial-analysis
description: >
  Reads an insurer's financial statements end to end to assess financial health: combined ratio
  and underwriting profitability, reserve adequacy and prior-year development, investment yield,
  and regulatory capital under the Canadian regime. Covers OSFI MCT for P&C, LICAT for life,
  DCAT, the Appointed Actuary's Report, and IFRS 17 presentation. Activates for combined ratio,
  loss ratio, expense ratio, underwriting profitability, insurer financial health, reserve
  adequacy, prior year development, MCT, LICAT, minimum capital test, DCAT, appointed actuary,
  solvency, insurer due diligence, financial strength rating, premium leverage, or analysing
  an insurance company's financials.
version: 1.0.0
metadata:
  category: Financial Analysis
  industry: Insurance
  complexity: High
disable-model-invocation: true
---

# Insurance Financial Analysis

## Scope Boundary

This skill reads a **whole insurer's** financials to reach a view on financial health. It is
the outside-in analysis: due diligence, competitor benchmarking, credit or M&A assessment,
board reporting on a subsidiary.

It is not the reserving process itself (`insurance-reserving`), the CSM mechanics
(`insurance-ifrs17-csm-recon`), or transaction-level tie-out (`insurance-premium-recon`,
`insurance-claims-recon`). Those are inside-out, process-owner skills. If the question is
"is our reserve estimate right", use `insurance-reserving`; if it is "is this insurer
financially sound", use this.

---

## Canadian Framing

Most published insurance-analysis material is US statutory: NAIC Annual Statement, Schedule P,
RBC ratios. Canadian insurers do not file those. The equivalents are:

| US concept | Canadian equivalent | Filed with |
|---|---|---|
| NAIC Annual Statement | P&C Annual Return / Life Annual Return | OSFI (federal), FSRA / AMF (provincial) |
| Schedule P loss triangles | Appointed Actuary's Report + claims development exhibits | OSFI |
| Risk-Based Capital (RBC) | **MCT** (P&C) / **LICAT** (life) | OSFI |
| Statutory accounting (SAP) | **IFRS 17** — Canada adopted 1 Jan 2023 | OSFI |
| Own risk solvency assessment | **ORSA** and **DCAT** | OSFI |

Do not quote an RBC threshold at a Canadian insurer. If the entity is provincially regulated,
confirm the supervisor before citing any ratio — FSRA (Ontario) and AMF (Québec) differ from
OSFI. Mark any threshold carried into a deliverable `[Verify]` until confirmed against the
current guideline.

---

## Workflow

### 1. Classify the insurer

Line mix (P&C, life and health, multiline, reinsurer), regulator, and whether reporting is
IFRS 17 or a foreign basis. This determines every ratio that follows — a combined ratio is
meaningless for a life insurer, and LICAT does not apply to P&C.

### 2. Decompose underwriting profitability (P&C)

```
Loss ratio      = net claims incurred / net earned premium
Expense ratio   = underwriting expenses (incl. commissions) / net earned premium
Combined ratio  = loss ratio + expense ratio
```

Above 100% is an underwriting loss, funded by investment income. Read three to five years,
not one year — a single soft year is noise. Then separate the drivers:

- **Current accident year vs prior-year development.** A combined ratio flattered by
  favourable prior-year releases is not the same business as one earning its result in the
  current year. Quantify the release and restate.
- **Catastrophe load.** Strip cat losses to see the attritional trend, then ask whether the
  cat load is adequate for the exposure, not just for the year observed.
- **Commission and acquisition cost trend**, which under IFRS 17 sits inside insurance
  service expense rather than as a separate deferred acquisition cost line.

Under IFRS 17 the statement does not present a combined ratio. Build it from the insurance
service result components and say which line items were used — two analysts using different
components get different ratios, which is the usual reason benchmarks disagree.

### 3. Test reserve adequacy

Reserves are the largest estimate on the balance sheet and the easiest place to hide a
result. Evidence to seek, in order of weight:

1. **Prior-year development history.** Consistent favourable development suggests prudent
   reserving; consistent adverse development is a red flag on both the reserves and
   management credibility. Persistent large *favourable* development is also a finding — it
   can indicate excess margin used to smooth earnings.
2. **Appointed Actuary's Report.** The AA opines on the adequacy of policy liabilities. Read
   the opinion wording and any qualification; a change of Appointed Actuary is worth a question.
3. **Risk adjustment (IFRS 17).** The confidence level disclosed for the risk adjustment is
   the closest thing to an explicit margin. Compare across peers — a materially lower
   confidence level is a lower-margin balance sheet.
4. **Long-tail lines.** Liability, auto bodily injury, and professional lines develop for
   years. Weight them more heavily than property.

### 4. Investment portfolio and yield

Net investment income over average invested assets, plus asset mix, credit quality, and
duration against liability duration. Under IFRS 17 the discount rate unwinds through
insurance finance expense, so a rate move changes both sides — analyse the **net** position,
not the investment result alone. This is where IFRS 17 most often confuses year-on-year
comparison.

### 5. Capital adequacy

| Metric | Applies to | Read as |
|---|---|---|
| MCT ratio (capital available / capital required) | P&C | OSFI supervisory target is 150%; the internal target is higher and disclosed |
| LICAT total ratio | Life | OSFI supervisory target 100% total, 70% core |
| DCAT | Both | Forward-looking stress; read the adverse scenarios chosen and whether the plausible ones were included |
| Premium leverage (NWP / equity) | P&C | Rising leverage with a flat MCT means growth funded by reserve or reinsurance leverage |

Also assess **capital quality**: goodwill, intangibles, deferred tax assets and
letter-of-credit capacity are not the same as retained earnings. And check reinsurance
recoverables against equity — a large recoverable from unregistered reinsurers is a credit
exposure and attracts a capital charge under OSFI B-3.

### 6. Reinsurance programme

Gross-to-net on both premium and losses shows how much risk is genuinely retained. Look for
retention rising without a capital increase, heavy reliance on a single reinsurer,
unregistered reinsurance without collateral, and any structure whose main effect is on
reported capital rather than on risk transferred.

---

## Reaching a View

State a position, with the two or three figures that drive it and what would change your
mind. Common conclusions and their evidence:

| View | Evidence pattern |
|---|---|
| Underwriting is sound | Combined ratio under 100% on current-accident-year basis, three years running, without cat luck |
| Result is reserve-funded | Combined ratio under 100% only after favourable prior-year development |
| Capital is adequate but tightening | MCT above internal target but the trend is down while premium grows |
| Earnings quality is weak | Underwriting loss covered by realised investment gains |

Where a figure is derived rather than disclosed — a combined ratio built from IFRS 17
components, or a normalised cat load — say so and mark it `[Verify]`.

---

## Cross-References

- **insurance-reserving** — the reserving process and loss development method
- **insurance-ifrs17-csm-recon** — CSM roll-forward and IFRS 17 measurement mechanics
- **property-casualty-insurance** / **life-health-insurance** — product and market context
- **actuary** — actuarial method and assumption setting behind the AA's opinion
- **insurance-reinsurance-recon** — ceded balances and recoverable tie-out
- **osfi-regulatory-expert** — MCT, LICAT and B-3 guideline detail
