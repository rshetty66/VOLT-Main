---
name: file-search-agent
description: >
  This skill activates when the user uploads XML, SQL, or Excel files and asks
  natural-language questions about columns, transformations, lookups, joins, tables,
  or data structures within those files. Also triggers for lineage reports, code review
  of SQL/ETL, data cleansing rule extraction, and file-based data exploration. Trigger
  words: file search, parse XML, parse SQL, column search, lookup, joins, find column,
  where is, which table, trace, search file, code review, data cleansing.
version: 1.0.0
disable-model-invocation: true
---

# File Search Agent

Parses uploaded XML, SQL, and Excel files to answer natural-language questions about columns, transformations, lookups, and joins. Generates detailed end-to-end lineage reports.

---

## 1. Supported File Types

| File Type | What We Parse | Key Elements Extracted |
|-----------|---------------|----------------------|
| Informatica XML (.xml) | PowerCenter mappings, workflows, sessions | Source qualifiers, expressions, lookups, routers, targets, ports, connections |
| SQL (.sql) | DDL, DML, stored procedures, views | Tables, columns, joins, WHERE clauses, CTEs, functions, indexes |
| Excel (.xlsx, .csv) | Data dictionaries, mapping sheets, configs | Column names, data types, business rules, hierarchies |
| JSON (.json) | API schemas, config files | Field definitions, nested structures, enums |

---

## 2. Query Capabilities

### Column Search
- "Which transformations use ACCOUNT_ID?"
- "Find all columns named *BALANCE* across all files"
- "What data type is PERIOD_NET_DR in the source?"
- "List all columns that feed into TARGET_AMOUNT"

### Transformation Search
- "Show me all expressions that use IIF or DECODE"
- "Which lookups reference GL_CODE_COMBINATIONS?"
- "Find all filters that check BALANCE_TYPE"
- "What routers split data by ENTITY_CODE?"

### Join & Relationship Search
- "What joins exist between FIN_FACT and DIM_ACCOUNT?"
- "Show me all tables that join on CODE_COMBINATION_ID"
- "List all foreign key relationships in this DDL"
- "Which tables are referenced in this stored procedure?"

### Lineage Reports
- "Trace BALANCE_AMOUNT from source to target"
- "Generate a complete lineage report for all target columns"
- "Show me the data flow from GL_BALANCES to DATAHUB_FACT"
- "Which source columns ultimately populate CUSTOMER_SEGMENT?"

### Code Review
- "Review this SQL for performance issues"
- "Check this ETL mapping for data quality risks"
- "Find potential NULL handling gaps"
- "Identify columns without explicit type casting"

### Data Cleansing Rule Extraction
- "What data quality rules are embedded in these transformations?"
- "List all NULL/default value handling across mappings"
- "Find all data type mismatches between source and target"
- "Extract validation rules from filter transformations"

---

## 3. Response Format

### For Column/Transformation Searches
```
Found 3 matches for "ACCOUNT_ID":

1. File: m_GL_EXTRACT.xml
   Location: Source Qualifier > SQ_GL_BALANCES > Port[3]
   Type: INPUT/OUTPUT port
   Data Type: NUMBER(38)
   Connected To: EXP_TRANSFORM.ACCOUNT_ID (input)

2. File: m_GL_EXTRACT.xml
   Location: Lookup > LKP_ACCOUNT_DIM > Condition
   Condition: SQ_GL_BALANCES.ACCOUNT_ID = LKP.CODE_COMBINATION_ID
   Returns: ACCOUNT_NAME, L2_CATEGORY

3. File: DDL_DATAHUB.sql
   Location: CREATE TABLE FACT_FINANCIAL (line 14)
   Column: ACCOUNT_ID NUMBER(38) NOT NULL
   Constraint: FK → DIM_ACCOUNT.ACCOUNT_ID
```

### For Lineage Reports
```
END-TO-END LINEAGE REPORT
==========================
Target: DATAHUB.FACT_FINANCIAL.NET_AMOUNT

Chain:
┌─ Source: GL.GL_BALANCES.PERIOD_NET_DR [NUMBER(38,2)]
│  └─ Source Qualifier: SQ_GL_BALANCES (no SQL override)
│     └─ Expression: EXP_CALC_NET
│        Rule: PERIOD_NET_DR - PERIOD_NET_CR
│        Output Port: O_NET_AMOUNT [DECIMAL(18,2)]
│        └─ Filter: FIL_ACTUAL_ONLY
│           Condition: BALANCE_TYPE_CODE = 'A'
│           └─ Target: FACT_FINANCIAL.NET_AMOUNT [DECIMAL(18,2)]
│
├─ Source: GL.GL_BALANCES.PERIOD_NET_CR [NUMBER(38,2)]
│  └─ (same path as above — used in expression)

Data Quality:
- NULL handling: COALESCE(PERIOD_NET_DR, 0) - COALESCE(PERIOD_NET_CR, 0)
- Filter loss: Rows with BALANCE_TYPE_CODE != 'A' are excluded
- Type change: NUMBER(38,2) → DECIMAL(18,2) — potential precision loss
```

---

## 4. Advanced Features

### Cross-File Correlation
When multiple files are uploaded, automatically correlate:
- SQL table names <-> Informatica source/target definitions
- Excel column names <-> physical database columns
- Business rule descriptions <-> transformation expressions

### Impact Analysis
- "If I change ACCOUNT_TYPE column, what downstream targets are affected?"
- "Which mappings will break if we rename GL_BALANCES to GL_BALANCES_V2?"

### Documentation Generation
- "Generate a data dictionary from these DDL files"
- "Create a transformation catalog from these Informatica XMLs"
- "Produce a complete column inventory across all uploaded files"

---

## 5. Usage

Upload your files (XML, SQL, Excel), then ask any question:
- "Parse this Informatica XML and list all transformations"
- "Find every reference to CUSTOMER_ID across all uploaded files"
- "Generate a lineage report for the REVENUE target table"
- "Review this SQL procedure for potential issues"
- "What data cleansing rules exist in these mappings?"
