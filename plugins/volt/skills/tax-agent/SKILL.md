---
name: tax-agent
description: >-
  Full-spectrum tax advisory agent — corporate income tax, indirect tax (GST/HST/VAT/sales tax),
  OECD Pillar One/Two (GloBE), transfer pricing, M&A tax structuring, tax technology,
  and industry-specific tax (financial services, real estate, energy, tech). Use when advising
  on tax planning, compliance, reporting, or transformation across any jurisdiction or industry.
disable-model-invocation: true
---

# Tax Agent — Comprehensive Tax Advisory Skill

## Tax Domains

### 1. Corporate Income Tax
- **Compliance:** Tax provision (ASC 740 / IAS 12), return preparation, estimated tax payments
- **Planning:** Loss utilization (NOL carryforward/carryback), tax credit optimization (R&D, investment)
- **Deferred Tax:** Temporary differences, valuation allowances, tax rate changes
- **Canadian Specifics:** Federal/provincial rate allocation, SRED credits, CCPC small business deduction
- **US Specifics:** Federal + state apportionment, GILTI/FDII/BEAT, Section 163(j) interest limitation
- **Key Frameworks:** ASC 740 (US GAAP), IAS 12 (IFRS), CRA guidance, IRS regulations

### 2. Indirect Tax (GST/HST/VAT/Sales Tax)
- **Canadian GST/HST:** Registration, input tax credits (ITCs), place of supply rules, financial services exemptions
- **US Sales Tax:** Nexus determination (economic nexus post-Wayfair), marketplace facilitator rules, exemptions
- **EU VAT:** Place of supply, reverse charge, OSS/IOSS, chain transactions, financial services exemption
- **Compliance:** Return filing, remittance, audit defense, voluntary disclosure
- **Technology:** Tax engine configuration (Vertex, Avalara, Thomson Reuters ONESOURCE), ERP tax determination

### 3. OECD Pillar Two — GloBE Rules (Global Minimum Tax)
- **Scope:** MNEs with consolidated revenue ≥ EUR 750M
- **Minimum Rate:** 15% effective tax rate per jurisdiction
- **Mechanisms:**
  - **IIR (Income Inclusion Rule):** Parent tops up low-taxed subsidiaries
  - **UTPR (Undertaxed Profits Rule):** Backstop allocation to other jurisdictions
  - **QDMTT (Qualified Domestic Minimum Top-up Tax):** Domestic top-up preferred
- **Calculation:**
  1. Determine GloBE Income per jurisdiction (financial accounting income ± adjustments)
  2. Calculate Adjusted Covered Taxes per jurisdiction
  3. Compute Effective Tax Rate (ETR) = Adjusted Taxes / GloBE Income
  4. If ETR < 15% → Top-up Tax = (15% - ETR) × Excess Profit
  5. Excess Profit = GloBE Income - Substance-Based Income Exclusion (SBIE)
- **SBIE:** 5% of payroll costs + 5% of tangible asset carrying value (transition: higher rates declining)
- **Canadian Implementation:** Global Minimum Tax Act (GMTA), effective for fiscal years beginning after Dec 31, 2023
- **Safe Harbors:** Transitional CbCR safe harbor, transitional QDMTT safe harbor

### 4. OECD Pillar One — Amount A & Amount B
- **Amount A:** Reallocation of residual profit for largest MNEs (revenue > EUR 20B, profitability > 10%)
- **Amount B:** Fixed return for baseline marketing and distribution activities
- **Impact:** Primarily affects tech, consumer-facing, extractives sectors

### 5. Transfer Pricing
- **Methods:** CUP, Resale Price, Cost Plus, TNMM, Profit Split
- **Documentation:** Master File, Local File, CbCR (Country-by-Country Report)
- **APA/MAP:** Advance Pricing Agreements, Mutual Agreement Procedures
- **Key Risks:** Intercompany financing, IP migration, management fees, cost sharing
- **Canadian Context:** Section 247 ITA, CRA TPM-14 to TPM-17 guidance

### 6. M&A Tax Structuring
- **Deal Types:** Asset purchase, share purchase, merger, spinoff, carve-out
- **Tax Considerations:**
  - **Buyer:** Step-up in basis, goodwill deductibility, NOL utilization post-acquisition
  - **Seller:** Capital gains vs ordinary income, rollover elections, earn-out treatment
  - **Structuring:** Section 85 rollovers (Canada), Section 338(h)(10) elections (US), EU Merger Directive
- **Due Diligence:** Tax exposure assessment, uncertain tax positions, change-of-control provisions
- **Integration:** Tax function integration, entity rationalization, IP alignment

## Industry-Specific Tax

### Financial Services
- Exempt supplies (GST/HST), input tax apportionment, Part VI tax, FAPI rules
- Insurance premium taxes, investment income taxation
- Bank recapture rules, mark-to-market elections

### Real Estate
- REIT structures, capital cost allowance, recapture, land transfer taxes
- Non-resident withholding (Section 116), Treaty-based planning
- GST/HST on new residential, self-supply rules

### Technology
- R&D tax credits (SRED, Section 41), IP holding structures
- Digital services tax, Pillar One implications
- Stock option taxation, employee share plans

### Energy & Resources
- Depletion allowances, flow-through shares
- Carbon tax credits, clean energy investment tax credits
- Resource profit taxation, royalty deductibility

## Tax Technology Stack
- **Compliance:** Thomson Reuters ONESOURCE, Vertex, Avalara, CCH Axcess
- **Provision:** Longview Tax, ONESOURCE Tax Provision, Corptax
- **Transfer Pricing:** ONESOURCE TP, TPsmart, Orbitax
- **Pillar Two:** KPMG Pillar Two Tool, custom solutions
- **ERP Integration:** SAP Tax Engine, Oracle Tax Management, Workday tax configuration

## Quality Checklist — Tax Deliverables
- [ ] Jurisdictional scope complete (no missing entities or tax types)
- [ ] Tax rates current and sourced from official legislation
- [ ] Transfer pricing methods documented with benchmarking support
- [ ] Pillar Two calculations include all GloBE adjustments and SBIE
- [ ] M&A structuring considers both buyer and seller tax consequences
- [ ] Indirect tax treatment correct for supply type and jurisdiction
- [ ] Tax technology recommendations aligned with ERP platform
- [ ] Compliance calendar covers all filing deadlines
