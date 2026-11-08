/**
 * depth.ts — VOLT depth packs: dense domain methodology distilled from the
 * firm's reference corpus. The catalog tells Gyan WHO the agents are; these
 * packs tell it HOW senior practitioners build the artifact. Injected only
 * when the query matches (context budget: ≤2 packs per turn).
 */

export interface DepthPack {
  id: string;
  triggers: RegExp;
  content: string;
}

export const DEPTH_PACKS: DepthPack[] = [
  {
    id: "bank-coa",
    triggers:
      /\b(coa|chart of accounts|segment|natural account|ledger design|gl design|d-sib|value set)\b/i,
    content: `DEPTH PACK — Banking COA / GL design (D-SIB reference standard):
- Reference structure: 12 segments — Legal Entity(4), Natural Account(6), Product(4), Cost Center(6), Profit Center(4), Business Line(2), Channel(2), Customer Segment(2), Geographic(4), Currency(3), Intercompany(4), Regulatory(3). Adapt count to client; always give length, type, example values, roll-up and validation rule per segment.
- Natural account: 6-digit hierarchical. Bands: 1xxxxx assets (100-109 cash/central bank, 110-119 interbank, 120-129 loans retail, 130-139 loans commercial, 140-149 wholesale/gov, 150-159 securities, 160-169 derivatives/hedge, 170-179 fixed assets, 180-189 other incl. ACL contra), 2xxxxx liabilities, 3xxxxx equity, 4xxxxx interest income, 5xxxxx non-interest income, 6xxxxx interest expense, 7xxxxx non-interest expense, 8xxxxx provisions/taxes, 9xxxxx memo/statistical.
- Design rules: regulatory segment maps to BCAR asset class / OSFI return lines; legal entity matches the regulatory entity tree (supports partial consolidation); intercompany segment enables auto-elimination; never embed product in natural account (use product segment).
- Artifact bar: segment dictionary table + sample GL combination strings + cross-validation rule examples (e.g. intercompany segment mandatory when entity pair differs) + governance (who approves new values, SLA).`,
  },
  {
    id: "close-r2r",
    triggers:
      /\b(close|r2r|record to report|consolidat|period.?end|journal entr|reconcili|flux)\b/i,
    content: `DEPTH PACK — R2R / close acceleration (APQC 8.x aligned):
- Sub-process map: 8.3.2 general accounting, 8.3.3 fixed assets, 8.3.4 financial reporting, 8.3.5 regulatory reporting, 8.8 internal controls. Anchor every recommendation to a sub-process id.
- Complexity drivers to size: transaction volume, multi-GAAP (IFRS / regulatory / management-FTP / tax), entity count, manual JE %, reconciliation count, ERP instance count.
- Close calendar pattern: WD-2 pre-close (subledger cutoffs, accrual estimates), WD0 ledger close, WD+1..2 flash P&L + first-pass recons, WD+3..4 consolidations + eliminations + flux review, WD+5 management pack, WD+8..10 hard close + regulatory. Give day-by-day table with owner and system per step.
- Levers with typical ranges [benchmark]: auto-certify low-risk recons (60-80% of recon count), JE automation/auto-reversal (−40-60% manual JEs), continuous close (spread WD+1..4 work across month), threshold discipline (certify-by-exception), accrual estimation models. Quantify effort saved per lever in hours per close.
- Artifact bar: day-by-day close calendar, JE population table (type, count, avg effort, automation candidate), recon risk-tiering table, KPI table (close days, manual JE %, recon auto-cert %, post-close adjustments).`,
  },
  {
    id: "ecl-ifrs9",
    triggers:
      /\b(ecl|ifrs ?9|impairment|credit loss|staging|sicr|pd|lgd|ead|poci|provision)\b/i,
    content: `DEPTH PACK — IFRS 9 ECL (three-stage model):
- Staging: Stage 1 performing → 12-month ECL, interest on gross; Stage 2 SICR → lifetime ECL, interest on gross; Stage 3 credit-impaired → lifetime ECL, interest on NET carrying amount; POCI → lifetime, credit-adjusted EIR.
- SICR triggers: quantitative (PD +200% from origination AND abs PD >0.5%), qualitative (forbearance, watchlist, sector downgrade), 30 DPD backstop (rebuttable). Stage 3: 90 DPD backstop, unlikely-to-pay, distressed restructuring, insolvency.
- ECL = Σ(PD × LGD × EAD × DF). PD point-in-time from TTC, multi-scenario (e.g. Base 40 / Upside 25 / Downside 25 / Severe 10); LGD collateral-dependent (LTV, recovery, cure rates); EAD drawn + CCF × undrawn (behavioral CCF for revolvers).
- Artifact bar: staging decision tree (mermaid), trigger threshold table, portfolio segmentation table (segment, balance, PD range, LGD range, stage mix), JE table (Dr Impairment expense / Cr ACL; stage-transfer entries), model governance (challenger, backtesting freq, management overlay policy).`,
  },
  {
    id: "ap-p2p",
    triggers:
      /\b(ap|accounts payable|p2p|procure.?to.?pay|invoice|vendor|touchless|three.?way|match|po flip|early pay)\b/i,
    content: `DEPTH PACK — AP / P2P transformation:
- Match tiers: 3-way (PO+GR+invoice), 2-way (PO+invoice), non-PO (coding + approval flow). Tolerance design is the ROI lever [illustrative default: ±2% price, ±5% qty]; too tight = clerks re-touch, too loose = posting errors.
- Exception taxonomy: price variance, qty variance, missing GR, duplicate suspect, vendor-master mismatch, new vendor, tax mismatch. Each gets owner, SLA, auto-resolve candidate flag.
- Levers: e-invoicing/PDF-extraction (OCR+LLM coding), auto-match with tolerances, vendor-master hygiene (dedupe, banking validation), dynamic discounting, duplicate-payment detection (fuzzy vendor+amount+date), statement recon bots.
- Benchmarks [benchmark, APQC direction]: cost per invoice top-quartile ~$2-3 vs bottom ~$10+; touchless rate leaders 70%+; DPO managed to policy ±2 days; duplicate/leakage 0.1-0.5% of spend recoverable.
- Artifact bar: match-tier flow (mermaid), tolerance table by tier, exception aging buckets, control matrix (preventive/detective, owner, evidence), FTE-release calc from volumes by tier.`,
  },
  {
    id: "oracle-erp",
    triggers:
      /\b(oracle|fusion|erp cloud|fbdi|otbi|epbcs|fccs|subledger accounting|sla rule|coa instance|ledger setup|essbase)\b/i,
    content: `DEPTH PACK — Oracle Fusion Cloud ERP configuration:
- Enterprise structure: Ledger ↔ Legal Entity ↔ Business Unit hierarchy; COA instance (segments, value sets with format/security rules, cross-validation rules, alias/rollup hierarchies); tree versions with audit dates.
- Subledger accounting (SLA): accounting rules per event class (invoice validated, payment, receipt), journal line rules, account rules with conditions, supporting references; mapping sets before hard-coding accounts.
- Data & integration: FBDI templates per object (JE, AP invoices, suppliers, assets), REST for near-real-time, OTBI subject areas for reporting, ESS jobs for scheduled loads; reconciliation via AR/AP to GL reports.
- Close stack: period-close checklist in EPPM/ERP, revaluation/translation runs, intercompany reconciliation, then FCCS/EPBCS for consolidation/planning if deployed.
- Artifact bar: config workbook tables — value-set sheet (segment, type, length, validation, security), CVR sheet (rule, condition, error message), SLA rule sheet (event, condition, account string source), integration register (object, method FBDI/REST, frequency, owner).`,
  },
  {
    id: "transfer-pricing",
    triggers:
      /\b(transfer pricing|intercompany charge|arm'?s length|tp policy|cost plus|tnmm|cup|management fee|cost allocation)\b/i,
    content: `DEPTH PACK — Transfer pricing / intercompany:
- Method selection: CUP > Resale/Cost+ > TNMM/PSM; services typically Cost+ (markup 5-10% [benchmark range] for routine shared services); financing: CUP via credit-rating-implied spread; IP: PSM/CUT.
- Policy artifact: covered-transaction table (type, method, markup/spread, benchmarking basis, invoicing frequency, currency), cost-pool definition + allocation keys (headcount, revenue, usage), true-up mechanism (quarterly, +/-5% band), documentation obligations (master/local file thresholds, CbCR), withholding tax exposure.
- Controls: intercompany agreement register, monthly IC matching vs segment 11, BEPS alignment sign-off, year-end true-up JE pattern.
- Artifact bar: transaction-method matrix, markup benchmarking table (label source assumptions), invoice flow (mermaid), policy governance (owner, annual review date, audit-defense file contents).`,
  },
];

/** Pick at most two packs relevant to the user's message (token budget). */
export function selectDepthPacks(message: string): DepthPack[] {
  return DEPTH_PACKS.filter((p) => p.triggers.test(message)).slice(0, 2);
}
