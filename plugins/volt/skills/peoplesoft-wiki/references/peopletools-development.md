# PeopleSoft — PeopleTools Development Reference

PeopleCode, Application Engine, SQR, Integration Broker development patterns.

---

## PeopleCode Fundamentals

### Event Model

| Event | Fires When | Use Case |
|-------|-----------|----------|
| **RowInit** | Row loaded from DB | Set defaults, hide fields |
| **FieldChange** | User changes field value | Validation, cascade updates |
| **FieldEdit** | After FieldChange, before save | Edit validation |
| **SavePreChange** | Before save to DB | Cross-field validation |
| **SavePostChange** | After successful save | Trigger downstream processing |
| **SearchInit** | Search page opens | Set default search criteria |
| **RowSelect** | Each row selected from DB | Filter rows programmatically |
| **Activate** | Page activated (tab click) | Page-level initialization |
| **PreBuild** | Component building | Set component-level state |
| **PostBuild** | After component built | Final adjustments |

### Common PeopleCode Patterns

```peoplecode
/* Field validation */
If All(&FIELD_VALUE) Then
   /* Field has a value - validate */
   If &FIELD_VALUE > 100 Then
      Error MsgGet(30000, 1, "Value cannot exceed 100");
   End-If;
End-If;

/* SQL Fetch */
Local SQL &sql;
Local string &name;
&sql = CreateSQL("SELECT DESCR FROM PS_DEPT_TBL WHERE DEPTID = :1", &deptid);
If &sql.Fetch(&name) Then
   /* Found the department */
End-If;

/* Rowset processing */
Local Rowset &rs = GetLevel0()(1).GetRowset(SCROLL.JRNL_LN);
For &i = 1 To &rs.ActiveRowCount
   &row = &rs.GetRow(&i);
   &account = &row.JRNL_LN.ACCOUNT.Value;
End-For;

/* Component Interface call */
Local ApiObject &ci = %Session.GetCompIntfc(CompIntfc.CI_PERSONAL_DATA);
&ci.EMPLID = "12345";
If &ci.Get() Then
   &name = &ci.NAME;
End-If;
```

---

## Application Engine

### Structure

```
APPLICATION ENGINE PROGRAM
  └── SECTION (can be called, restarted)
       └── STEP (unit of execution)
            └── ACTION (SQL, PeopleCode, Call Section, Log Message)
```

### Action Types

| Action | Purpose |
|--------|---------|
| **SQL** | Execute SQL (INSERT, UPDATE, DELETE, SELECT) |
| **PeopleCode** | Run PeopleCode logic |
| **Call Section** | Call another section (subroutine) |
| **Log Message** | Write to message log |
| **Do Select** | Loop over result set |
| **Do While** | Loop while condition true |
| **Do Until** | Loop until condition true |

### Performance Best Practices

1. Use Set-Based SQL (not row-by-row) wherever possible
2. Use %Table and %Bind meta-SQL for portability
3. Commit after each logical unit of work
4. Use Temp Tables for parallel processing (Process Instance-keyed)
5. Use BULK INSERT for large volumes
6. Avoid PeopleCode in tight loops — push logic to SQL

---

## SQR (Structured Query Reporter)

### Template

```sqr
#include 'setenv.sqc'    ! Environment setup
#include 'setup31.sqc'   ! Page layout

begin-program
  do Init-Report
  do Process-Main
  do Finish-Report
end-program

begin-procedure Init-Report
  move 'RPT001' to $ReportID
  do Init-DateTime
  do Get-Current-DateTime
end-procedure

begin-procedure Process-Main
begin-SELECT
A.EMPLID        &emplid
A.NAME          &name
A.DEPTID        &dept

  print &emplid   (+1,1)
  print &name     (0,15)
  print &dept     (0,50)

FROM PS_JOB A
WHERE A.EFFDT = (SELECT MAX(B.EFFDT) FROM PS_JOB B
                  WHERE B.EMPLID = A.EMPLID
                  AND B.EMPL_RCD = A.EMPL_RCD
                  AND B.EFFDT <= $AsOfToday)
end-SELECT
end-procedure
```

---

## PS Query

| Feature | Description |
|---------|-------------|
| **Query Type** | User, Role, Public (visibility levels) |
| **Criteria** | Filter with prompts (runtime parameters) |
| **Expressions** | Calculated fields, CASE/DECODE |
| **Joins** | Inner, Left Outer, Right Outer, Full Outer |
| **Output** | HTML, Excel, CSV, XML |
| **Scheduling** | Run via Process Scheduler on schedule |
| **Security** | Query Access Tree controls table access |

---

## Common Development Anti-Patterns

| Anti-Pattern | Problem | Better Approach |
|-------------|---------|-----------------|
| Row-by-row processing in AE | Slow for large volumes | Set-based SQL |
| PeopleCode in FieldChange for complex logic | Slows UI interaction | Move to SavePreChange or AE |
| Hardcoded values | Maintenance nightmare | Use Translate values or setup tables |
| No error handling | Silent failures | Wrap in try-catch; log errors |
| Direct SQL instead of CI | Bypasses business logic | Use Component Interface for external access |
| Over-customizing delivered code | Breaks on upgrade | Use exits/hooks or bolt-ons |
