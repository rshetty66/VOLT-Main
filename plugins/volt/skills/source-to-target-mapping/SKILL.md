---
name: source-to-target-mapping
description: >
  This skill activates when the user needs source-to-target mapping, field-level lineage,
  data mapping documentation, data solution specifications, S2T spreadsheets, or tracing data flow
  from source systems through ETL transformations to target columns. Trigger words: source
  to target, S2T, mapping, field mapping, data specification, lineage trace, column
  mapping, data mapping, transformation logic, GAAP, canonical data model, Informatica.
version: 1.0.0
disable-model-invocation: true
---

# Source-to-Target Mapping Agent

Traces field-level data lineage from source systems through transformation layers to target columns. Produces downloadable S2T mapping spreadsheets and full 18-sheet data solution specifications.

---

## 1. Input Sources

### Primary Inputs
| Source | What We Extract |
|--------|----------------|
| GAAP / accounting rules workbook | Account hierarchies, business rules, reporting dimensions, GL mappings |
| Informatica XML | Mappings, transformations, source/target definitions, workflow logic |
| Canonical data model workbook (optional) | Canonical model definitions |

### Parsing Strategy
1. **Informatica XML** → Build transformation graph (DAG) from source to target
2. **GAAP / accounting rules workbook** → Extract business rules that drive transformations
3. **Canonical data model workbook** → Map canonical names to physical column names

---

## 2. S2T Mapping Spreadsheet Format

### Column Structure
| Column | Description | Example |
|--------|-------------|---------|
| Source System | Origin system name | Oracle EBS GL |
| Source Schema | Database schema | GL |
| Source Table | Physical table name | GL_BALANCES |
| Source Column | Physical column name | PERIOD_NET_DR |
| Source Data Type | Column data type | NUMBER(38,2) |
| Transformation Rule | Business logic applied | SUM(PERIOD_NET_DR - PERIOD_NET_CR) |
| Transformation Type | Category | Aggregation + Calculation |
| Informatica Mapping | Mapping name reference | m_GL_BALANCES_EXTRACT |
| Target Schema | Target database schema | FIN_DW |
| Target Table | Target table name | FACT_FINANCIAL |
| Target Column | Target column name | NET_AMOUNT |
| Target Data Type | Target data type | DECIMAL(18,2) |
| Nullable | NULL allowed | N |
| Default Value | Default when NULL | 0.00 |
| Business Rule | Plain-English rule | Net of debits minus credits per period |
| Data Quality Rule | Validation | Must be non-NULL; must reconcile to source |
| Notes | Additional context | Filtered by ACTUAL balance type only |

---

## 3. Full Data Solution Specification (18 Sheets)

When requested, generate a complete Data Solution Implementation Specification:

1. **Cover Page** — Project, author, version, approval matrix
2. **Revision History** — Change log with dates and authors
3. **Glossary** — Terms, acronyms, definitions
4. **Source Systems Inventory** — All source systems, owners, connectivity
5. **Source-to-Target: Subject Area 1** — Full S2T for first domain
6. **Source-to-Target: Subject Area 2** — Full S2T for second domain
7. **Source-to-Target: Subject Area N** — (one sheet per subject area)
8. **Transformation Rules** — All transformation logic with SQL equivalents
9. **Data Quality Rules** — Completeness, validity, consistency, timeliness rules
10. **Lookup/Reference Tables** — All lookup dependencies with refresh schedules
11. **Error Handling** — Rejection logic, error codes, retry strategy
12. **Scheduling & Dependencies** — Job sequence, dependencies, SLAs
13. **Volumes & Performance SLAs** — Expected volumes, load windows, targets
14. **Security Classification** — PII/PHI/MNPI flagging per column
15. **Historical Load Strategy** — One-time migration approach
16. **Delta/CDC Strategy** — Incremental load logic (timestamps, CDC, merge)
17. **Reconciliation Rules** — Source-to-target record/amount reconciliation
18. **Testing Approach & Sign-off** — Test cases, UAT criteria, sign-off matrix

---

## 4. Lineage Trace Format

For each target column, produce a complete lineage chain:

```
TARGET: FIN_DW.FACT_FINANCIAL.NET_AMOUNT
  └── Expression: EXP_CALC_NET (PERIOD_NET_DR - PERIOD_NET_CR)
       └── Source Qualifier: SQ_GL_BALANCES
            └── Source: GL.GL_BALANCES.PERIOD_NET_DR
            └── Source: GL.GL_BALANCES.PERIOD_NET_CR
  └── Filter: FIL_ACTUAL_ONLY (BALANCE_TYPE_CODE = 'A')
  └── Lookup: LKP_ACCOUNT_DIM (JOIN ON CODE_COMBINATION_ID)
       └── Returns: ACCOUNT_NAME, L2_CATEGORY, RPT_CODE
```

---

## 5. Data Mapping Best Practices

- **One row per target column** — Never combine multiple targets
- **Explicit NULL handling** — Document what happens when source is NULL
- **Lookup conditions** — Always specify join type (INNER vs LEFT)
- **Aggregation scope** — Specify GROUP BY columns explicitly
- **Filter placement** — Note whether filter is pre or post-aggregation
- **Type conversions** — Document all implicit and explicit casts
- **Multi-source columns** — Note COALESCE/priority order for federated sources

---

## 6. Usage

Upload your files, then ask:
- "Create a source-to-target mapping for the GL to finance data warehouse pipeline"
- "Generate a full data solution specification for the finance data warehouse"
- "Trace the lineage of CUSTOMER_SEGMENT from source to target"
- "Map all Informatica transformations to S2T format"
- "Produce a data mapping spreadsheet for the Interest Income subject area"
