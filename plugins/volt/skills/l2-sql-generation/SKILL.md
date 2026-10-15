---
name: l2-sql-generation
description: >
  This skill activates when the user needs to convert Informatica ETL mappings into DB2 SQL,
  generate per-reporting-package or per-L2 SQL query files, trace data lineage through
  transformation chains, parse GAAP Excel workbooks, parse Informatica PowerCenter XML exports,
  or produce SQL for a regulatory and financial data hub. Trigger words: L2 SQL, GAAP,
  Informatica, DB2, data hub, reporting package, PowerCenter, source qualifier, expression
  transformation, ETL to SQL.
version: 1.0.0
disable-model-invocation: true
---

# L2 SQL Generation Agent

Converts GAAP Excel and Informatica PowerCenter XML into ready-to-use DB2 SQL queries organized per reporting package and per L2 category for the target data hub.

---

## 1. Input Parsing

### GAAP Excel Workbooks
- Account hierarchies (L1 → L2 → L3 → L4)
- Business rules and roll-up logic
- Reporting-package dimension mappings
- Reporting line assignments

### Informatica PowerCenter XML
- Source Qualifiers (SQL overrides, filter conditions)
- Expression Transformations (IIF, DECODE, TO_DATE, LPAD, SUBSTR, etc.)
- Lookup Transformations (lookup conditions, return ports, default values)
- Router Transformations (group filter conditions)
- Aggregator Transformations (GROUP BY + aggregate functions)
- Update Strategy (DD_INSERT, DD_UPDATE, DD_REJECT)
- Target Definitions (column mappings, data types)

---

## 2. Conversion Rules

### Informatica → DB2 SQL Mapping

| Informatica | DB2 SQL Equivalent |
|---|---|
| Source Qualifier (SQL override) | FROM clause / CTE |
| Expression (IIF) | CASE WHEN ... THEN ... ELSE ... END |
| Expression (DECODE) | CASE value WHEN ... THEN ... END |
| Expression (TO_DATE) | DATE(varchar) or TIMESTAMP(varchar) |
| Expression (LPAD/RPAD) | LPAD(col, n, '0') |
| Lookup | LEFT JOIN on lookup condition |
| Router group | WHERE clause or CASE WHEN filter |
| Aggregator | GROUP BY + SUM/COUNT/MAX/MIN |
| Filter | WHERE clause |
| Joiner | INNER/LEFT/RIGHT JOIN |
| Sorter | ORDER BY |
| Union | UNION ALL |

### Output Structure
```
output/
├── RP_001/
│   ├── L2_Revenue_Recognition.sql
│   ├── L2_Cost_of_Goods_Sold.sql
│   └── L2_Operating_Expenses.sql
├── RP_002/
│   ├── L2_Interest_Income.sql
│   └── L2_Fee_Income.sql
└── common/
    ├── lookup_tables.sql
    └── dimension_joins.sql
```

---

## 3. SQL Template

```sql
-- =============================================================================
-- L2: {L2_CATEGORY_NAME}
-- Reporting package: {RP_CODE}
-- Source Mapping: {INFORMATICA_MAPPING_NAME}
-- Generated: {TIMESTAMP}
-- =============================================================================

WITH source_data AS (
    -- Source Qualifier: {SQ_NAME}
    SELECT {source_columns}
    FROM {source_table}
    WHERE {filter_condition}
),
transformed AS (
    -- Expression: {EXP_NAME}
    SELECT
        {transformed_columns_with_case_when},
        -- Lookup: {LKP_NAME}
        lkp.{return_port} AS {target_alias}
    FROM source_data src
    LEFT JOIN {lookup_table} lkp
        ON src.{lookup_key} = lkp.{lookup_condition}
)
SELECT
    {final_target_columns}
FROM transformed
WHERE {router_group_condition}
;
```

---

## 4. Validation Checklist

- [ ] All source columns referenced in XML are present in SQL
- [ ] Lookup join conditions match Informatica lookup condition ports
- [ ] IIF/DECODE logic produces same results as CASE WHEN
- [ ] NULL handling matches Informatica default values
- [ ] Data type conversions are explicit (CAST/CONVERT)
- [ ] Aggregation GROUP BY includes all non-aggregate columns
- [ ] Router conditions are mutually exclusive (no row duplication)

---

## 5. Usage

Upload your GAAP Excel and Informatica XML files, then ask:
- "Generate L2 SQL for RP-001 Revenue Recognition"
- "Convert mapping m_GAAP_GL_EXTRACT to DB2 SQL"
- "Show me the lineage from GL_BALANCES to DATAHUB_FACT_FINANCIAL"
- "Generate all L2 queries for the Interest Income reporting package"
