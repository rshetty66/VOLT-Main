---
name: si-data-architect
description: >
  This skill activates when the user discusses data architecture, data migration,
  data integration, data quality, master data management, MDM, data governance,
  data modeling, ETL, ELT, data warehouse, data lake, data lakehouse, data mesh,
  EIM, enterprise information management, data profiling, data cleansing, or
  data management across Oracle, SAP, Workday, Databricks, AWS, or other platforms.
version: 1.0.0
---

# Data Architect — SI Delivery Excellence

Expert-level guidance for data architecture, migration, and management in systems integration projects. Covers data strategy, migration execution, quality management, and modern data platform design across all major enterprise systems.

---

## 1. Data Architecture Patterns

### Pattern 1: Data Warehouse

**Best For:** Structured reporting, known queries, finance teams

**Architecture:**
```
Source Systems → Staging → Integration Layer → Presentation Layer → BI Tools

              ETL/ELT Processing
```

**Characteristics:**
- Schema-on-write
- Structured, relational
- Optimized for reporting
- Historical snapshots

**Tools:** Oracle DW, SAP BW/4HANA, Snowflake, Azure Synapse

### Pattern 2: Data Lake

**Best For:** Raw data storage, data science, unknown future use cases

**Architecture:**
```
Source Systems → Raw Zone → Curated Zone → Analytics Zone

              Schema-on-read
```

**Characteristics:**
- Store data in native format
- Schema-on-read
- Supports structured, semi-structured, unstructured
- Cost-effective storage

**Tools:** AWS S3, Azure Data Lake, Databricks Delta Lake

### Pattern 3: Data Lakehouse

**Best For:** Best of both worlds - flexibility of lake, reliability of warehouse

**Architecture:**
```
Source Systems → Bronze (Raw) → Silver (Cleaned) → Gold (Aggregated)

                                    Delta Lake Format
```

**Characteristics:**
- ACID transactions on lake
- Schema enforcement and evolution
- Time travel
- Unified batch/streaming

**Tools:** Databricks, Snowflake, AWS Lake Formation

### Pattern 4: Data Mesh

**Best For:** Large organizations, domain-oriented ownership

**Architecture:**
```
Domain A Data Product → Data Catalog ← Domain B Data Product

    Self-serve Platform ← Federated Governance
```

**Characteristics:**
- Domain-oriented data ownership
- Data as a product
- Self-serve infrastructure
- Federated governance

---

## 2. Data Migration Strategy

### Migration Approaches

| Approach | Description | Best For | Risk |
|----------|-------------|----------|------|
| **Big Bang** | All data, all entities, one weekend | Small scope, tight timeline | High |
| **Phased** | By module, entity, or geography | Large scope, need stability | Medium |
| **Parallel** | Old and new run together | Risk-averse, reconciliation critical | Low-Medium |
| **Wave** | Multiple cutover events | Large, complex organizations | Medium |

### Migration Execution Framework

**Phase 1: Discover (Weeks 1-2)**
- Data profiling
- Volume analysis
- Quality assessment
- Complexity scoring

**Phase 2: Design (Weeks 3-4)**
- Migration approach
- Mapping design
- Tool selection
- Schedule development

**Phase 3: Build (Weeks 5-8)**
- Extract routines
- Transformation rules
- Load procedures
- Reconciliation framework

**Phase 4: Test (Weeks 9-12)**
- Trial migrations
- Reconciliation validation
- Performance tuning
- Error handling

**Phase 5: Execute (Cutover)**
- Final extraction
- Transformation
- Load
- Reconciliation
- Sign-off

### Data Mapping Template

```
Source Field | Source Table | Transform | Target Field | Target Table | Rule | Comments
-------------|--------------|-------------|--------------|--------------|------|----------
VENDOR_ID    | AP_SUPPLIERS | Convert     | SupplierNum  | Suppliers    | Lpad(9)|
VENDOR_NAME  | AP_SUPPLIERS | Upper       | SupplierName | Suppliers    | Upper()|
```

### Reconciliation Framework

**Reconciliation Levels:**

| Level | Check | Method |
|-------|-------|--------|
| **1. Count** | Record counts match | SELECT COUNT(*) |
| **2. Value** | Sum of key amounts match | SUM(Amount) |
| **3. Detail** | Individual transactions match | Hash comparison |
| **4. Business** | Business metrics reconciled | Report comparison |

**Reconciliation Report Template:**
```
Entity: [Name]
Module: [AP/AR/GL/etc]

Source Records: [X]
Target Records: [Y]
Variance: [Z]

Source Balance: $[X]
Target Balance: $[Y]
Variance: $[Z]

Unreconciled Items:
- Category 1: [X items, $Y] - [Explanation]
- Category 2: [X items, $Y] - [Explanation]

Sign-off: _______________
```

---

## 3. Master Data Management (MDM)

### MDM Domains

| Domain | Attributes | Golden Record |
|--------|------------|---------------|
| **Customer** | Name, address, contacts, hierarchies | Single customer view |
| **Supplier/Vendor** | Name, address, payment terms, tax | Approved vendor list |
| **Product/Material** | SKU, description, UOM, attributes | Standardized product catalog |
| **Chart of Accounts** | Account numbers, descriptions, hierarchies | Unified COA |
| **Cost Center** | Code, name, manager, hierarchy | Standard cost centers |
| **Employee** | ID, name, department, cost center | HR master |
| **Location** | Address, type, status | Standardized locations |

### MDM Implementation Patterns

**Pattern 1: Registry (Virtual)**
- Keep data in source systems
- Create registry with cross-references
- Query-time integration
- Pros: Minimal disruption
- Cons: Real-time complexity

**Pattern 2: Consolidation (Data Warehouse)**
- Extract from sources
- Clean and standardize
- Store in central repository
- Pros: Analytics-ready
- Cons: Latency

**Pattern 3: Coexistence (Hybrid)**
- Central MDM hub
- Sync with source systems
- Bi-directional updates
- Pros: Balanced approach
- Cons: Complexity

**Pattern 4: Centralized (Transaction Hub)**
- All MDM through hub
- Source systems subscribe
- Pros: Maximum control
- Cons: Requires process change

### MDM Governance

**Data Stewardship Model:**
| Role | Responsibility |
|------|----------------|
| Data Owner | Business accountability |
| Data Steward | Day-to-day management |
| Data Custodian | Technical implementation |

**Data Quality Rules:**
- Completeness: Required fields populated
- Uniqueness: No duplicates
- Consistency: Values align across systems
- Validity: Values within acceptable ranges
- Timeliness: Data current and relevant

---

## 4. Data Quality Management

### Data Quality Dimensions

| Dimension | Definition | Example Metric |
|-----------|------------|----------------|
| **Completeness** | Required data is present | % of records with email |
| **Uniqueness** | No duplicate records | Duplicate rate |
| **Consistency** | Values align across systems | % of matching customer IDs |
| **Validity** | Data conforms to format/rules | % of valid email formats |
| **Accuracy** | Data reflects reality | Verified against source |
| **Timeliness** | Data is current | Staleness (days) |

### Data Quality Framework

**1. Profile**
```
Column Analysis:
- Distinct values
- Null counts
- Pattern analysis
- Range analysis

Table Analysis:
- Row counts
- Referential integrity
- Orphan records
- Duplicate detection
```

**2. Cleanse**
```
Standardization:
- Address standardization
- Name parsing
- UOM conversion
- Date format unification

Enrichment:
- D&B lookup
- Geocoding
- Industry classification

De-duplication:
- Fuzzy matching
- Survivorship rules
- Golden record creation
```

**3. Monitor**
```
Quality Dashboard:
- Overall quality score
- Dimension scores
- Trending
- Alert thresholds

Remediation:
- Workflow routing
- Exception handling
- Continuous improvement
```

### Data Quality Tools

| Category | Tools |
|----------|-------|
| Profiling | Informatica DQ, Talend, Oracle EDQ, native DB tools |
| Cleansing | Trillium, Melissa, Loqate, D&B |
| MDM | Informatica MDM, SAP MDG, Reltio, Semarchy |
| Monitoring | Great Expectations, Monte Carlo, Collibra |

---

## 5. Platform-Specific Data Architecture

### Oracle Data Architecture

**Data Integration Options:**
| Tool | Use Case | Approach |
|------|----------|----------|
| **Oracle Data Integrator (ODI)** | ELT, heterogeneous sources | Declarative design |
| **Oracle GoldenGate** | Real-time replication | Log-based capture |
| **Oracle Data Pump** | Bulk data movement | Export/import |
| **SQL Loader** | Flat file loading | Control file |
| **BI Publisher** | Reporting data extracts | Data models |

**Oracle Analytics Cloud (OAC):**
- Semantic modeling
- Data flows
- Machine learning
- Augmented analytics

### SAP Data Architecture

**Data Integration Options:**
| Tool | Use Case | Approach |
|------|----------|----------|
| **SAP Data Services** | ETL, data quality | Batch processing |
| **SAP SLT** | Real-time replication | Trigger-based |
| **SAP CPI/Integration Suite** | Cloud integration | API-based |
| **SAP BW/4HANA** | Data warehousing | Modeling |

**SAP MDG (Master Data Governance):**
- Customer, Supplier, Material, Financial Master
- Workflow-based governance
- Data quality rules
- Mass processing

### Databricks Architecture

**Lakehouse Components:**
```
Data Sources → Ingestion → Bronze → Silver → Gold → Consumption

              Auto Loader   Raw    Cleaned   Aggregated
              Kafka         JSON   Parquet   Delta Tables
              APIs
```

**Medallion Architecture:**
- **Bronze**: Raw data as-ingested
- **Silver**: Cleaned, conformed, deduplicated
- **Gold**: Business-level aggregates

**Delta Lake Features:**
- ACID transactions
- Schema enforcement/evolution
- Time travel
- Z-ordering for performance
- Liquid clustering

**Unity Catalog:**
- Unified governance
- Lineage tracking
- Access control
- Data discovery

### AWS Data Architecture

**Services Matrix:**
| Function | Service | Use Case |
|----------|---------|----------|
| Storage | S3 | Data lake |
| Database | RDS, Aurora | Transactional |
| Warehouse | Redshift | Analytics |
| ETL | Glue | Data integration |
| Streaming | Kinesis | Real-time |
| Catalog | Glue Data Catalog | Metadata |
| Governance | Lake Formation | Security |

**AWS Glue:**
- Crawlers for schema discovery
- ETL jobs (Python/Scala)
- Data catalog
- Workflow orchestration

**Amazon Redshift:**
- Columnar storage
- Massively parallel processing
- Spectrum for S3 queries
- Serverless option

---

## 6. Data Governance

### Data Governance Framework

**Governance Domains:**
```
Data Governance
├── Data Quality
├── Master Data Management
├── Metadata Management
├── Data Security & Privacy
├── Data Architecture
└── Data Lifecycle Management
```

### Metadata Management

**Types of Metadata:**
| Type | Description | Example |
|------|-------------|---------|
| **Technical** | System information | Table names, column types, relationships |
| **Business** | Business context | Definitions, ownership, usage |
| **Operational** | Processing information | Load times, row counts, error rates |

**Metadata Repository:**
- Data catalog (Alation, Collibra, Informatica, cloud-native)
- Business glossary
- Data lineage
- Impact analysis

### Data Lineage

**Lineage Types:**
- **Horizontal**: Data movement system to system
- **Vertical**: Transformations within a system
- **End-to-end**: Source to consumption

**Lineage Tools:**
- Collibra Lineage
- Informatica Lineage
- Manta
- Databricks Unity Catalog
- AWS Glue Lineage

### Data Privacy & Compliance

**GDPR Considerations:**
- Consent management
- Right to erasure
- Data portability
- Privacy by design

**CCPA Considerations:**
- Consumer rights
- Opt-out mechanisms
- Data inventory

**Data Masking Strategies:**
| Technique | Use Case | Reversibility |
|-----------|----------|---------------|
| Encryption | Production security | Reversible with key |
| Tokenization | Non-prod with lookup | Reversible |
| Masking | Non-prod display | Irreversible |
| Nulling | Test data | Irreversible |
| Shuffling | Test data | Irreversible |

---

## 7. Data Migration by Platform

### Oracle ERP Cloud Migration

**Migration Objects:**
| Object | Method | Complexity |
|--------|--------|------------|
| Suppliers | FBDI | Medium |
| Customers | FBDI | Medium |
| GL Balances | GL Interface | Low |
| Open AP | AP Invoice Interface | High |
| Open AR | AR Invoice Interface | High |
| Assets | FA Mass Additions | Medium |
| Journals | GL Journal Interface | Low |

**FBDI (File-Based Data Import):**
- CSV templates
- Predefined structures
- Validation reports
- Error handling

### SAP S/4HANA Migration

**Migration Approaches:**

| Approach | Tool | Use Case |
|----------|------|----------|
| **SAP S/4HANA Migration Cockpit** | LTMC | New implementation |
| **SAP Data Migration Server** | DMS | Complex landscapes |
| **Custom Programs** | ABAP | Special requirements |
| **Batch Input** | SHDB/SMICM | Legacy approach |

**Migration Object Types:**
- Master data (GL accounts, customers, vendors, materials)
- Open items (AP, AR, GL)
- Balances
- Historical data (optional)

### Workday Migration

**Migration Methods:**
| Method | Use Case |
|--------|----------|
| **EIB (Enterprise Interface Builder)** | Bulk imports |
| **Workday Studio** | Complex integrations |
| **Core Connector** | Ongoing integrations |
| **Spreadsheet Templates** | One-time setups |

**Common EIBs:**
- Organizations
- Workers
- Chart of accounts
- Cost centers
- Suppliers

---

## 8. Real-Time Data Integration

### Change Data Capture (CDC) Patterns

| Pattern | Mechanism | Latency | Impact |
|---------|-----------|---------|--------|
| **Log-based** | Database transaction logs | Seconds | Low |
| **Trigger-based** | Database triggers | Seconds-Mins | Medium |
| **Timestamp** | Modified date columns | Minutes-Hours | Low |
| **Full Extract** | Complete table extract | Hours | High |

### Streaming Architecture

```
Source → CDC → Message Bus → Stream Processing → Target

              Kafka/Kinesis

          Flink/Spark/Databricks
```

**Use Cases:**
- Real-time dashboards
- Event-driven automation
- Continuous data sync
- Fraud detection

---

## Quick Reference: Data Architecture Decision Matrix

| Scenario | Recommended Pattern | Tools |
|----------|---------------------|-------|
| Finance reporting focus | Data Warehouse | Snowflake, Redshift, Synapse |
| Data science & ML focus | Data Lakehouse | Databricks, Snowflake |
| Large, distributed org | Data Mesh | Databricks, cloud-native |
| SAP-centric landscape | SAP BW/4HANA + Data Intelligence | SAP native |
| Oracle-centric landscape | OAC + ODI + ADW | Oracle native |
| Multi-cloud strategy | Lakehouse + Federation | Databricks, Trino |
