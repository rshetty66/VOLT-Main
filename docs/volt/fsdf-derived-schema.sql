-- =============================================================================
-- FSDF-ALIGNED DERIVED SCHEMA: BANKING AND INSURANCE PRODUCTS (Oracle 19c+)
-- =============================================================================
-- STATUS     : Derived design. NOT Oracle's licensed OFSAA/FSDF physical model
--              (which has 1,400+ tables). It follows FSDF conventions and the
--              contract-centric grain in plugins/volt/skills/banking-data-model.
--              Not executed against an Oracle instance; run the Section 9 checks
--              after loading to prove it compiles and the keys line up.
-- CONVENTIONS: STG_  staging (landing, mirrors target 1:1, Section 8)
--              DIM_  reference data      FSI_D_ contract / party / instrument
--              FCT_  time-variant facts and results (FSDF uses FCT_, e.g.
--                    FCT_COMMON_ACCOUNT_SUMMARY; checked against Oracle docs 2026-11-24)
--              Column prefixes: n_ NUMBER, v_ VARCHAR2, d_ DATE, f_ flag CHAR(1)
--              Y/N, fic_mis_date = batch (as-of) date. N_/V_/F_ and FIC_MIS_DATE
--              appear in Oracle's FSDF examples; d_ for dates is [UNVERIFIED].
--              FSI_D_ follows the OFSAA ALM/FTP processing-table style [UNVERIFIED];
--              FSDF itself lands data in STG_ product-processor tables. The
--              crosswalk to real OFSAA table names is in fsdf-derived-schema.md.
-- DEVIATION  : OFSAA instrument tables are daily snapshots keyed
--              (fic_mis_date, v_account_number). Here the contract master is
--              1 row per contract (current terms) and all time-varying values sit
--              in FCT_POSITION. Rebuild the OFSAA snapshot shape with a view if
--              the OFSAA applications must read it natively.
-- DESIGN RULES (from banking-data-model skill):
--              1. One FSI_D_CONTRACT spine; products are subtypes, not new spines.
--              2. Party is one entity; customer/counterparty/policyholder are roles.
--              3. Hierarchies (product, org) are dimensions, never baked into keys.
--              4. Every journal carries its source event key; events carry contract.
--              5. Same contract, three views: Finance, Risk, Treasury attributes
--                 live on the same row set, not in three copies.
--
-- PRODUCT COVERAGE (v_contract_family code -> subtype table; products in brackets)
--   BANKING
--     LOAN, MORTGAGE, LEASE, OVERDRAFT ...... FSI_D_LOAN_CONTRACT
--                                             (personal, auto, student, SME, corporate, syndicated, factoring)
--     CASA .................................. FSI_D_CASA_CONTRACT (current, savings, notice, MMDA, nostro/vostro)
--     TERM_DEPOSIT .......................... FSI_D_TERM_DEPOSIT (term deposit, CD/GIC, structured deposit)
--     CARD .................................. FSI_D_CARD_CONTRACT (credit, debit, prepaid, charge)
--     FACILITY .............................. FSI_D_FACILITY (revolver, credit line, commitment, limit)
--     TRADE_FINANCE ......................... FSI_D_TRADE_FINANCE (LC, standby, guarantee, BA, bills)
--     INVESTMENT ............................ FSI_D_INVESTMENT_HOLDING + FSI_D_INSTRUMENT
--                                             (govt/corp bond, equity, fund, MBS, ABS, covered bond, T-bill)
--     DERIVATIVE ............................ FSI_D_DERIVATIVE + FSI_D_DERIVATIVE_LEG
--                                             (IRS, CCS, FX fwd, futures, options, swaptions, CDS, TRS)
--     REPO_SBL .............................. FSI_D_REPO_SBL (repo, reverse repo, sec lending/borrowing)
--     BORROWING ............................. FSI_D_BORROWING (issued/covered bonds, interbank, central bank,
--                                             subordinated debt, AT1)
--   INSURANCE (every family also has one FSI_D_INS_POLICY row)
--     LIFE .................................. FSI_D_INS_LIFE (term, whole life, endowment, universal, unit-linked)
--     ANNUITY ............................... FSI_D_INS_ANNUITY (immediate, deferred, fixed, variable, indexed)
--     HEALTH ................................ FSI_D_INS_HEALTH (individual/group health, CI, disability, dental)
--     PNC ................................... FSI_D_INS_PNC (motor, property, liability, marine, engineering,
--                                             cyber, crop)
--     REINS_ASSUMED ......................... FSI_D_INS_POLICY only (inward reinsurance written as a policy)
--     Reinsurance ceded (held) is not a contract family: it lives in FSI_D_INS_REINS_TREATY and
--     FSI_D_INS_REINS_CESSION, measured through FSI_D_INS_GROUP rows with v_direction = 'REINS_HELD'.
--
-- VOLT LEDGER ALIGNMENT (apps/volt-ledger, chart-of-accounts design brain)
--   dim_gl_account.v_concept_id carries the canonical concept (canon:<Name>) from
--   apps/volt-ledger/data/ontology/mvg-bank-v1.json, so every FSDF account maps to one concept.
--   Journal lines and GL balances carry the volt-ledger target segments as dimensions, never
--   inside the natural account:
--     Entity ......... n_org_sk          (dim_org_unit, LEGAL, v_org_type = ENTITY)
--     NaturalAccount . n_gl_account_sk   (dim_gl_account)
--     CostCentre ..... n_cost_centre_sk  (dim_org_unit, MGMT, v_org_type = COST_CENTRE)
--     BusinessLine ... n_mgmt_org_sk     (dim_org_unit, MGMT, v_org_type = BUSINESS_LINE)
--     Product ........ n_product_sk      (dim_product)
--     CreditStage .... v_credit_stage    ('1','2','3','POCI','NA')
--     Intercompany ... n_ic_org_sk       (dim_org_unit, LEGAL, counterparty entity)
--   Segment code values live in v_segment_code on each dimension. Unassigned = surrogate key -1
--   (seeded in Section 1), which matches the segment defaults in the volt-ledger target chart.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. REFERENCE DATA (DIM_)
-- ---------------------------------------------------------------------------

-- Generic small code lists (rate type, status, role, claim status ...). Keeps the
-- schema from needing one table per enumeration. v_code_set names the list.
CREATE TABLE dim_code (
  v_code_set       VARCHAR2(40)  NOT NULL,
  v_code           VARCHAR2(40)  NOT NULL,
  v_description    VARCHAR2(200) NOT NULL,
  f_active         CHAR(1)       DEFAULT 'Y' NOT NULL,
  CONSTRAINT pk_dim_code PRIMARY KEY (v_code_set, v_code),
  CONSTRAINT ck_dim_code_act CHECK (f_active IN ('Y','N'))
);

CREATE TABLE dim_currency (
  v_ccy_code       CHAR(3)       NOT NULL,
  v_ccy_name       VARCHAR2(100) NOT NULL,
  n_decimals       NUMBER(1)     DEFAULT 2 NOT NULL,
  CONSTRAINT pk_dim_currency PRIMARY KEY (v_ccy_code)
);

CREATE TABLE dim_country (
  v_country_code   CHAR(2)       NOT NULL,
  v_country_name   VARCHAR2(100) NOT NULL,
  v_region         VARCHAR2(40),
  CONSTRAINT pk_dim_country PRIMARY KEY (v_country_code)
);

-- Product hierarchy, effective-dated so prior periods reproduce.
CREATE TABLE dim_product (
  n_product_sk       NUMBER(18)    GENERATED BY DEFAULT AS IDENTITY,
  v_product_code     VARCHAR2(40)  NOT NULL,
  v_product_name     VARCHAR2(200) NOT NULL,
  v_business_class   VARCHAR2(10)  NOT NULL,   -- BANKING | INSURANCE
  v_contract_family  VARCHAR2(30)  NOT NULL,   -- drives subtype routing
  n_parent_product_sk NUMBER(18),
  n_hierarchy_level  NUMBER(2),
  v_acct_treatment   VARCHAR2(30),             -- AMORT_COST | FVOCI | FVTPL | IFRS17_GMM | IFRS17_PAA | IFRS17_VFA
  v_rate_basis       VARCHAR2(20),
  v_segment_code     VARCHAR2(10),             -- volt-ledger Product segment value
  d_eff_start        DATE          NOT NULL,
  d_eff_end          DATE          DEFAULT DATE '9999-12-31' NOT NULL,
  CONSTRAINT pk_dim_product PRIMARY KEY (n_product_sk),
  CONSTRAINT uq_dim_product UNIQUE (v_product_code, d_eff_start),
  CONSTRAINT fk_dim_prod_par FOREIGN KEY (n_parent_product_sk) REFERENCES dim_product (n_product_sk),
  CONSTRAINT ck_dim_prod_cls CHECK (v_business_class IN ('BANKING','INSURANCE'))
);

-- Two hierarchies: legal (statutory) and management (internal), selected by v_hierarchy_type.
CREATE TABLE dim_org_unit (
  n_org_sk           NUMBER(18)    GENERATED BY DEFAULT AS IDENTITY,
  v_org_code         VARCHAR2(40)  NOT NULL,
  v_org_name         VARCHAR2(200) NOT NULL,
  v_hierarchy_type   VARCHAR2(10)  NOT NULL,   -- LEGAL | MGMT
  v_org_type         VARCHAR2(20),             -- ENTITY | BRANCH | BUSINESS_LINE | COST_CENTRE
  n_parent_org_sk    NUMBER(18),
  v_country_code     CHAR(2),
  v_functional_ccy   CHAR(3),
  v_segment_code     VARCHAR2(10),             -- volt-ledger Entity / CostCentre / BusinessLine value
  d_eff_start        DATE          NOT NULL,
  d_eff_end          DATE          DEFAULT DATE '9999-12-31' NOT NULL,
  CONSTRAINT pk_dim_org_unit PRIMARY KEY (n_org_sk),
  CONSTRAINT uq_dim_org_unit UNIQUE (v_org_code, v_hierarchy_type, d_eff_start),
  CONSTRAINT fk_dim_org_par FOREIGN KEY (n_parent_org_sk) REFERENCES dim_org_unit (n_org_sk),
  CONSTRAINT fk_dim_org_cty FOREIGN KEY (v_country_code) REFERENCES dim_country (v_country_code),
  CONSTRAINT fk_dim_org_ccy FOREIGN KEY (v_functional_ccy) REFERENCES dim_currency (v_ccy_code),
  CONSTRAINT ck_dim_org_h CHECK (v_hierarchy_type IN ('LEGAL','MGMT'))
);

-- Common chart of accounts: the account answers "what"; org/product dimensions answer "who/where".
CREATE TABLE dim_gl_account (
  n_gl_account_sk    NUMBER(18)    GENERATED BY DEFAULT AS IDENTITY,
  v_gl_account_code  VARCHAR2(40)  NOT NULL,
  v_gl_account_name  VARCHAR2(200) NOT NULL,
  v_account_type     VARCHAR2(15)  NOT NULL,   -- ASSET | LIABILITY | EQUITY | INCOME | EXPENSE | OFF_BALANCE
  v_normal_balance   CHAR(2)       NOT NULL,   -- DR | CR
  v_statement_class  VARCHAR2(40),
  v_statutory_map    VARCHAR2(60),             -- regulatory return line
  v_concept_id       VARCHAR2(80),             -- volt-ledger canonical concept, e.g. canon:LoansGross
  n_parent_gl_sk     NUMBER(18),
  d_eff_start        DATE          NOT NULL,
  d_eff_end          DATE          DEFAULT DATE '9999-12-31' NOT NULL,
  CONSTRAINT pk_dim_gl_account PRIMARY KEY (n_gl_account_sk),
  CONSTRAINT uq_dim_gl_account UNIQUE (v_gl_account_code, d_eff_start),
  CONSTRAINT fk_dim_gl_par FOREIGN KEY (n_parent_gl_sk) REFERENCES dim_gl_account (n_gl_account_sk),
  CONSTRAINT ck_dim_gl_nb CHECK (v_normal_balance IN ('DR','CR'))
);

-- Unassigned members (key -1) so segment columns on journals and balances can be NOT NULL.
INSERT INTO dim_product (n_product_sk, v_product_code, v_product_name, v_business_class,
                         v_contract_family, v_segment_code, d_eff_start)
  VALUES (-1, 'NONE', 'Unassigned', 'BANKING', 'NONE', 'None', DATE '1900-01-01');
INSERT INTO dim_org_unit (n_org_sk, v_org_code, v_org_name, v_hierarchy_type, v_org_type,
                          v_segment_code, d_eff_start)
  VALUES (-1, 'NONE', 'Unassigned', 'MGMT', 'UNASSIGNED', 'Unassigned', DATE '1900-01-01');

-- ---------------------------------------------------------------------------
-- 2. PARTY (customers, counterparties, issuers, policyholders, brokers, reinsurers)
-- ---------------------------------------------------------------------------

CREATE TABLE fsi_d_party (
  n_party_sk         NUMBER(18)    GENERATED BY DEFAULT AS IDENTITY,
  v_party_id         VARCHAR2(60)  NOT NULL,   -- source identifier
  v_source_system    VARCHAR2(30)  NOT NULL,
  v_party_type       VARCHAR2(15)  NOT NULL,   -- INDIVIDUAL | CORPORATE | SOVEREIGN | BANK | INSURER | FUND
  v_legal_name       VARCHAR2(300) NOT NULL,
  v_lei              CHAR(20),
  v_tax_id           VARCHAR2(40),
  v_country_code     CHAR(2),
  v_industry_code    VARCHAR2(20),             -- NAICS / NACE / SIC
  d_birth_or_incorp  DATE,
  v_segment          VARCHAR2(30),             -- retail / SME / corporate / private
  v_kyc_risk_rating  VARCHAR2(10),
  f_pep              CHAR(1)       DEFAULT 'N' NOT NULL,
  f_related_party    CHAR(1)       DEFAULT 'N' NOT NULL,
  n_parent_party_sk  NUMBER(18),               -- ultimate parent for group exposure
  d_eff_start        DATE          NOT NULL,
  d_eff_end          DATE          DEFAULT DATE '9999-12-31' NOT NULL,
  CONSTRAINT pk_fsi_d_party PRIMARY KEY (n_party_sk),
  CONSTRAINT uq_fsi_d_party UNIQUE (v_party_id, v_source_system, d_eff_start),
  CONSTRAINT fk_party_cty FOREIGN KEY (v_country_code) REFERENCES dim_country (v_country_code),
  CONSTRAINT fk_party_par FOREIGN KEY (n_parent_party_sk) REFERENCES fsi_d_party (n_party_sk),
  CONSTRAINT ck_party_pep CHECK (f_pep IN ('Y','N')),
  CONSTRAINT ck_party_rel CHECK (f_related_party IN ('Y','N'))
);

CREATE TABLE fsi_d_party_relationship (
  n_party_sk         NUMBER(18)    NOT NULL,
  n_related_party_sk NUMBER(18)    NOT NULL,
  v_relationship     VARCHAR2(30)  NOT NULL,   -- PARENT | GUARANTOR | UBO | SPOUSE | CONNECTED_GROUP
  n_ownership_pct    NUMBER(7,4),
  d_eff_start        DATE          NOT NULL,
  d_eff_end          DATE          DEFAULT DATE '9999-12-31' NOT NULL,
  CONSTRAINT pk_party_rel PRIMARY KEY (n_party_sk, n_related_party_sk, v_relationship, d_eff_start),
  CONSTRAINT fk_prel_p1 FOREIGN KEY (n_party_sk) REFERENCES fsi_d_party (n_party_sk),
  CONSTRAINT fk_prel_p2 FOREIGN KEY (n_related_party_sk) REFERENCES fsi_d_party (n_party_sk)
);

CREATE TABLE fsi_d_party_rating (
  n_party_sk         NUMBER(18)    NOT NULL,
  v_rating_source    VARCHAR2(20)  NOT NULL,   -- INTERNAL | SP | MOODYS | FITCH | AMBEST
  v_rating_type      VARCHAR2(10)  NOT NULL,   -- ISSUER | ISSUE
  v_rating           VARCHAR2(10)  NOT NULL,
  n_pd_12m           NUMBER(9,8),
  d_rating_date      DATE          NOT NULL,
  CONSTRAINT pk_party_rating PRIMARY KEY (n_party_sk, v_rating_source, v_rating_type, d_rating_date),
  CONSTRAINT fk_prat_p FOREIGN KEY (n_party_sk) REFERENCES fsi_d_party (n_party_sk)
);

-- ---------------------------------------------------------------------------
-- 3. CONTRACT SPINE (every banking and insurance product hangs off this)
-- ---------------------------------------------------------------------------

CREATE TABLE fsi_d_contract (
  n_contract_sk      NUMBER(18)    GENERATED BY DEFAULT AS IDENTITY,
  v_contract_id      VARCHAR2(60)  NOT NULL,   -- account / policy / deal number
  v_source_system    VARCHAR2(30)  NOT NULL,
  v_business_class   VARCHAR2(10)  NOT NULL,   -- BANKING | INSURANCE
  v_contract_family  VARCHAR2(30)  NOT NULL,   -- see coverage map
  n_product_sk       NUMBER(18)    NOT NULL,
  n_org_sk           NUMBER(18)    NOT NULL,   -- booking entity (legal hierarchy node)
  n_mgmt_org_sk      NUMBER(18),               -- management unit; dimension, not key
  v_ccy_code         CHAR(3)       NOT NULL,
  d_origination      DATE          NOT NULL,
  d_start            DATE,
  d_maturity         DATE,
  v_status           VARCHAR2(20)  NOT NULL,   -- ACTIVE | CLOSED | WRITTEN_OFF | LAPSED | MATURED | CANCELLED
  d_close            DATE,
  v_book             VARCHAR2(10),             -- BANKING_BOOK | TRADING_BOOK | INSURANCE
  v_asset_liab_flag  CHAR(1),                  -- A asset | L liability | O off-balance
  v_channel          VARCHAR2(30),
  CONSTRAINT pk_fsi_d_contract PRIMARY KEY (n_contract_sk),
  CONSTRAINT uq_fsi_d_contract UNIQUE (v_contract_id, v_source_system),
  CONSTRAINT fk_ctr_prod FOREIGN KEY (n_product_sk) REFERENCES dim_product (n_product_sk),
  CONSTRAINT fk_ctr_org  FOREIGN KEY (n_org_sk) REFERENCES dim_org_unit (n_org_sk),
  CONSTRAINT fk_ctr_morg FOREIGN KEY (n_mgmt_org_sk) REFERENCES dim_org_unit (n_org_sk),
  CONSTRAINT fk_ctr_ccy  FOREIGN KEY (v_ccy_code) REFERENCES dim_currency (v_ccy_code),
  CONSTRAINT ck_ctr_cls  CHECK (v_business_class IN ('BANKING','INSURANCE')),
  CONSTRAINT ck_ctr_fam  CHECK (v_contract_family IN (
    'LOAN','MORTGAGE','LEASE','OVERDRAFT','CASA','TERM_DEPOSIT','CARD','FACILITY','TRADE_FINANCE',
    'INVESTMENT','DERIVATIVE','REPO_SBL','BORROWING',
    'LIFE','ANNUITY','HEALTH','PNC','REINS_ASSUMED')),
  CONSTRAINT ck_ctr_alf  CHECK (v_asset_liab_flag IN ('A','L','O'))
);
CREATE INDEX ix_ctr_family ON fsi_d_contract (v_contract_family, v_status);
CREATE INDEX ix_ctr_prod   ON fsi_d_contract (n_product_sk);

-- Party-to-contract with role. Borrower, depositor, policyholder, insured,
-- beneficiary, payer, guarantor, broker, reinsurer are all roles.
CREATE TABLE fsi_d_contract_party (
  n_contract_sk      NUMBER(18)    NOT NULL,
  n_party_sk         NUMBER(18)    NOT NULL,
  v_role             VARCHAR2(30)  NOT NULL,
  n_share_pct        NUMBER(7,4),
  d_eff_start        DATE          NOT NULL,
  d_eff_end          DATE          DEFAULT DATE '9999-12-31' NOT NULL,
  CONSTRAINT pk_ctr_party PRIMARY KEY (n_contract_sk, n_party_sk, v_role, d_eff_start),
  CONSTRAINT fk_cp_ctr FOREIGN KEY (n_contract_sk) REFERENCES fsi_d_contract (n_contract_sk),
  CONSTRAINT fk_cp_par FOREIGN KEY (n_party_sk) REFERENCES fsi_d_party (n_party_sk)
);
CREATE INDEX ix_cp_party ON fsi_d_contract_party (n_party_sk, v_role);

-- Contract-to-contract (facility -> drawn loan, hedge -> hedged item, master agreement -> deal).
CREATE TABLE fsi_d_contract_link (
  n_parent_contract_sk NUMBER(18)  NOT NULL,
  n_child_contract_sk  NUMBER(18)  NOT NULL,
  v_link_type        VARCHAR2(30)  NOT NULL,   -- FACILITY_DRAW | HEDGE | NETTING_SET | MASTER_AGREEMENT | REPLACED_BY
  CONSTRAINT pk_ctr_link PRIMARY KEY (n_parent_contract_sk, n_child_contract_sk, v_link_type),
  CONSTRAINT fk_cl_par FOREIGN KEY (n_parent_contract_sk) REFERENCES fsi_d_contract (n_contract_sk),
  CONSTRAINT fk_cl_chd FOREIGN KEY (n_child_contract_sk)  REFERENCES fsi_d_contract (n_contract_sk)
);

-- Term changes, forbearance, restructure (IFRS 9 modification gain/loss input).
CREATE TABLE fsi_d_contract_modification (
  n_modification_sk  NUMBER(18)    GENERATED BY DEFAULT AS IDENTITY,
  n_contract_sk      NUMBER(18)    NOT NULL,
  d_modification     DATE          NOT NULL,
  v_modification_type VARCHAR2(30) NOT NULL,   -- RESTRUCTURE | FORBEARANCE | RATE_CHANGE | TENOR_EXTENSION
  f_substantial      CHAR(1)       DEFAULT 'N' NOT NULL,
  n_gain_loss_amt    NUMBER(22,3),
  CONSTRAINT pk_ctr_mod PRIMARY KEY (n_modification_sk),
  CONSTRAINT fk_cm_ctr FOREIGN KEY (n_contract_sk) REFERENCES fsi_d_contract (n_contract_sk)
);

-- ---------------------------------------------------------------------------
-- 4. BANKING PRODUCT SUBTYPES (1:1 with fsi_d_contract on n_contract_sk)
-- ---------------------------------------------------------------------------

-- LOAN, MORTGAGE, LEASE, OVERDRAFT, TERM LOAN, SYNDICATED, FACTORING
CREATE TABLE fsi_d_loan_contract (
  n_contract_sk      NUMBER(18)    NOT NULL,
  v_loan_type        VARCHAR2(20)  NOT NULL,   -- PERSONAL | AUTO | MORTGAGE | SME | CORPORATE | LEASE | OVERDRAFT | STUDENT
  n_original_amt     NUMBER(22,3)  NOT NULL,
  n_term_months      NUMBER(4),
  v_rate_type        VARCHAR2(10)  NOT NULL,   -- FIXED | FLOATING | MIXED
  n_interest_rate    NUMBER(11,8),
  v_rate_index       VARCHAR2(20),             -- SOFR | EURIBOR | SONIA | PRIME
  n_spread           NUMBER(11,8),
  n_rate_floor       NUMBER(11,8),
  n_rate_cap         NUMBER(11,8),
  v_repay_type       VARCHAR2(20),             -- ANNUITY | LINEAR | BULLET | BALLOON | INTEREST_ONLY
  v_payment_freq     VARCHAR2(10),
  d_first_payment    DATE,
  d_next_reset       DATE,
  n_balloon_amt      NUMBER(22,3),
  n_ltv_origination  NUMBER(7,4),              -- mortgages
  v_purpose          VARCHAR2(30),
  f_secured          CHAR(1)       DEFAULT 'N' NOT NULL,
  f_syndicated       CHAR(1)       DEFAULT 'N' NOT NULL,
  n_our_share_pct    NUMBER(7,4),
  n_origination_fee  NUMBER(22,3),
  CONSTRAINT pk_fsi_d_loan PRIMARY KEY (n_contract_sk),
  CONSTRAINT fk_loan_ctr FOREIGN KEY (n_contract_sk) REFERENCES fsi_d_contract (n_contract_sk)
);

-- CASA: current, savings, NOW, notice accounts
CREATE TABLE fsi_d_casa_contract (
  n_contract_sk      NUMBER(18)    NOT NULL,
  v_account_type     VARCHAR2(20)  NOT NULL,   -- CURRENT | SAVINGS | NOTICE | MMDA | NOSTRO | VOSTRO
  n_interest_rate    NUMBER(11,8),
  v_rate_index       VARCHAR2(20),
  n_overdraft_limit  NUMBER(22,3),
  n_notice_days      NUMBER(3),
  v_interest_basis   VARCHAR2(10),             -- ACT/360 | ACT/365 | 30/360
  v_stability_class  VARCHAR2(20),             -- stable | less-stable (LCR / NSFR run-off)
  f_insured          CHAR(1)       DEFAULT 'N' NOT NULL,   -- deposit insurance eligible
  CONSTRAINT pk_fsi_d_casa PRIMARY KEY (n_contract_sk),
  CONSTRAINT fk_casa_ctr FOREIGN KEY (n_contract_sk) REFERENCES fsi_d_contract (n_contract_sk)
);

-- TERM DEPOSIT, CD, structured deposit
CREATE TABLE fsi_d_term_deposit (
  n_contract_sk      NUMBER(18)    NOT NULL,
  n_principal_amt    NUMBER(22,3)  NOT NULL,
  n_interest_rate    NUMBER(11,8)  NOT NULL,
  v_rate_type        VARCHAR2(10)  NOT NULL,
  v_interest_basis   VARCHAR2(10),
  v_interest_pay_freq VARCHAR2(10),
  f_auto_renew       CHAR(1)       DEFAULT 'N' NOT NULL,
  f_early_withdrawal CHAR(1)       DEFAULT 'N' NOT NULL,
  n_penalty_pct      NUMBER(7,4),
  CONSTRAINT pk_fsi_d_td PRIMARY KEY (n_contract_sk),
  CONSTRAINT fk_td_ctr FOREIGN KEY (n_contract_sk) REFERENCES fsi_d_contract (n_contract_sk)
);

-- CARDS: credit (revolving), debit, prepaid, charge
CREATE TABLE fsi_d_card_contract (
  n_contract_sk      NUMBER(18)    NOT NULL,
  v_card_type        VARCHAR2(15)  NOT NULL,   -- CREDIT | DEBIT | PREPAID | CHARGE
  v_network          VARCHAR2(15),
  n_credit_limit     NUMBER(22,3),
  n_purchase_apr     NUMBER(11,8),
  n_cash_apr         NUMBER(11,8),
  n_min_payment_pct  NUMBER(7,4),
  n_statement_day    NUMBER(2),
  n_annual_fee       NUMBER(22,3),
  v_rewards_program  VARCHAR2(30),
  n_rewards_liab_amt NUMBER(22,3),             -- IFRS 15 deferred revenue
  CONSTRAINT pk_fsi_d_card PRIMARY KEY (n_contract_sk),
  CONSTRAINT fk_card_ctr FOREIGN KEY (n_contract_sk) REFERENCES fsi_d_contract (n_contract_sk)
);

-- FACILITIES, LIMITS, COMMITMENTS (undrawn exposure and CCF input)
CREATE TABLE fsi_d_facility (
  n_contract_sk      NUMBER(18)    NOT NULL,
  v_facility_type    VARCHAR2(20)  NOT NULL,   -- REVOLVER | TERM | OVERDRAFT_LIMIT | LC_LINE | CREDIT_LINE
  n_committed_amt    NUMBER(22,3)  NOT NULL,
  n_uncommitted_amt  NUMBER(22,3),
  f_unconditionally_cancellable CHAR(1) DEFAULT 'N' NOT NULL,
  n_ccf              NUMBER(7,4),
  d_review           DATE,
  n_commitment_fee   NUMBER(11,8),
  CONSTRAINT pk_fsi_d_facility PRIMARY KEY (n_contract_sk),
  CONSTRAINT fk_fac_ctr FOREIGN KEY (n_contract_sk) REFERENCES fsi_d_contract (n_contract_sk)
);

-- TRADE FINANCE and OFF-BALANCE: letters of credit, guarantees, standbys, acceptances
CREATE TABLE fsi_d_trade_finance (
  n_contract_sk      NUMBER(18)    NOT NULL,
  v_instrument_type  VARCHAR2(20)  NOT NULL,   -- LC | STANDBY_LC | GUARANTEE | BANKERS_ACCEPT | BILL | DOC_COLLECTION
  v_direction        VARCHAR2(10),             -- ISSUED | CONFIRMED | ADVISED
  n_face_amt         NUMBER(22,3)  NOT NULL,
  n_beneficiary_party_sk NUMBER(18),
  d_expiry           DATE,
  v_guarantee_type   VARCHAR2(20),             -- PERFORMANCE | FINANCIAL | BID | ADVANCE_PAYMENT
  n_ccf              NUMBER(7,4),
  n_commission_rate  NUMBER(11,8),
  CONSTRAINT pk_fsi_d_tf PRIMARY KEY (n_contract_sk),
  CONSTRAINT fk_tf_ctr FOREIGN KEY (n_contract_sk) REFERENCES fsi_d_contract (n_contract_sk),
  CONSTRAINT fk_tf_ben FOREIGN KEY (n_beneficiary_party_sk) REFERENCES fsi_d_party (n_party_sk)
);

-- Instrument master (security reference data), separate from our holding of it
CREATE TABLE fsi_d_instrument (
  n_instrument_sk    NUMBER(18)    GENERATED BY DEFAULT AS IDENTITY,
  v_isin             CHAR(12),
  v_cusip            VARCHAR2(9),
  v_instrument_name  VARCHAR2(300) NOT NULL,
  v_instrument_type  VARCHAR2(20)  NOT NULL,   -- GOVT_BOND | CORP_BOND | EQUITY | FUND | MBS | ABS | COVERED_BOND | T_BILL
  n_issuer_party_sk  NUMBER(18),
  v_ccy_code         CHAR(3),
  n_coupon_rate      NUMBER(11,8),
  v_coupon_type      VARCHAR2(10),
  v_coupon_freq      VARCHAR2(10),
  d_issue            DATE,
  d_maturity         DATE,
  v_seniority        VARCHAR2(15),
  f_listed           CHAR(1)       DEFAULT 'N' NOT NULL,
  v_hqla_level       VARCHAR2(10),             -- L1 | L2A | L2B | NONE (LCR)
  CONSTRAINT pk_fsi_d_instr PRIMARY KEY (n_instrument_sk),
  CONSTRAINT fk_ins_iss FOREIGN KEY (n_issuer_party_sk) REFERENCES fsi_d_party (n_party_sk),
  CONSTRAINT fk_ins_ccy FOREIGN KEY (v_ccy_code) REFERENCES dim_currency (v_ccy_code)
);
CREATE UNIQUE INDEX ux_instr_isin ON fsi_d_instrument (v_isin);

-- INVESTMENTS: securities portfolio holding (banking book and insurer general account)
CREATE TABLE fsi_d_investment_holding (
  n_contract_sk      NUMBER(18)    NOT NULL,
  n_instrument_sk    NUMBER(18)    NOT NULL,
  v_ifrs9_category   VARCHAR2(10)  NOT NULL,   -- AC | FVOCI | FVTPL | HFT
  v_portfolio        VARCHAR2(30),
  n_face_amt         NUMBER(22,3),
  n_units            NUMBER(22,6),
  n_purchase_price   NUMBER(22,6),
  d_trade            DATE,
  d_settlement       DATE,
  n_eir              NUMBER(11,8),             -- effective interest rate
  CONSTRAINT pk_fsi_d_invest PRIMARY KEY (n_contract_sk),
  CONSTRAINT fk_inv_ctr FOREIGN KEY (n_contract_sk) REFERENCES fsi_d_contract (n_contract_sk),
  CONSTRAINT fk_inv_ins FOREIGN KEY (n_instrument_sk) REFERENCES fsi_d_instrument (n_instrument_sk)
);

-- DERIVATIVES: header; legs carry the rate and notional detail
CREATE TABLE fsi_d_derivative (
  n_contract_sk      NUMBER(18)    NOT NULL,
  v_deriv_type       VARCHAR2(15)  NOT NULL,   -- IRS | CCS | FX_FWD | FX_OPTION | FUTURE | OPTION | CDS | TRS | SWAPTION
  v_asset_class      VARCHAR2(10),             -- IR | FX | EQ | CR | CMDTY
  n_notional_amt     NUMBER(22,3)  NOT NULL,
  v_notional_ccy     CHAR(3)       NOT NULL,
  d_trade            DATE          NOT NULL,
  d_effective        DATE,
  v_cleared          VARCHAR2(10),             -- OTC | CCP | EXCHANGE
  n_ccp_party_sk     NUMBER(18),
  v_hedge_designation VARCHAR2(10),            -- NONE | FAIR_VALUE | CASH_FLOW | NET_INV
  v_option_type      VARCHAR2(4),              -- CALL | PUT
  n_strike           NUMBER(22,8),
  v_exercise_style   VARCHAR2(10),
  CONSTRAINT pk_fsi_d_deriv PRIMARY KEY (n_contract_sk),
  CONSTRAINT fk_der_ctr FOREIGN KEY (n_contract_sk) REFERENCES fsi_d_contract (n_contract_sk)
);

CREATE TABLE fsi_d_derivative_leg (
  n_contract_sk      NUMBER(18)    NOT NULL,
  n_leg_no           NUMBER(2)     NOT NULL,
  v_pay_receive      CHAR(1)       NOT NULL,   -- P | R
  v_leg_type         VARCHAR2(10)  NOT NULL,   -- FIXED | FLOAT | FX | PREMIUM | PROTECTION
  v_ccy_code         CHAR(3)       NOT NULL,
  n_notional_amt     NUMBER(22,3),
  n_fixed_rate       NUMBER(11,8),
  v_rate_index       VARCHAR2(20),
  n_spread           NUMBER(11,8),
  v_pay_freq         VARCHAR2(10),
  v_day_count        VARCHAR2(10),
  CONSTRAINT pk_fsi_d_dleg PRIMARY KEY (n_contract_sk, n_leg_no),
  CONSTRAINT fk_dleg_der FOREIGN KEY (n_contract_sk) REFERENCES fsi_d_derivative (n_contract_sk),
  CONSTRAINT ck_dleg_pr CHECK (v_pay_receive IN ('P','R'))
);

-- REPO, REVERSE REPO, SECURITIES LENDING / BORROWING
CREATE TABLE fsi_d_repo_sbl (
  n_contract_sk      NUMBER(18)    NOT NULL,
  v_txn_type         VARCHAR2(15)  NOT NULL,   -- REPO | REVERSE_REPO | SEC_LEND | SEC_BORROW
  n_cash_amt         NUMBER(22,3),
  n_repo_rate        NUMBER(11,8),
  n_instrument_sk    NUMBER(18),
  n_collateral_qty   NUMBER(22,6),
  n_haircut_pct      NUMBER(7,4),
  d_start            DATE,
  d_end              DATE,
  f_open_term        CHAR(1)       DEFAULT 'N' NOT NULL,
  CONSTRAINT pk_fsi_d_repo PRIMARY KEY (n_contract_sk),
  CONSTRAINT fk_repo_ctr FOREIGN KEY (n_contract_sk) REFERENCES fsi_d_contract (n_contract_sk),
  CONSTRAINT fk_repo_ins FOREIGN KEY (n_instrument_sk) REFERENCES fsi_d_instrument (n_instrument_sk)
);

-- BORROWINGS: issued debt, interbank funding, central bank facilities, subordinated debt
CREATE TABLE fsi_d_borrowing (
  n_contract_sk      NUMBER(18)    NOT NULL,
  v_borrowing_type   VARCHAR2(20)  NOT NULL,   -- ISSUED_BOND | COVERED_BOND | INTERBANK | CENTRAL_BANK | SUB_DEBT | AT1
  n_principal_amt    NUMBER(22,3)  NOT NULL,
  n_interest_rate    NUMBER(11,8),
  v_rate_type        VARCHAR2(10),
  v_rate_index       VARCHAR2(20),
  n_spread           NUMBER(11,8),
  v_isin             CHAR(12),
  f_callable         CHAR(1)       DEFAULT 'N' NOT NULL,
  d_first_call       DATE,
  v_capital_tier     VARCHAR2(10),             -- CET1 | AT1 | T2 | NONE
  CONSTRAINT pk_fsi_d_borrow PRIMARY KEY (n_contract_sk),
  CONSTRAINT fk_bor_ctr FOREIGN KEY (n_contract_sk) REFERENCES fsi_d_contract (n_contract_sk)
);

-- ---------------------------------------------------------------------------
-- 5. COLLATERAL (banking credit risk mitigation; insurers use it for reinsurance too)
-- ---------------------------------------------------------------------------

CREATE TABLE fsi_d_collateral (
  n_collateral_sk    NUMBER(18)    GENERATED BY DEFAULT AS IDENTITY,
  v_collateral_id    VARCHAR2(60)  NOT NULL,
  v_collateral_type  VARCHAR2(25)  NOT NULL,   -- RESIDENTIAL_RE | COMMERCIAL_RE | CASH | SECURITIES | VEHICLE | GUARANTEE | LIFE_POLICY | RECEIVABLES
  n_owner_party_sk   NUMBER(18),
  n_instrument_sk    NUMBER(18),
  v_ccy_code         CHAR(3)       NOT NULL,
  n_market_value     NUMBER(22,3),
  d_valuation        DATE,
  n_haircut_pct      NUMBER(7,4),
  n_lien_rank        NUMBER(2),
  v_country_code     CHAR(2),
  CONSTRAINT pk_fsi_d_coll PRIMARY KEY (n_collateral_sk),
  CONSTRAINT uq_fsi_d_coll UNIQUE (v_collateral_id),
  CONSTRAINT fk_col_own FOREIGN KEY (n_owner_party_sk) REFERENCES fsi_d_party (n_party_sk),
  CONSTRAINT fk_col_ins FOREIGN KEY (n_instrument_sk) REFERENCES fsi_d_instrument (n_instrument_sk)
);

CREATE TABLE fsi_d_contract_collateral (
  n_contract_sk      NUMBER(18)    NOT NULL,
  n_collateral_sk    NUMBER(18)    NOT NULL,
  n_allocated_amt    NUMBER(22,3),
  n_allocation_pct   NUMBER(7,4),
  CONSTRAINT pk_ctr_coll PRIMARY KEY (n_contract_sk, n_collateral_sk),
  CONSTRAINT fk_cc_ctr FOREIGN KEY (n_contract_sk) REFERENCES fsi_d_contract (n_contract_sk),
  CONSTRAINT fk_cc_col FOREIGN KEY (n_collateral_sk) REFERENCES fsi_d_collateral (n_collateral_sk)
);

-- ---------------------------------------------------------------------------
-- 6. INSURANCE PRODUCT SUBTYPES (policy sits on fsi_d_contract)
-- ---------------------------------------------------------------------------

-- IFRS 17 grouping: portfolio -> annual cohort -> profitability group. Measurement
-- happens at group level, so policies must carry the group key from day one.
CREATE TABLE fsi_d_ins_group (
  n_group_sk         NUMBER(18)    GENERATED BY DEFAULT AS IDENTITY,
  v_group_id         VARCHAR2(60)  NOT NULL,
  v_portfolio        VARCHAR2(40)  NOT NULL,   -- similar risks, managed together
  n_cohort_year      NUMBER(4)     NOT NULL,
  v_profit_bucket    VARCHAR2(15)  NOT NULL,   -- ONEROUS | NO_SIG_RISK | OTHER
  v_measurement_model VARCHAR2(5)  NOT NULL,   -- GMM | PAA | VFA
  v_direction        VARCHAR2(10)  NOT NULL,   -- ISSUED | REINS_HELD
  n_org_sk           NUMBER(18)    NOT NULL,
  v_ccy_code         CHAR(3)       NOT NULL,
  CONSTRAINT pk_fsi_d_ins_group PRIMARY KEY (n_group_sk),
  CONSTRAINT uq_fsi_d_ins_group UNIQUE (v_group_id),
  CONSTRAINT fk_grp_org FOREIGN KEY (n_org_sk) REFERENCES dim_org_unit (n_org_sk),
  CONSTRAINT ck_grp_model CHECK (v_measurement_model IN ('GMM','PAA','VFA'))
);

-- Policy: fields common to every line of business
CREATE TABLE fsi_d_ins_policy (
  n_contract_sk      NUMBER(18)    NOT NULL,
  v_line_of_business VARCHAR2(10)  NOT NULL,   -- LIFE | ANNUITY | HEALTH | PNC | REINS
  v_policy_status    VARCHAR2(20)  NOT NULL,   -- IN_FORCE | LAPSED | PAID_UP | SURRENDERED | CLAIMED | EXPIRED
  d_inception        DATE          NOT NULL,
  d_expiry           DATE,
  d_issue            DATE,
  v_premium_freq     VARCHAR2(10),             -- SINGLE | MONTHLY | QUARTERLY | ANNUAL
  n_premium_amt      NUMBER(22,3),
  n_sum_insured      NUMBER(22,3),
  n_underwriting_year NUMBER(4),
  v_distribution     VARCHAR2(20),             -- AGENT | BROKER | BANCASSURANCE | DIRECT
  n_broker_party_sk  NUMBER(18),
  f_participating    CHAR(1)       DEFAULT 'N' NOT NULL,
  n_group_sk         NUMBER(18),               -- IFRS 17 group of contracts
  v_underwriting_class VARCHAR2(20),
  d_next_renewal     DATE,
  CONSTRAINT pk_fsi_d_ins_pol PRIMARY KEY (n_contract_sk),
  CONSTRAINT fk_pol_ctr FOREIGN KEY (n_contract_sk) REFERENCES fsi_d_contract (n_contract_sk),
  CONSTRAINT fk_pol_grp FOREIGN KEY (n_group_sk) REFERENCES fsi_d_ins_group (n_group_sk),
  CONSTRAINT fk_pol_brk FOREIGN KEY (n_broker_party_sk) REFERENCES fsi_d_party (n_party_sk),
  CONSTRAINT ck_pol_lob CHECK (v_line_of_business IN ('LIFE','ANNUITY','HEALTH','PNC','REINS'))
);
CREATE INDEX ix_pol_grp ON fsi_d_ins_policy (n_group_sk);

-- Coverages / riders / benefit lines under a policy
CREATE TABLE fsi_d_ins_coverage (
  n_coverage_sk      NUMBER(18)    GENERATED BY DEFAULT AS IDENTITY,
  n_contract_sk      NUMBER(18)    NOT NULL,
  v_coverage_code    VARCHAR2(30)  NOT NULL,   -- DEATH | TPD | CI | HOSPITAL | COLLISION | FIRE | THEFT | LIABILITY | RIDER_*
  f_rider            CHAR(1)       DEFAULT 'N' NOT NULL,
  n_sum_insured      NUMBER(22,3),
  n_deductible       NUMBER(22,3),
  n_limit_amt        NUMBER(22,3),
  n_coverage_premium NUMBER(22,3),
  d_start            DATE,
  d_end              DATE,
  CONSTRAINT pk_fsi_d_ins_cov PRIMARY KEY (n_coverage_sk),
  CONSTRAINT fk_cov_pol FOREIGN KEY (n_contract_sk) REFERENCES fsi_d_ins_policy (n_contract_sk)
);

-- LIFE: term, whole life, endowment, universal life, unit-linked
CREATE TABLE fsi_d_ins_life (
  n_contract_sk      NUMBER(18)    NOT NULL,
  v_plan_type        VARCHAR2(15)  NOT NULL,   -- TERM | WHOLE_LIFE | ENDOWMENT | UNIVERSAL | UNIT_LINKED
  n_policy_term_yrs  NUMBER(3),
  n_premium_term_yrs NUMBER(3),
  n_guaranteed_rate  NUMBER(11,8),
  v_mortality_table  VARCHAR2(30),
  v_smoker_status    VARCHAR2(10),
  n_surrender_value  NUMBER(22,3),
  n_account_value    NUMBER(22,3),             -- universal / unit-linked fund value
  v_fund_code        VARCHAR2(30),
  f_with_profits     CHAR(1)       DEFAULT 'N' NOT NULL,
  CONSTRAINT pk_fsi_d_ins_life PRIMARY KEY (n_contract_sk),
  CONSTRAINT fk_life_pol FOREIGN KEY (n_contract_sk) REFERENCES fsi_d_ins_policy (n_contract_sk)
);

-- ANNUITY: immediate, deferred, fixed, variable, indexed
CREATE TABLE fsi_d_ins_annuity (
  n_contract_sk      NUMBER(18)    NOT NULL,
  v_annuity_type     VARCHAR2(15)  NOT NULL,   -- IMMEDIATE | DEFERRED | FIXED | VARIABLE | INDEXED
  v_payout_phase     VARCHAR2(15),             -- ACCUMULATION | PAYOUT
  n_annual_payout    NUMBER(22,3),
  n_guaranteed_period_yrs NUMBER(3),
  v_payout_basis     VARCHAR2(20),             -- LIFE | JOINT_LIFE | PERIOD_CERTAIN
  n_gmdb_amt         NUMBER(22,3),             -- guaranteed minimum death benefit
  n_gmwb_amt         NUMBER(22,3),             -- guaranteed minimum withdrawal benefit
  d_annuitisation    DATE,
  CONSTRAINT pk_fsi_d_ins_ann PRIMARY KEY (n_contract_sk),
  CONSTRAINT fk_ann_pol FOREIGN KEY (n_contract_sk) REFERENCES fsi_d_ins_policy (n_contract_sk)
);

-- HEALTH, critical illness, disability
CREATE TABLE fsi_d_ins_health (
  n_contract_sk      NUMBER(18)    NOT NULL,
  v_plan_type        VARCHAR2(20)  NOT NULL,   -- INDIVIDUAL | GROUP | CRITICAL_ILLNESS | DISABILITY | DENTAL
  v_network_type     VARCHAR2(10),
  n_annual_limit     NUMBER(22,3),
  n_copay_pct        NUMBER(7,4),
  n_waiting_days     NUMBER(4),
  n_members_covered  NUMBER(8),
  f_renewable        CHAR(1)       DEFAULT 'Y' NOT NULL,
  CONSTRAINT pk_fsi_d_ins_hlth PRIMARY KEY (n_contract_sk),
  CONSTRAINT fk_hlth_pol FOREIGN KEY (n_contract_sk) REFERENCES fsi_d_ins_policy (n_contract_sk)
);

-- Insured object: vehicle, building, cargo, vessel, person (generic key-attribute pair)
CREATE TABLE fsi_d_ins_insured_object (
  n_object_sk        NUMBER(18)    GENERATED BY DEFAULT AS IDENTITY,
  v_object_type      VARCHAR2(20)  NOT NULL,   -- VEHICLE | BUILDING | CONTENTS | CARGO | VESSEL | EQUIPMENT
  v_object_ref       VARCHAR2(60),             -- VIN, address key, IMO number
  n_insured_value    NUMBER(22,3),
  v_ccy_code         CHAR(3),
  v_country_code     CHAR(2),
  v_location_risk_zone VARCHAR2(20),           -- flood / quake / cat zone
  n_year_built       NUMBER(4),
  CONSTRAINT pk_fsi_d_ins_obj PRIMARY KEY (n_object_sk)
);

-- PROPERTY and CASUALTY: motor, property, liability, marine, engineering
CREATE TABLE fsi_d_ins_pnc (
  n_contract_sk      NUMBER(18)    NOT NULL,
  v_pnc_class        VARCHAR2(20)  NOT NULL,   -- MOTOR | PROPERTY | LIABILITY | MARINE | ENGINEERING | CYBER | CROP
  n_object_sk        NUMBER(18),
  n_policy_limit     NUMBER(22,3),
  n_deductible       NUMBER(22,3),
  n_expected_loss_ratio NUMBER(7,4),
  f_cat_exposed      CHAR(1)       DEFAULT 'N' NOT NULL,
  n_no_claims_bonus_pct NUMBER(7,4),
  CONSTRAINT pk_fsi_d_ins_pnc PRIMARY KEY (n_contract_sk),
  CONSTRAINT fk_pnc_pol FOREIGN KEY (n_contract_sk) REFERENCES fsi_d_ins_policy (n_contract_sk),
  CONSTRAINT fk_pnc_obj FOREIGN KEY (n_object_sk) REFERENCES fsi_d_ins_insured_object (n_object_sk)
);

-- CLAIMS
CREATE TABLE fsi_d_ins_claim (
  n_claim_sk         NUMBER(18)    GENERATED BY DEFAULT AS IDENTITY,
  v_claim_id         VARCHAR2(60)  NOT NULL,
  n_contract_sk      NUMBER(18)    NOT NULL,
  n_coverage_sk      NUMBER(18),
  d_loss             DATE          NOT NULL,   -- date of loss / accident date
  d_reported         DATE          NOT NULL,
  d_closed           DATE,
  v_claim_status     VARCHAR2(15)  NOT NULL,   -- OPEN | CLOSED | REOPENED | DENIED | LITIGATED
  v_cause_code       VARCHAR2(30),
  n_claimant_party_sk NUMBER(18),
  f_catastrophe      CHAR(1)       DEFAULT 'N' NOT NULL,
  v_cat_event_code   VARCHAR2(30),
  CONSTRAINT pk_fsi_d_ins_clm PRIMARY KEY (n_claim_sk),
  CONSTRAINT uq_fsi_d_ins_clm UNIQUE (v_claim_id),
  CONSTRAINT fk_clm_pol FOREIGN KEY (n_contract_sk) REFERENCES fsi_d_ins_policy (n_contract_sk),
  CONSTRAINT fk_clm_cov FOREIGN KEY (n_coverage_sk) REFERENCES fsi_d_ins_coverage (n_coverage_sk),
  CONSTRAINT fk_clm_cmt FOREIGN KEY (n_claimant_party_sk) REFERENCES fsi_d_party (n_party_sk)
);
CREATE INDEX ix_clm_pol ON fsi_d_ins_claim (n_contract_sk);

-- REINSURANCE treaty (ceded or assumed) and per-policy / per-claim cessions
CREATE TABLE fsi_d_ins_reins_treaty (
  n_treaty_sk        NUMBER(18)    GENERATED BY DEFAULT AS IDENTITY,
  v_treaty_id        VARCHAR2(60)  NOT NULL,
  v_direction        VARCHAR2(10)  NOT NULL,   -- CEDED | ASSUMED
  v_treaty_type      VARCHAR2(20)  NOT NULL,   -- QUOTA_SHARE | SURPLUS | XOL | STOP_LOSS | FACULTATIVE
  n_reinsurer_party_sk NUMBER(18)  NOT NULL,
  n_share_pct        NUMBER(7,4),
  n_retention_amt    NUMBER(22,3),
  n_limit_amt        NUMBER(22,3),
  d_inception        DATE          NOT NULL,
  d_expiry           DATE,
  v_ccy_code         CHAR(3),
  CONSTRAINT pk_fsi_d_reins_trt PRIMARY KEY (n_treaty_sk),
  CONSTRAINT uq_fsi_d_reins_trt UNIQUE (v_treaty_id),
  CONSTRAINT fk_trt_rp FOREIGN KEY (n_reinsurer_party_sk) REFERENCES fsi_d_party (n_party_sk)
);

CREATE TABLE fsi_d_ins_reins_cession (
  n_treaty_sk        NUMBER(18)    NOT NULL,
  n_contract_sk      NUMBER(18)    NOT NULL,
  n_ceded_share_pct  NUMBER(7,4),
  n_ceded_sum_insured NUMBER(22,3),
  CONSTRAINT pk_fsi_d_reins_ces PRIMARY KEY (n_treaty_sk, n_contract_sk),
  CONSTRAINT fk_ces_trt FOREIGN KEY (n_treaty_sk) REFERENCES fsi_d_ins_reins_treaty (n_treaty_sk),
  CONSTRAINT fk_ces_pol FOREIGN KEY (n_contract_sk) REFERENCES fsi_d_ins_policy (n_contract_sk)
);

-- ---------------------------------------------------------------------------
-- 7. FACTS AND RESULTS (FCT_)
-- ---------------------------------------------------------------------------

-- Market data
CREATE TABLE fct_fx_rate (
  fic_mis_date       DATE          NOT NULL,
  v_from_ccy         CHAR(3)       NOT NULL,
  v_to_ccy           CHAR(3)       NOT NULL,
  v_rate_type        VARCHAR2(10)  NOT NULL,   -- SPOT | AVERAGE | CLOSING | BUDGET
  n_rate             NUMBER(24,10) NOT NULL,
  CONSTRAINT pk_fct_fx PRIMARY KEY (fic_mis_date, v_from_ccy, v_to_ccy, v_rate_type)
);

CREATE TABLE fct_rate_curve (
  fic_mis_date       DATE          NOT NULL,
  v_curve_id         VARCHAR2(30)  NOT NULL,   -- SOFR, EUR_GOVT, INS_DISCOUNT_ILLIQ, FTP_BASE
  n_tenor_days       NUMBER(6)     NOT NULL,
  n_rate             NUMBER(11,8)  NOT NULL,
  CONSTRAINT pk_fct_curve PRIMARY KEY (fic_mis_date, v_curve_id, n_tenor_days)
);

CREATE TABLE fct_market_price (
  fic_mis_date       DATE          NOT NULL,
  n_instrument_sk    NUMBER(18)    NOT NULL,
  n_price            NUMBER(22,8)  NOT NULL,
  v_price_source     VARCHAR2(20),
  v_fv_level         CHAR(1),                  -- 1 | 2 | 3 hierarchy
  CONSTRAINT pk_fct_px PRIMARY KEY (fic_mis_date, n_instrument_sk),
  CONSTRAINT fk_px_ins FOREIGN KEY (n_instrument_sk) REFERENCES fsi_d_instrument (n_instrument_sk)
);

-- Position: contract x date x ledger. THE reconciliation anchor to the GL.
-- Banking and insurance share it; insurance uses reserve / account value columns.
CREATE TABLE fct_position (
  fic_mis_date       DATE          NOT NULL,
  n_contract_sk      NUMBER(18)    NOT NULL,
  v_ledger           VARCHAR2(15)  NOT NULL,   -- IFRS | LOCAL_GAAP | TAX | MGMT
  v_ccy_code         CHAR(3)       NOT NULL,
  n_principal_bal    NUMBER(22,3),
  n_accrued_interest NUMBER(22,3),
  n_unamortised_fee  NUMBER(22,3),
  n_carrying_amt     NUMBER(22,3),             -- amortised cost / carrying value
  n_fair_value       NUMBER(22,3),
  n_impairment_allow NUMBER(22,3),
  n_undrawn_amt      NUMBER(22,3),
  n_carrying_amt_rpt NUMBER(22,3),             -- in reporting currency
  n_days_past_due    NUMBER(5),
  n_ifrs9_stage      NUMBER(1),
  f_poci             CHAR(1)       DEFAULT 'N' NOT NULL,   -- purchased or originated credit-impaired
  v_measure_class    VARCHAR2(10),             -- AC | FVOCI | FVTPL
  n_account_value    NUMBER(22,3),             -- insurance: policy account / fund value
  n_gross_reserve    NUMBER(22,3),             -- insurance: statutory / local reserve
  n_unearned_premium NUMBER(22,3),
  CONSTRAINT pk_fct_position PRIMARY KEY (fic_mis_date, n_contract_sk, v_ledger),
  CONSTRAINT fk_pos_ctr FOREIGN KEY (n_contract_sk) REFERENCES fsi_d_contract (n_contract_sk),
  CONSTRAINT fk_pos_ccy FOREIGN KEY (v_ccy_code) REFERENCES dim_currency (v_ccy_code)
)
PARTITION BY RANGE (fic_mis_date) INTERVAL (NUMTOYMINTERVAL(1,'MONTH'))
(PARTITION p_initial VALUES LESS THAN (DATE '2020-01-01'));

-- Cashflow: contractual and expected, feeds ALM, IFRS 9 EIR, IFRS 17 BEL
CREATE TABLE fct_cashflow (
  fic_mis_date       DATE          NOT NULL,
  n_contract_sk      NUMBER(18)    NOT NULL,
  d_cashflow         DATE          NOT NULL,
  v_flow_type        VARCHAR2(20)  NOT NULL,   -- PRINCIPAL | INTEREST | PREMIUM | CLAIM | EXPENSE | COMMISSION | SURRENDER | MATURITY | FEE
  v_basis            VARCHAR2(12)  NOT NULL,   -- CONTRACTUAL | EXPECTED | STRESSED
  v_ccy_code         CHAR(3)       NOT NULL,
  n_amount           NUMBER(22,3)  NOT NULL,   -- signed: inflow positive
  CONSTRAINT pk_fct_cf PRIMARY KEY (fic_mis_date, n_contract_sk, d_cashflow, v_flow_type, v_basis),
  CONSTRAINT fk_cf_ctr FOREIGN KEY (n_contract_sk) REFERENCES fsi_d_contract (n_contract_sk)
)
PARTITION BY RANGE (fic_mis_date) INTERVAL (NUMTOYMINTERVAL(1,'MONTH'))
(PARTITION p_initial VALUES LESS THAN (DATE '2020-01-01'));

-- Business event: the Accounting Hub input and lineage anchor
CREATE TABLE fct_event (
  n_event_sk         NUMBER(18)    GENERATED BY DEFAULT AS IDENTITY,
  n_contract_sk      NUMBER(18)    NOT NULL,
  v_event_type       VARCHAR2(30)  NOT NULL,   -- DISBURSEMENT | REPAYMENT | ACCRUAL | FEE | PREMIUM_DUE | CLAIM_PAID | RESERVE_CHANGE | MTM | WRITE_OFF
  d_effective        DATE          NOT NULL,
  d_booking          DATE          NOT NULL,
  v_ccy_code         CHAR(3)       NOT NULL,
  n_amount           NUMBER(22,3)  NOT NULL,
  n_claim_sk         NUMBER(18),
  v_source_txn_id    VARCHAR2(80),
  CONSTRAINT pk_fct_event PRIMARY KEY (n_event_sk),
  CONSTRAINT fk_evt_ctr FOREIGN KEY (n_contract_sk) REFERENCES fsi_d_contract (n_contract_sk),
  CONSTRAINT fk_evt_clm FOREIGN KEY (n_claim_sk) REFERENCES fsi_d_ins_claim (n_claim_sk)
);
CREATE INDEX ix_evt_ctr ON fct_event (n_contract_sk, d_effective);

-- Journal: output of the accounting engine, never a source. Carries its event key.
CREATE TABLE fct_journal (
  n_journal_sk       NUMBER(18)    GENERATED BY DEFAULT AS IDENTITY,
  n_event_sk         NUMBER(18)    NOT NULL,
  v_ledger           VARCHAR2(15)  NOT NULL,
  n_gl_account_sk    NUMBER(18)    NOT NULL,
  n_org_sk           NUMBER(18)    NOT NULL,   -- segment: Entity
  n_cost_centre_sk   NUMBER(18)    DEFAULT -1 NOT NULL,   -- segment: CostCentre
  n_mgmt_org_sk      NUMBER(18)    DEFAULT -1 NOT NULL,   -- segment: BusinessLine
  n_product_sk       NUMBER(18)    DEFAULT -1 NOT NULL,   -- segment: Product
  v_credit_stage     VARCHAR2(4)   DEFAULT 'NA' NOT NULL, -- segment: CreditStage
  n_ic_org_sk        NUMBER(18)    DEFAULT -1 NOT NULL,   -- segment: Intercompany
  d_accounting       DATE          NOT NULL,
  v_ccy_code         CHAR(3)       NOT NULL,
  n_debit_amt        NUMBER(22,3)  DEFAULT 0 NOT NULL,
  n_credit_amt       NUMBER(22,3)  DEFAULT 0 NOT NULL,
  f_adjustment       CHAR(1)       DEFAULT 'N' NOT NULL,   -- manual / top-side, same dimensions
  CONSTRAINT pk_fct_journal PRIMARY KEY (n_journal_sk),
  CONSTRAINT fk_jnl_evt FOREIGN KEY (n_event_sk) REFERENCES fct_event (n_event_sk),
  CONSTRAINT fk_jnl_gl  FOREIGN KEY (n_gl_account_sk) REFERENCES dim_gl_account (n_gl_account_sk),
  CONSTRAINT fk_jnl_org FOREIGN KEY (n_org_sk) REFERENCES dim_org_unit (n_org_sk),
  CONSTRAINT fk_jnl_cc  FOREIGN KEY (n_cost_centre_sk) REFERENCES dim_org_unit (n_org_sk),
  CONSTRAINT fk_jnl_bl  FOREIGN KEY (n_mgmt_org_sk) REFERENCES dim_org_unit (n_org_sk),
  CONSTRAINT fk_jnl_prd FOREIGN KEY (n_product_sk) REFERENCES dim_product (n_product_sk),
  CONSTRAINT fk_jnl_ic  FOREIGN KEY (n_ic_org_sk) REFERENCES dim_org_unit (n_org_sk),
  CONSTRAINT ck_jnl_stg CHECK (v_credit_stage IN ('1','2','3','POCI','NA')),
  CONSTRAINT ck_jnl_amt CHECK ((n_debit_amt = 0 AND n_credit_amt >= 0) OR (n_credit_amt = 0 AND n_debit_amt >= 0))
);
CREATE INDEX ix_jnl_evt ON fct_journal (n_event_sk);
CREATE INDEX ix_jnl_gl  ON fct_journal (n_gl_account_sk, d_accounting);

CREATE TABLE fct_gl_balance (
  fic_mis_date       DATE          NOT NULL,
  v_ledger           VARCHAR2(15)  NOT NULL,
  n_gl_account_sk    NUMBER(18)    NOT NULL,
  n_org_sk           NUMBER(18)    NOT NULL,
  n_cost_centre_sk   NUMBER(18)    DEFAULT -1 NOT NULL,
  n_mgmt_org_sk      NUMBER(18)    DEFAULT -1 NOT NULL,
  n_product_sk       NUMBER(18)    DEFAULT -1 NOT NULL,
  v_credit_stage     VARCHAR2(4)   DEFAULT 'NA' NOT NULL,
  n_ic_org_sk        NUMBER(18)    DEFAULT -1 NOT NULL,
  v_ccy_code         CHAR(3)       NOT NULL,
  n_balance          NUMBER(22,3)  NOT NULL,
  n_balance_rpt      NUMBER(22,3),
  -- Grain = the full volt-ledger segment string plus currency.
  CONSTRAINT pk_fct_glbal PRIMARY KEY (fic_mis_date, v_ledger, n_gl_account_sk, n_org_sk,
    n_cost_centre_sk, n_mgmt_org_sk, n_product_sk, v_credit_stage, n_ic_org_sk, v_ccy_code),
  CONSTRAINT fk_glb_gl  FOREIGN KEY (n_gl_account_sk) REFERENCES dim_gl_account (n_gl_account_sk),
  CONSTRAINT fk_glb_org FOREIGN KEY (n_org_sk) REFERENCES dim_org_unit (n_org_sk),
  CONSTRAINT fk_glb_cc  FOREIGN KEY (n_cost_centre_sk) REFERENCES dim_org_unit (n_org_sk),
  CONSTRAINT fk_glb_bl  FOREIGN KEY (n_mgmt_org_sk) REFERENCES dim_org_unit (n_org_sk),
  CONSTRAINT fk_glb_prd FOREIGN KEY (n_product_sk) REFERENCES dim_product (n_product_sk),
  CONSTRAINT fk_glb_ic  FOREIGN KEY (n_ic_org_sk) REFERENCES dim_org_unit (n_org_sk),
  CONSTRAINT ck_glb_stg CHECK (v_credit_stage IN ('1','2','3','POCI','NA'))
);

-- Credit risk parameters and IFRS 9 ECL (banking contracts; also reinsurance assets, investments)
CREATE TABLE fct_expected_loss (
  fic_mis_date       DATE          NOT NULL,
  n_contract_sk      NUMBER(18)    NOT NULL,
  v_scenario         VARCHAR2(20)  NOT NULL,   -- BASE | UPSIDE | DOWNSIDE | WEIGHTED
  n_ifrs9_stage      NUMBER(1)     NOT NULL,
  n_pd_12m           NUMBER(9,8),
  n_pd_lifetime      NUMBER(9,8),
  n_lgd              NUMBER(9,8),
  n_ead              NUMBER(22,3),
  n_ecl_12m          NUMBER(22,3),
  n_ecl_lifetime     NUMBER(22,3),
  n_ecl_booked       NUMBER(22,3),
  f_sicr             CHAR(1)       DEFAULT 'N' NOT NULL,
  f_credit_impaired  CHAR(1)       DEFAULT 'N' NOT NULL,
  CONSTRAINT pk_fct_ecl PRIMARY KEY (fic_mis_date, n_contract_sk, v_scenario),
  CONSTRAINT fk_ecl_ctr FOREIGN KEY (n_contract_sk) REFERENCES fsi_d_contract (n_contract_sk)
);

-- Insurance premium (written / earned / unearned) per policy per period
CREATE TABLE fct_ins_premium (
  fic_mis_date       DATE          NOT NULL,
  n_contract_sk      NUMBER(18)    NOT NULL,
  v_ccy_code         CHAR(3)       NOT NULL,
  n_written_premium  NUMBER(22,3),
  n_earned_premium   NUMBER(22,3),
  n_unearned_premium NUMBER(22,3),
  n_ceded_premium    NUMBER(22,3),
  n_commission       NUMBER(22,3),
  n_premium_receivable NUMBER(22,3),
  CONSTRAINT pk_fct_ins_prem PRIMARY KEY (fic_mis_date, n_contract_sk),
  CONSTRAINT fk_prem_pol FOREIGN KEY (n_contract_sk) REFERENCES fsi_d_ins_policy (n_contract_sk)
);

-- Insurance claim financials: paid, case reserve, IBNR allocation
CREATE TABLE fct_ins_claim_financial (
  fic_mis_date       DATE          NOT NULL,
  n_claim_sk         NUMBER(18)    NOT NULL,
  v_ccy_code         CHAR(3)       NOT NULL,
  n_paid_indemnity   NUMBER(22,3),
  n_paid_expense     NUMBER(22,3),
  n_case_reserve     NUMBER(22,3),
  n_ibnr_alloc       NUMBER(22,3),
  n_recovery_salvage NUMBER(22,3),
  n_reins_recoverable NUMBER(22,3),
  CONSTRAINT pk_fct_clm_fin PRIMARY KEY (fic_mis_date, n_claim_sk),
  CONSTRAINT fk_cfin_clm FOREIGN KEY (n_claim_sk) REFERENCES fsi_d_ins_claim (n_claim_sk)
);

-- IFRS 17 measurement at group level: LRC = BEL + RA + CSM ; LIC for incurred claims
CREATE TABLE fct_ifrs17_measurement (
  fic_mis_date       DATE          NOT NULL,
  n_group_sk         NUMBER(18)    NOT NULL,
  v_ccy_code         CHAR(3)       NOT NULL,
  n_bel              NUMBER(22,3),             -- best estimate liability (PV future cashflows)
  n_risk_adjustment  NUMBER(22,3),
  n_csm              NUMBER(22,3),
  n_loss_component   NUMBER(22,3),
  n_lrc              NUMBER(22,3),
  n_lic              NUMBER(22,3),
  n_insurance_revenue NUMBER(22,3),
  n_insurance_service_expense NUMBER(22,3),
  n_finance_income_expense NUMBER(22,3),
  n_csm_release      NUMBER(22,3),
  n_discount_rate    NUMBER(11,8),
  CONSTRAINT pk_fct_i17 PRIMARY KEY (fic_mis_date, n_group_sk),
  CONSTRAINT fk_i17_grp FOREIGN KEY (n_group_sk) REFERENCES fsi_d_ins_group (n_group_sk)
);

-- ---------------------------------------------------------------------------
-- 8. STAGING (STG_) : GENERATED, NOT HAND-WRITTEN
-- ---------------------------------------------------------------------------
-- Every STG_ table mirrors its FSI_D_ / FCT_ / DIM_ target with no keys and every
-- column nullable (landing accepts bad data; the T2T step validates). CTAS copies
-- NOT NULL constraints, so they are dropped here. Tables keyed on n_contract_sk also
-- get the source business key (v_contract_id, v_source_system) so T2T can look up the
-- surrogate. Run once after Sections 1-7. Load metadata: v_batch_id, d_load_ts, v_source_file.
-- Note: dim_code -> STG_CODE, fct_event -> STG_EVENT; rename if a site already uses those names.
DECLARE
  PROCEDURE mk(p_target VARCHAR2) IS
    v_stg VARCHAR2(128) := 'STG_' || REGEXP_REPLACE(UPPER(p_target), '^(FSI_D_|FCT_|DIM_)', '');
    v_n   PLS_INTEGER;
  BEGIN
    EXECUTE IMMEDIATE 'CREATE TABLE ' || v_stg || ' AS SELECT * FROM ' || p_target || ' WHERE 1 = 0';
    FOR c IN (SELECT column_name FROM user_tab_columns
               WHERE table_name = v_stg AND nullable = 'N') LOOP
      EXECUTE IMMEDIATE 'ALTER TABLE ' || v_stg || ' MODIFY (' || c.column_name || ' NULL)';
    END LOOP;
    SELECT COUNT(*) INTO v_n FROM user_tab_columns
     WHERE table_name = v_stg AND column_name IN ('N_CONTRACT_SK', 'V_CONTRACT_ID');
    IF v_n = 1 THEN   -- has the surrogate but not the business key
      EXECUTE IMMEDIATE 'ALTER TABLE ' || v_stg || ' ADD (v_contract_id VARCHAR2(60), v_source_system VARCHAR2(30))';
    END IF;
    EXECUTE IMMEDIATE 'ALTER TABLE ' || v_stg || ' ADD (v_batch_id VARCHAR2(40), d_load_ts TIMESTAMP DEFAULT SYSTIMESTAMP, v_source_file VARCHAR2(200))';
  EXCEPTION WHEN OTHERS THEN
    IF SQLCODE != -955 THEN RAISE; END IF;     -- ORA-00955: already exists, keep idempotent
  END;
BEGIN
  FOR r IN (SELECT table_name FROM user_tables
             WHERE table_name LIKE 'FSI\_D\_%' ESCAPE '\'
                OR table_name LIKE 'FSI\_F\_%' ESCAPE '\'
                OR table_name LIKE 'DIM\_%'   ESCAPE '\') LOOP
    mk(r.table_name);
  END LOOP;
END;
/

-- ---------------------------------------------------------------------------
-- 9. POST-LOAD CHECKS (run after load; all should return zero rows)
-- ---------------------------------------------------------------------------

-- 9.1 Every contract has its subtype row (and every insurance contract a policy row).
SELECT c.n_contract_sk, c.v_contract_family
  FROM fsi_d_contract c
 WHERE NOT EXISTS (
         SELECT 1 FROM fsi_d_loan_contract x WHERE x.n_contract_sk = c.n_contract_sk
                AND c.v_contract_family IN ('LOAN','MORTGAGE','LEASE','OVERDRAFT')
         UNION ALL SELECT 1 FROM fsi_d_casa_contract x WHERE x.n_contract_sk = c.n_contract_sk AND c.v_contract_family = 'CASA'
         UNION ALL SELECT 1 FROM fsi_d_term_deposit x WHERE x.n_contract_sk = c.n_contract_sk AND c.v_contract_family = 'TERM_DEPOSIT'
         UNION ALL SELECT 1 FROM fsi_d_card_contract x WHERE x.n_contract_sk = c.n_contract_sk AND c.v_contract_family = 'CARD'
         UNION ALL SELECT 1 FROM fsi_d_facility x WHERE x.n_contract_sk = c.n_contract_sk AND c.v_contract_family = 'FACILITY'
         UNION ALL SELECT 1 FROM fsi_d_trade_finance x WHERE x.n_contract_sk = c.n_contract_sk AND c.v_contract_family = 'TRADE_FINANCE'
         UNION ALL SELECT 1 FROM fsi_d_investment_holding x WHERE x.n_contract_sk = c.n_contract_sk AND c.v_contract_family = 'INVESTMENT'
         UNION ALL SELECT 1 FROM fsi_d_derivative x WHERE x.n_contract_sk = c.n_contract_sk AND c.v_contract_family = 'DERIVATIVE'
         UNION ALL SELECT 1 FROM fsi_d_repo_sbl x WHERE x.n_contract_sk = c.n_contract_sk AND c.v_contract_family = 'REPO_SBL'
         UNION ALL SELECT 1 FROM fsi_d_borrowing x WHERE x.n_contract_sk = c.n_contract_sk AND c.v_contract_family = 'BORROWING'
         UNION ALL SELECT 1 FROM fsi_d_ins_life x WHERE x.n_contract_sk = c.n_contract_sk AND c.v_contract_family = 'LIFE'
         UNION ALL SELECT 1 FROM fsi_d_ins_annuity x WHERE x.n_contract_sk = c.n_contract_sk AND c.v_contract_family = 'ANNUITY'
         UNION ALL SELECT 1 FROM fsi_d_ins_health x WHERE x.n_contract_sk = c.n_contract_sk AND c.v_contract_family = 'HEALTH'
         UNION ALL SELECT 1 FROM fsi_d_ins_pnc x WHERE x.n_contract_sk = c.n_contract_sk AND c.v_contract_family = 'PNC'
         UNION ALL SELECT 1 FROM fsi_d_ins_policy x WHERE x.n_contract_sk = c.n_contract_sk AND c.v_contract_family = 'REINS_ASSUMED')
    OR (c.v_business_class = 'INSURANCE'
        AND NOT EXISTS (SELECT 1 FROM fsi_d_ins_policy p WHERE p.n_contract_sk = c.n_contract_sk));

-- 9.2 Journals balance per event and ledger (debits = credits).
SELECT n_event_sk, v_ledger, SUM(n_debit_amt) - SUM(n_credit_amt) AS imbalance
  FROM fct_journal
 GROUP BY n_event_sk, v_ledger
HAVING SUM(n_debit_amt) <> SUM(n_credit_amt);

-- 9.3 Every leaf GL account in use maps to a volt-ledger canonical concept.
SELECT DISTINCT g.v_gl_account_code
  FROM fct_gl_balance b
  JOIN dim_gl_account g ON g.n_gl_account_sk = b.n_gl_account_sk
 WHERE g.v_concept_id IS NULL;

-- 9.4 Journals roll up to GL balances at full segment grain (period movement check).
-- Assumes fct_gl_balance holds period-end balances and journals carry d_accounting
-- within the period; adjust the date window to the site's calendar.
SELECT j.v_ledger, j.n_gl_account_sk, j.n_org_sk, j.n_cost_centre_sk, j.n_mgmt_org_sk,
       j.n_product_sk, j.v_credit_stage, j.n_ic_org_sk, j.v_ccy_code,
       SUM(j.n_debit_amt - j.n_credit_amt) AS journal_net
  FROM fct_journal j
 GROUP BY j.v_ledger, j.n_gl_account_sk, j.n_org_sk, j.n_cost_centre_sk, j.n_mgmt_org_sk,
          j.n_product_sk, j.v_credit_stage, j.n_ic_org_sk, j.v_ccy_code
HAVING NOT EXISTS (
  SELECT 1 FROM fct_gl_balance b
   WHERE b.v_ledger = j.v_ledger AND b.n_gl_account_sk = j.n_gl_account_sk
     AND b.n_org_sk = j.n_org_sk AND b.n_cost_centre_sk = j.n_cost_centre_sk
     AND b.n_mgmt_org_sk = j.n_mgmt_org_sk AND b.n_product_sk = j.n_product_sk
     AND b.v_credit_stage = j.v_credit_stage AND b.n_ic_org_sk = j.n_ic_org_sk
     AND b.v_ccy_code = j.v_ccy_code);

-- 9.5 Position-to-GL reconciliation needs a site rule from contract family and
-- balance type to GL account (the CoA brain's mapping output). Add it at build time;
-- a non-empty result then is a genuine break, not a process artefact.
