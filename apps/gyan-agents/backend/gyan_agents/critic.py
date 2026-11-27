"""Independent read-only verifier. Does not import builder code or trust its arithmetic."""
from decimal import Decimal


def verify(inputs, result, ports):
    expected={}
    for port in ports:
        snap=inputs[port]
        for i,r in enumerate(snap["rows"],1):
            bucket=expected.setdefault((r["reference"],r["currency"]),{})
            if port in bucket:raise ValueError("Ambiguous source lines")
            bucket[port]=(Decimal(r["amount"])*100,f"{snap['id']}:{snap['sheet']}:{i}")
    seen=set()
    for line in result["lines"]:
        key=(line["reference"],line["currency"])
        if key not in expected or key in seen:raise ValueError("Unsupported or duplicate result")
        seen.add(key); group=expected[key]
        vals={k:int(group[k][0]) if k in group else None for k in ports}
        status="missing" if None in vals.values() else "matched" if len(set(vals.values()))==1 else "difference"
        if (line["values_cents"]!=vals or line["difference_cents"]!=(vals[ports[0]] or 0)-(vals[ports[1]] or 0)
            or line["status"]!=status or sorted(line["evidence"])!=sorted(v[1] for v in group.values())):
            raise ValueError("Unsupported figure or source reference")
    if seen!=expected.keys():raise ValueError("Source lines omitted")
    if result["exceptions"]!=sum(r["status"]!="matched" for r in result["lines"]):raise ValueError("Wrong exception count")
    return {"verified":True,"profile":"ctrl_finance_critic","source_lines":sum(len(v) for v in expected.values())}
