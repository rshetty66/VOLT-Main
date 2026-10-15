# Oracle ERP Cloud — Troubleshooting Knowledge Base

Common issues and resolution patterns across Oracle Cloud ERP modules.

---

## General Platform Issues

### 1. ESS Job Failures

**Symptom:** Scheduled process shows Error or Warning status.

**Resolution Steps:**
1. Navigate to Scheduled Processes → search by job name
2. Click on the failed job → View Output/Log
3. Check log for specific error message
4. Common causes: invalid data in interface table, timeout, lock contention
5. Fix data and resubmit; or check if concurrent request hit memory limit

### 2. FBDI Import Errors

**Symptom:** "Import" ESS job completes but records not imported.

**Common Causes:**
- CSV encoding issue (must be UTF-8 without BOM)
- Header row doesn't match expected format
- Mandatory field missing or invalid value
- Reference data doesn't exist (e.g., supplier not set up)
- Date format wrong (must be YYYY/MM/DD)

**Resolution:** Download error output from ESS job → fix identified rows → re-import.

### 3. Security / Access Denied

**Symptom:** "You are not authorized" or function not visible.

**Resolution:**
1. Check user's assigned roles (Security Console → Users)
2. Verify role contains required duty role
3. Verify duty role contains required privilege
4. For data access: check Data Access Set (ledger/business unit access)
5. If recently changed: user may need to sign out and back in (role cache)

### 4. Workflow (BPM) Stuck in Approval

**Symptom:** Transaction stuck in "Pending Approval" with no approver assigned.

**Resolution:**
1. Check BPM Worklist → Admin view → find transaction
2. Verify AME rules return a valid approver for the transaction attributes
3. Check if approver is on leave/inactive
4. Admin can reassign or skip approval step if authorized
5. Fix AME rule to handle edge case; test with Approval Test UI

---

## GL-Specific Issues

### 5. Journal Won't Post

| Cause | Check | Fix |
|-------|-------|-----|
| Period closed | Period status for the ledger | Reopen period or move to correct period |
| Account invalid | Account combination exists? | Create combination or fix coding |
| Out of balance | Header amount ≠ line total | Verify debits = credits |
| Approval pending | Workflow not complete | Complete approval or admin force |

### 6. Trial Balance Mismatch

**Symptom:** GL balance doesn't match subledger balance.

**Resolution:**
1. Run "Subledger Period Close Exceptions" report
2. Check for unposted journals (Import Journals pending)
3. Check for incomplete "Create Accounting" runs
4. Verify all subledger periods are closed before GL close
5. Reconcile using GL Account Analysis (drill to subledger)

---

## AP-Specific Issues

### 7. Invoice Matching Hold

**Resolution:**
1. Navigate to invoice → Holds tab → identify hold name
2. If price variance: check PO price vs invoice price
3. If quantity: check receipt quantity vs invoice quantity
4. Options: release hold (with justification), amend PO, or reject invoice
5. For systematic issues: adjust matching tolerances

### 8. Payment File Rejected by Bank

**Common Causes:**
- Invalid bank account/routing number
- File format field lengths exceeded
- Special characters in supplier name
- Amount exceeds bank limit
- Effective date in the past

---

## AR-Specific Issues

### 9. AutoInvoice Import Errors

| Error | Cause | Fix |
|-------|-------|-----|
| "Invalid customer" | Customer account not active | Activate customer or fix ID |
| "Invalid memo line" | Transaction type not configured | Create/enable memo line |
| "Invalid tax" | Tax rate not found for jurisdiction | Configure tax rate |
| "Period closed" | GL date falls in closed period | Adjust GL date |

---

## Procurement Issues

### 10. Requisition Stuck in Approval

**Resolution:**
1. Check approval history on requisition
2. Verify AME rules match the requisition attributes (amount, category, org)
3. If no rule matches: add catch-all rule
4. If approver inactive: reassign via admin console
5. Test with AME Rules Test page before deploying changes

---

## Performance Issues

### Common Causes and Fixes

| Symptom | Cause | Fix |
|---------|-------|-----|
| Report timeout | Large data volume, no filters | Add date/org filter parameters |
| Slow page load | Too many records in search results | Apply search criteria before querying |
| ESS job timeout | Processing large volume | Split into smaller batches |
| Integration timeout | API response too large | Add pagination; reduce payload |

---

## When to Open Oracle SR

- Issue persists after standard troubleshooting
- System behavior changed after quarterly update
- Performance degradation with no clear cause
- Error references internal Oracle stack trace
- Data corruption suspected

**SR Best Practices:**
1. Reproduce in a test environment first
2. Include exact error message and screenshots
3. Provide steps to reproduce
4. Include ESS job output/log
5. Reference any related MOS documents you found
