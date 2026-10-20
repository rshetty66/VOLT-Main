# Oracle EPM Cloud — Troubleshooting Knowledge Base

Common issues, error patterns, and resolution steps across all Oracle EPM Cloud modules.

---

## How to Use This KB

Each entry follows the pattern:
- **Symptom**: What the user sees or reports
- **Root Cause**: Why it happens
- **Resolution**: Step-by-step fix
- **Prevention**: How to avoid recurrence
- **Source**: Where this knowledge came from

---

## Platform-Wide Issues

### 1. Login / Authentication Failures

**Symptom:** "Invalid username or password" or "Unable to authenticate" despite correct credentials.

**Root Cause:**
- IDCS password expired (90-day policy)
- Account locked after 5 failed attempts
- Service account password rotated without updating EPM Automate scripts
- IDCS domain name incorrect in connection URL

**Resolution:**
1. Verify user status in IDCS (Identity Cloud Service) → Users → check "Active" status
2. If locked: Admin unlocks in IDCS → Security → Unlock User
3. If expired: User resets via "Forgot Password" link or admin forces reset
4. For service accounts: Update password in all automation scripts and credential stores
5. Verify domain: Check URL format `https://epm-{podname}.{datacenter}.oraclecloud.com`

**Prevention:** Set up service account with long-lived password (exempt from rotation policy); monitor with alerting 30 days before expiry.

[SOURCE: Project-Multiple]

---

### 2. Monthly Update Breaks Functionality

**Symptom:** After Oracle's monthly update, business rules fail, Smart View times out, or reports render incorrectly.

**Root Cause:** Oracle applies monthly patches automatically. Changes may affect:
- Groovy API methods (deprecated or signature changed)
- REST API endpoint versions
- Smart View compatibility
- Report rendering engine behavior
- Security model changes

**Resolution:**
1. Check Oracle Readiness document (published ~2 weeks before update)
2. Test all critical business rules in TEST environment (updated 1 week before PROD)
3. Review Job Console for new error messages post-update
4. If Groovy rule fails: check `docs.oracle.com` Groovy reference for deprecated methods
5. If Smart View fails: update Smart View client to latest version matching cloud
6. Open SR with Oracle Support if behavior change is undocumented

**Prevention:**
- Assign "Update Readiness Owner" — reviews every monthly release note
- Maintain regression test suite (10-15 critical paths tested post-update)
- Subscribe to Oracle EPM Cloud release notes email
- Test in TEST environment within 24 hours of TEST update

[SOURCE: Oracle-Docs, Project-Multiple]

---

### 3. Smart View Connection Issues

**Symptom:** "Unable to connect to server" or "HTTP 403 Forbidden" in Smart View.

**Root Cause:**
- Corporate proxy/firewall blocking `*.oraclecloud.com`
- Smart View version incompatible with cloud version
- SSL/TLS certificate issue
- Browser session expired (Smart View uses browser cookies)
- VPN disconnect during operation

**Resolution:**
1. Verify browser can access EPM Cloud URL directly
2. Check proxy exceptions: add `*.oraclecloud.com` and `*.oracle.com`
3. Update Smart View: download latest from EPM Cloud (Settings → Downloads)
4. Clear Smart View cache: `%APPDATA%\Oracle\SmartView` → delete cache files
5. Re-authenticate: close all Excel instances, reopen, reconnect
6. If on VPN: verify VPN allows outbound 443 to Oracle Cloud IPs

**Prevention:** Include Smart View version in workstation SOE; auto-update policy; whitelist Oracle Cloud IPs at proxy level.

[SOURCE: MOS-2567432.1, Project-Multiple]

---

### 4. EPM Automate Script Failures

**Symptom:** EPM Automate commands return non-zero exit code; `EPMAUTOMATEERROR` in logs.

**Common Errors and Fixes:**

| Error Message | Cause | Fix |
|---------------|-------|-----|
| "EPMAUTOMATEERROR-001: Login failed" | Bad credentials or URL | Verify user/pass/URL/domain |
| "EPMAUTOMATEERROR-002: File not found" | File path wrong or file not uploaded | Check inbox path; verify upload succeeded |
| "EPMAUTOMATEERROR-003: Rule not found" | Rule name misspelled or deleted | Verify exact rule name in app |
| "EPMAUTOMATEERROR-004: Insufficient privileges" | User lacks required role | Assign Service Admin or appropriate role |
| "EPMAUTOMATEERROR-005: Application not found" | App name case-sensitive | Match exact application name |
| "EPMAUTOMATEERROR-010: Job failed" | Underlying job errored | Check Job Console in EPM Cloud for details |
| "EPMAUTOMATEERROR-020: Timeout" | Operation exceeded timeout | Increase timeout; check if data volume too large |
| Connection reset | Network interruption | Implement retry logic in script |

**Resolution Pattern:**
```batch
epmautomate [command]
if %ERRORLEVEL% neq 0 (
    echo Command failed with exit code %ERRORLEVEL%
    epmautomate getjobstatus  REM Check what happened
    REM Implement retry logic for transient failures
)
```

[SOURCE: Oracle-Docs, MOS-2698741.1]

---

### 5. Performance Degradation (Slow Operations)

**Symptom:** Forms take >10s to load, rules run >5min, reports timeout.

**Root Cause by Area:**

| Area | Common Cause | Check |
|------|-------------|-------|
| Forms | Too many rows/columns; no member suppression | Reduce scope; enable suppress missing |
| Business rules | FIX too broad; iterating all sparse members | Narrow FIX; check rule design |
| Consolidation | Running full consolidation every time | Use incremental (changed entities only) |
| Reports | Complex member functions; large data retrieval | Simplify report; pre-aggregate |
| Data load | Large file; full replace mode on big cube | Split files; use incremental load |
| Smart View | Large ad-hoc retrieval; many concurrent users | Limit retrieval scope; schedule heavy use |

**Resolution Steps:**
1. Check Activity Report (Settings → Activity Report): identify slow operations
2. For rules: use Runtime Substitution Variables to limit scope
3. For forms: reduce dynamic member selections; use page-level POV
4. For retrieval: enable "Suppress Missing Data" and "Suppress Zero Rows"
5. Consider Hybrid BSO mode (if not already enabled)
6. Check if issue correlates with time of day (concurrent user load)
7. Open SR if persistent — Oracle can check server-side metrics

[SOURCE: MOS-2612893.1, Project-Multiple]

---

## EPBCS-Specific Issues

### 6. Business Rule "Invalid Member" Error

**Symptom:** Rule fails with "Invalid member name" or "Cannot find member X"

**Root Cause:**
- Member name changed/deleted but rule still references old name
- Substitution variable not updated (e.g., CurMonth still points to prior month)
- Member name has special characters that Groovy doesn't escape
- Member exists in different plan type than rule targets

**Resolution:**
1. Open rule in editor; search for the specific member name in error
2. Check dimension outline — does member exist? (Dimensions → member search)
3. Check substitution variables: Settings → Application → Substitution Variables
4. If Groovy: ensure member names with spaces use quotes: `"Member Name"`
5. If runtime prompt: verify user entered valid member at execution

[SOURCE: Project-Multiple]

---

### 7. Data Not Appearing After Load

**Symptom:** Data load shows "success" but forms/reports show #NoData or zero.

**Root Cause:**
- Data loaded to wrong intersection (period, scenario, version mismatch)
- Data loaded to parent member (which is dynamic calc — doesn't store data)
- Currency dimension mismatch (data in Local but form shows USD)
- Form POV doesn't match loaded data POV
- Data loaded to wrong plan type (Plan1 vs Plan2)

**Resolution:**
1. Verify load log: check exactly which members data was loaded to
2. Create ad-hoc Smart View retrieval at exact loaded intersection
3. Check if target members are "Store" or "Dynamic Calc" (dynamic won't hold data)
4. Verify currency: is form showing "Local" or "USD"? Does load include currency?
5. Check form properties: which plan type does form point to?
6. Run "Refresh Database" if metadata recently changed

[SOURCE: Project-Multiple]

---

### 8. Approval Workflow Stuck

**Symptom:** Planning unit cannot be promoted; "Promote" button greyed out.

**Root Cause:**
- Validation rule preventing promotion (required fields empty)
- Prior approval step not completed (predecessor dependency)
- User doesn't have Approver role for this planning unit
- Planning unit locked by another operation (rule running, data loading)
- Planning unit already at target state

**Resolution:**
1. Check planning unit status: Approvals → filter by entity → view current state
2. Run validation rules manually to see what fails
3. Check user's approval assignment (does this user own this planning unit?)
4. Check Job Console for running jobs that lock the planning unit
5. Admin can force-promote if legitimately stuck (Application → Planning Unit Hierarchy → Change Status)

[SOURCE: Oracle-Docs]

---

## FCCS-Specific Issues

### 9. Consolidation Out of Balance

**Symptom:** Consolidated entity shows imbalance (assets ≠ liabilities + equity).

**Root Cause:**
- CTA (Cumulative Translation Adjustment) account not configured correctly
- Intercompany elimination not balancing (one side eliminated, other not)
- Opening balances not loaded or translated
- Movement dimension not summing correctly to Total_Movement
- Minority interest calculation error

**Resolution:**
1. Check CTA account: run translation → verify CTA posts to equity
2. ICO analysis: run ICO matching → check for unmatched entries
3. Verify opening balance: Period = "BegBal" or "Prior Close" must have data
4. Check Movement dimension: ensure all movement members roll up to total
5. Check ownership: verify ownership percentages = 100% across all shareholders
6. Run "Force Translate" then "Force Consolidate" to clear cached calculations

[SOURCE: Project-Multiple, MOS-2701234.1]

---

### 10. Intercompany Matching Failures

**Symptom:** ICO matching report shows large unmatched amounts.

**Root Cause:**
- Timing differences (one entity booked, counterpart hasn't)
- Different exchange rates used by each entity
- Account mapping mismatch (entities using different ICO accounts)
- Entity A records as ICO, Entity B records as third-party (missing ICP tag)
- Threshold set too tight (FX rounding creates small differences)

**Resolution:**
1. Review matching tolerance: increase if FX rounding is the issue (±$100 typical)
2. Check period alignment: both entities loaded same period's data
3. Verify ICP tagging: both sides must tag the correct intercompany partner
4. Check account pairing: ICO Revenue <-> ICO Expense must be mapped pairs
5. For timing differences: create adjustment journal to bring into alignment
6. Auto-match within tolerance: set auto-approve for differences < threshold

[SOURCE: Project-Multiple]

---

## ARCS-Specific Issues

### 11. Transaction Matching Rate Too Low

**Symptom:** Auto-match rate below 50%; large volume of unmatched items requiring manual work.

**Root Cause:**
- Matching rules too strict (exact amount + exact date + exact reference)
- Source data quality issues (inconsistent formatting, truncated references)
- Timing differences (bank posts next-day vs GL same-day)
- Batch transactions in one system, individual in other
- Missing or duplicated transactions in one source

**Resolution:**
1. Analyze unmatched patterns: are they all date differences? Amount differences?
2. Relax date tolerance: ±2 business days typically sufficient
3. Add amount tolerance: ±$1 for FX rounding
4. Enable one-to-many matching for batch deposits/payments
5. Normalize reference fields before matching (trim, uppercase, remove special chars)
6. Review source data extraction: ensure complete, no truncation

[SOURCE: Project-Multiple]

---

## Data Management (FDMEE) Issues

### 12. Mapping Errors — "UNMAPPED" Records

**Symptom:** Data load partially fails; error report shows records with UNMAPPED_MEMBER status.

**Root Cause:**
- New source values not yet mapped (new account, new entity in ERP)
- Mapping table uses wrong source field (changed in ERP extract)
- Multi-dimensional mapping condition not matching
- Case sensitivity (source "dept-100" vs mapping "DEPT-100")

**Resolution:**
1. Download error file: EPM Automate `copyfilefrominstance` the error report
2. Identify unmapped source values from error file
3. Add mappings: Data Management → Mappings → select dimension → Add row
4. For case issues: standardize to uppercase in import format scripting
5. Re-run load after fixing mappings
6. Consider adding "catch-all" mapping to prevent future unknown values from blocking entire load

**Prevention:** Before each close, review ERP for new values added since last period; pre-create mappings.

[SOURCE: Project-Multiple]

---

### 13. Data Load Rule "No Data to Export"

**Symptom:** Import succeeds (data visible in staging) but export step says "No data to export."

**Root Cause:**
- All records failed mapping (100% unmapped)
- Validation rule rejected all records
- Location filter doesn't match data in staging
- Period mapping incorrect (data staged to wrong period)
- Load rule pointing to wrong target plan type

**Resolution:**
1. Check DM Process Detail → Drill into Import step → verify data is staged
2. Check Map step → look for mapping errors (unmapped %)
3. Check Validate step → look for validation rejections
4. Verify Location matches the Entity values in staged data
5. Verify Period Mapping: is source period correctly mapped to target period?
6. Confirm target plan type in rule matches where data should land

[SOURCE: Oracle-Docs, Project-Multiple]

---

## General Resolution Patterns

### When to Open Oracle SR

Open a Service Request when:
- Issue persists after applying all documented resolutions
- Behavior changed after monthly update (possible regression)
- Performance issue not explained by data volume or design
- Error message contains internal Oracle references (stack trace, NPE)
- Feature works in TEST but not PRODUCTION (infrastructure issue)
- Data corruption suspected

### SR Best Practices

1. **Reproduce in TEST** — Oracle will always ask "does this happen in TEST?"
2. **Include screenshots** — Error dialog, Job Console details, Activity Report
3. **Provide steps to reproduce** — Exact sequence that triggers the error
4. **State severity correctly** — Sev 1 = production down; Sev 2 = major feature blocked; Sev 3 = workaround exists
5. **Reference MOS doc ID** — If you found a related known issue, reference it
6. **Include timing** — When did this start? Correlate with monthly update or config change

### Useful MOS (My Oracle Support) Search Tips

| Search For | MOS Query |
|------------|-----------|
| Known bugs | "Bug [number]" or search by exact error text |
| Best practices | "EPM Cloud Best Practices" |
| Monthly update notes | "EPM Cloud Readiness [month] [year]" |
| Smart View issues | Product = "Smart View" + error text |
| EPM Automate | Product = "EPM Cloud" + "EPM Automate" + command name |
| FCCS consolidation | Product = "FCCS" + symptom keywords |
| Performance | "EPM Cloud Performance" + module name |

---

## Diagnostic Tools

| Tool | Access | Purpose |
|------|--------|---------|
| **Job Console** | Application → Jobs | Monitor running/completed jobs; view errors |
| **Activity Report** | Settings → Activity Report | See all user/system activity with timing |
| **Provide Feedback** | Help → Provide Feedback | Submit diagnostic snapshot to Oracle (for SR) |
| **Audit Trail** | Application → Audit | Track data and metadata changes |
| **DM Process Details** | Data Management → Process Details | Stage-by-stage load results and errors |
| **Migration Status** | LCM → Migration Status | Track LCM import/export operations |
| **Access Control** | Settings → Access Control | Verify user roles and provisioning |
| **Connections** | Settings → Connections | Verify external system connectivity |
