# PeopleSoft HCM — Human Capital Management

Implementation reference for PeopleSoft Human Capital Management modules.

---

## Module Map

| Module | Purpose | Key Records |
|--------|---------|------------|
| **Core HR** | Employee master, position management, organizational structure | JOB, PERSON, POSITION_DATA |
| **Benefits** | Benefits enrollment, life events, COBRA | HEALTH_BENEFIT, SAVINGS_PLAN |
| **Payroll (NA)** | North American payroll processing, tax | PAY_EARNINGS, PAY_CHECK |
| **Time & Labor** | Time entry, approval, costing | TL_RPTD_TIME, TL_PAYABLE_TIME |
| **Recruiting** | Requisitions, applicant tracking, hiring | HRS_JO_I, HRS_APP_I |
| **Talent Management** | Performance, succession, development | EP_APPRAISAL, SUCCESSION_PLAN |
| **ePerformance** | Performance reviews and goal management | EP_APPRAISAL, EP_GOAL |
| **Learning Management** | Training catalog, enrollment, completion | LM_CI, LM_ENRLMT |
| **Compensation** | Salary planning, merit cycles, equity | CMP_PLAN, CMP_PRFL |
| **Absence Management** | Leave tracking, accruals, self-service | GP_ABS_HIST, ABS_TYPE_TBL |

---

## Core HR

### Employee Record Structure

```
PERSON (EMPLID)
  └── JOB Record (EMPL_RCD)
       ├── Effective-Dated Rows (EFFDT + EFFSEQ)
       │   └── Action/Reason pairs
       ├── DEPARTMENT
       ├── POSITION
       ├── JOBCODE
       ├── LOCATION
       ├── COMPENSATION
       └── STATUS (Active, LOA, Terminated)
```

### Effective Dating

PeopleSoft uses **effective dating** for historical tracking:
- Every row has EFFDT (effective date) + EFFSEQ (sequence within date)
- Current row = MAX(EFFDT) <= today
- Future rows allowed (pending actions)
- History preserved (never deleted)

### Actions & Reasons

| Action | Use Case | Effective Date |
|--------|----------|---------------|
| HIR | New hire | First day of work |
| PRO | Promotion | Effective date of new role |
| DEM | Demotion | Date of change |
| XFR | Transfer | Date of new position |
| TER | Termination | Last day of work |
| LOA | Leave of absence | First day of leave |
| RFL | Return from leave | First day back |
| PAY | Pay rate change | Effective date of new rate |
| POS | Position change | Date of new position |

---

## Payroll (North America)

### Payroll Process Flow

```
TIME ENTRY → PAYSHEET CREATION → PAY CALCULATION → PAY CONFIRMATION → BANK FILE → TAX FILING
     │              │                   │                  │               │            │
  T&L/Manual    Generate from      Calculate gross    Confirm checks    EFT/Check    T4/W2/ROE
               Job/Earnings        net, taxes, dedns  finalize           generate
```

### Canadian Payroll Specifics

| Feature | Description |
|---------|-------------|
| CPP/QPP | Canada/Quebec Pension Plan deductions |
| EI | Employment Insurance premiums |
| Provincial Tax | Province-specific tax tables (each province) |
| RRSP | Registered Retirement Savings Plan deduction |
| T4/T4A | Year-end tax slip generation |
| ROE | Record of Employment (for EI claims) |
| WCB | Workers' Compensation Board premiums |
| DPSP | Deferred Profit Sharing Plan |

### Key Tables

| Table | Purpose |
|-------|---------|
| PAY_EARNINGS | Payroll earnings records |
| PAY_DEDUCTION | Payroll deductions |
| PAY_TAX | Tax calculations |
| PAY_CHECK | Check/deposit records |
| PAY_CALENDAR | Pay period definitions |
| TAX_DATA1 | Employee tax withholding setup |
| CAN_TAX_DATA | Canadian-specific tax data |

---

## Benefits Administration

### Benefits Program Structure

```
BENEFIT_PROGRAM
  └── PLAN_TYPE (Medical, Dental, Vision, Life, RRSP)
       └── BENEFIT_PLAN (specific plan options)
            └── COST (employer/employee contribution)
                 └── COVERAGE (single, family, etc.)
```

### Life Events

| Event | Trigger | Impact |
|-------|---------|--------|
| New Hire | HIR action | Open enrollment window |
| Marriage | Personal data change | Add dependents, change coverage |
| Birth/Adoption | Dependent add | Add dependent coverage |
| Divorce | Personal data change | Remove spouse coverage |
| Termination | TER action | COBRA notification, coverage end |
| Open Enrollment | Annual cycle | All active employees eligible |

---

## Time & Labor

### Time Reporting

| Method | Description | Use Case |
|--------|-------------|----------|
| **Punch** | Clock-in/clock-out | Hourly workers, shift workers |
| **Elapsed** | Hours per day | Salaried, project-based |
| **Exception** | Only report non-standard time | Standard schedule + OT/absence |

### Time-to-Pay Flow

```
TIME REPORTED → APPROVED → VALIDATED (RULES) → SENT TO PAYROLL → COSTED TO GL/PROJECTS
     │              │            │                    │                   │
  Employee      Manager      System checks        Payable time       Accounting
  enters time   approves     schedule rules       to earnings        distribution
```

---

## Integration Points

| Integration | Direction | Method |
|-------------|-----------|--------|
| HCM → GL | Payroll costs to ledger | Payroll Distribution (GL Interface) |
| HCM → Projects | Labor costs to projects | Time & Labor → Project Costing |
| Benefits → Payroll | Deduction amounts | Benefits Administration |
| T&L → Payroll | Approved hours | Time Administration |
| Recruiting → Core HR | New hire data | Hire process |
| HCM → Third Party | Benefits carriers, tax agencies | File-based/Web Services |

---

## Common PeopleSoft HCM Issues

| Issue | Root Cause | Resolution |
|-------|-----------|------------|
| Pay calc error | Missing tax data or invalid earnings | Check TAX_DATA1 and PAY_EARNINGS |
| Benefits enrollment won't save | Eligibility rules not met | Check benefit program eligibility config |
| Time not flowing to payroll | Time admin not run or rejected | Run Time Admin; check reported time status |
| ROE not generating | Missing insurable hours/earnings | Verify EI configuration |
| Position budget exceeded | Headcount/FTE exceeds position limit | Increase position count or check data |
