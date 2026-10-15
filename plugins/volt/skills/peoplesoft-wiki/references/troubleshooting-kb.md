# PeopleSoft — Troubleshooting Knowledge Base

Common issues and resolution patterns for PeopleSoft FSCM and HCM.

---

## Application Server Issues

| Issue | Cause | Resolution |
|-------|-------|-----------|
| App server crash / Tuxedo SIGABRT | Memory leak or runaway process | Check APPSRV.LOG; increase MAXWSCLIENTS; recycle domain |
| Slow page response | Too many app server domains or DB contention | Check PSAPPSRV trace; tune SQL; scale app server |
| "Unable to connect to Application Server" | Domain down or firewall | Verify domain status; check JOLT port accessibility |

## Process Scheduler Issues

| Issue | Cause | Resolution |
|-------|-------|-----------|
| Process stuck in "Queued" | Scheduler not running or max concurrent reached | Check PSPRCSRV status; increase max processes |
| SQR fails with ORA-xxxx | SQL error in SQR program | Check SQR .log output; fix SQL or data |
| App Engine restartable | AE failed mid-run; can be restarted | Fix data issue; restart from failed step |
| nVision produces blank report | Scope/layout mismatch or no data | Check tree nodes, ledger, business unit filter |

## GL Issues

| Issue | Cause | Resolution |
|-------|-------|-----------|
| Journal edit fails "combo error" | Invalid ChartField combination | Check combo edit rules; fix ChartField |
| Journal won't post | Period closed or budget check fail | Open period or check commitment control |
| Allocations produce wrong amounts | Pool/target step misconfigured | Verify allocation step basis and targets |
| Interunit out of balance | Missing interunit pair or setup | Check interunit/intraunit configuration |

## AP Issues

| Issue | Cause | Resolution |
|-------|-------|-----------|
| Voucher won't match PO | Price or qty outside tolerance | Check matching tolerances; adjust PO or voucher |
| Pay cycle doesn't produce checks | Selection criteria too narrow | Broaden selection; check payment method |
| 1099/T4A missing vendors | Vendor reporting setup incorrect | Check withholding applicability flag |

## HCM Issues

| Issue | Cause | Resolution |
|-------|-------|-----------|
| Pay calc "out of balance" | Deductions > gross pay | Check deduction priority/processing order |
| Benefits enrollment unavailable | Event rules not triggered | Check life event configuration |
| ROE not generating | Missing insurable hours | Verify earnings mapped to EI hours |

## Integration Broker Issues

| Issue | Cause | Resolution |
|-------|-------|-----------|
| Message stuck in "NEW" | Handler errored or queue paused | Check Service Operation Monitor; activate queue |
| "HTTP 500" on outbound | Target system error | Check target endpoint; verify XML payload |
| Pub/Sub not firing | Subscription not activated | Activate subscription in routing definition |
| REST service returns 403 | Permission list doesn't include service | Add service operation to permission list |

## Performance Tips

1. **Run Trace on slow pages**: Component Trace → identify slow SQL
2. **App Engine**: Use Set-Based SQL over row-by-row; commit frequently
3. **nVision**: Use summary ledger tables for large reports
4. **Indexing**: Check missing indexes on custom tables
5. **Cache**: Clear app server cache after metadata changes (PSCACHE.SQR)
