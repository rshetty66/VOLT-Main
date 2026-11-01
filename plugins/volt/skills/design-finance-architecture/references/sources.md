# Evidence register

Reviewed by the methodology author 2026-11-01. **VOLT verification status: UNVERIFIED.** The URLs and release labels
below were imported from the v2.0.0 package as supplied and have not been independently link-checked in VOLT. Treat
each entry as UNVERIFIED until re-retrieved for an engagement.

Use official sources. Dates/versions below describe the retrieved page, not proof of a client's configured
environment. Recheck effective standards, amendments, product editions and filing taxonomies for every engagement.
Historical standard PDFs support paragraph-level explanation but do not replace the applicable consolidated edition.
Do not reproduce licensed standards or vendor content without distribution rights.

| ID | Primary source / location | Supports / limitation |
|---|---|---|
| S01 | Oracle, COA structures/instances, 26d: <https://docs.oracle.com/en/cloud/saas/financials/26d/faiac/overview-of-creating-and-configuring-chart-of-accounts-structure.html> | Segment design is configurable; six segments are not a universal template |
| S02 | Oracle, Primary Ledgers, Secondary Ledgers, and Reporting Currencies, 26d: <https://docs.oracle.com/en/cloud/saas/financials/26d/faigl/primary-ledgers-secondary-ledgers-and-reporting-currencies.html> | Conversion levels and adjustment-only restrictions |
| S03 | Oracle, Create a COA Structure and Instance, 26a: <https://docs.oracle.com/en/cloud/saas/applications-common/26a/facia/create-a-chart-of-accounts-structure-and-instance.html> ; Example of Segment Labels: <https://docs.oracle.com/en/cloud/saas/financials/26a/faiac/example-of-segment-labels.html> | Required/optional labels and module-dependent cost center. Resolve differing wording using target release/module context |
| S04 | Oracle, Accounting Event Model, 26d: <https://docs.oracle.com/en/cloud/saas/financials/26d/faiac/accounting-event-model.html> ; Accounting Attribute Assignments, 26b: <https://docs.oracle.com/en/cloud/saas/financials/26b/faiac/accounting-attribute-assignments.html> | Event classes/types and attribute roles; full rule configuration requires further target-release documentation |
| S05 | SAP, Cost Accounting and Charts of Accounts: <https://help.sap.com/docs/SAP_S4HANA_ONPREMISE/651d8af3ea974ad1a4d74449122c620e/a591d7531a4d414de10000000a174cb4.html> | Central/decentral operating/country/group charts and controlling-area constraints |
| S06 | SAP, Extension Ledger: <https://help.sap.com/docs/SAP_S4HANA_ON-PREMISE/651d8af3ea974ad1a4d74449122c620e/f2a1f5756fa148c8ae8ec338a2653fad.html> | Standard versus extension and inherited configuration; edition-specific constraints |
| S07 | SAP, Universal Journal: <https://help.sap.com/docs/SAP_S4HANA_CLOUD/0fa84c9d9c634132b7c4abb9ffdd8f06/523b8a55559ad007e10000000a44538d.html> | Integrated accounting dimensions and ledger-based views |
| S08 | SAP Fioneer, Financial Products Subledger: <https://www.sapfioneer.com/finance-esg/financial-products-subledger/> ; FSDM/FPSL integration: <https://fsdm.docs.fioneer.com/latest/en/5-Integration/20-Integrate-Product/FPSL> | Published product positioning and integration; licence/calculation scope requires verification |
| S09 | Workday Accounting Center: <https://www.workday.com/en-ca/products/financial-management/accounting-center.html> ; Setup Considerations: <https://doc.workday.com/admin-guide/en-us/financial-management/accounting-center/uws1623700792291.html> | Event-to-journal, enrichment, summarization and lineage; detailed FDM/ledger behavior requires tenant evidence |
| S10 | NetSuite COA Mapping: <https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_3851620232.html> ; Enabling Multi-Book: <https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_4842473026.html> | Common account list, mapping restrictions and implementation prerequisites |
| S11 | Oracle Cloud EPM Integration: <https://docs.oracle.com/en/cloud/saas/enterprise-performance-management-common/intgr/chap_1_about.html> ; Data Integration business processes: <https://docs.oracle.com/en/cloud/saas/enterprise-performance-management-common/diepm/integrations_business_processes.html> | Distinct EPM processes and integration scope |
| S12 | SAP Group Reporting, 2608: <https://help.sap.com/docs/SAP_S4HANA_CLOUD/90c07e91c7a64f328be3fd6b48955b13/8691ee5db7ed41dab0db419a87d66f2b.html> ; Plan Consolidation, 2025 FPS01: <https://help.sap.com/docs/SAP_S4HANA_ON-PREMISE/4ebf1502064b406c964b0911adfb3f01/6817703d2d4241f98e078b0bec858079.html> | Consolidation/SAC planning integration and different journal/plan tables |
| S13 | OneStream Consolidation: <https://documentation.onestream.com/docs/Content/Design%20and%20Reference/Financial%20Model%20Guides/Consolidation.html> ; FP&A: <https://www.onestream.com/solutions/financial-planning-analysis/> | Consolidation/planning; application-specific configuration not verified |
| S14 | Anaplan Finance: <https://www.anaplan.com/solutions/finance-planning/> | Portfolio includes planning/consolidation; verify contracted product |
| S15 | Workday Adaptive Planning: <https://www.workday.com/en-ca/products/adaptive-planning/financial-planning/overview.html> | Financial planning capability, not a certified adapter |
| S16 | IFRS Foundation IFRS 9 overview: <https://www.ifrs.org/issued-standards/list-of-standards/ifrs-9-financial-instruments/> | Recognition, classification and measurement overview |
| S17 | IFRS Foundation, May 2024 classification/measurement amendments: <https://www.ifrs.org/news-and-events/news/2024/05/iasb-issues-amendments-cmfi-ifrs7-ifrs9/> | Effective for periods beginning on/after 2026-01-01; contingent features/electronic settlement |
| S18 | IFRS 9 issued text, historical 2022 edition: <https://www.ifrs.org/content/dam/ifrs/publications/pdf-standards/english/2022/issued/part-a/ifrs-9-financial-instruments.pdf?bypass=on> ; IFRS 9 impairment review: <https://www.ifrs.org/projects/completed-projects/2024/post-implementation-review-of-ifrs-9-impairment/> | Interest/modification/write-off and impairment context. Obtain applicable current edition for live policy |
| S19 | FASB Credit Losses: <https://fasb.org/page/PageContent?isStaticPage=true&pageId=%2Fstandards%2FTransition%2Fcredit-losses-transition.html> ; ASU 2016-13: <https://storage.fasb.org/ASU_2016-13.pdf> | CECL basis; verify subsequent amendments/current Codification for live policies |
| S20 | Federal Reserve credit-loss FAQ: <https://www.federalreserve.gov/supervisionreg/topics/faq-new-accounting-standards-on-financial-instruments-credit-losses.htm> | Supervisory explanation of CECL and commitments |
| S21 | BIS, SRP36 risk data aggregation/reporting: <https://www.bis.org/committees/bcbs/basel-framework/standard/srp/36/inforce/2019-12-15/published/2019-12-15> | BCBS 239 principles/scope; not vendor certification |
| S22 | OSFI B-10: <https://www.osfi-bsif.gc.ca/en/guidance/guidance-library/third-party-risk-management-guideline> | Third-party risk and institution accountability |
| S23 | OSFI B-13: <https://www.osfi-bsif.gc.ca/en/guidance/guidance-library/technology-cyber-risk-management> | Technology/cyber risk expectations |
| S24 | Anthropic subagents: <https://code.claude.com/docs/en/sub-agents> ; Agent Skills: <https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview> | Description-based delegation and progressive disclosure; verify pinned versions |
| S25 | Anthropic Agent SDK: <https://code.claude.com/docs/en/agent-sdk/overview> | Current SDK naming; service implementation still required |
| S26 | OSFI M4: <https://www.osfi-bsif.gc.ca/en/data-forms/reporting-returns/filing-financial-returns/financial-reporting-instructions/balance-sheet-m4> | Balance sheet return, displayed update June 2022; pin current return files/change log |
| S27 | OSFI E2: <https://www.osfi-bsif.gc.ca/en/data-forms/reporting-returns/filing-financial-returns/financial-reporting-instructions/mortgage-loans-report-e2> | Mortgage Loans Report, displayed update November 2022; pin released validations |
| S28 | OSFI N3: <https://www.osfi-bsif.gc.ca/en/data-forms/reporting-returns/filing-financial-returns/financial-reporting-instructions/loans-arrears-n3> | Arrears, impaired, gross/allowance/net and M4 tie-out |
| S29 | OSFI CAR 2026: <https://www.osfi-bsif.gc.ca/en/guidance/guidance-library/capital-adequacy-requirements-car-guideline-2026> ; Chapter 4: <https://www.osfi-bsif.gc.ca/en/guidance/guidance-library/capital-adequacy-requirements-car-2026-chapter-4-credit-risk-standardized-approach> | Date-specific capital rules; no hardcoded risk weights in this skill |
| S30 | OSFI E-23 (2027): <https://www.osfi-bsif.gc.ca/en/guidance/guidance-library/guideline-e-23-model-risk-management-2027> | Effective 2027-05-01, future as of this review; applicability/risk triage needed |

Record every actual client decision as claim ID, source URL/document ID, section, release, jurisdiction, business
effective dates, retrieval time, content hash where available, evidence class, applicability and reviewer. This
register establishes starting research, not an immutable mirror of all standards.
