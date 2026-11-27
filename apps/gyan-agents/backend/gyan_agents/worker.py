"""Fixed, offline Python/SQLite worker. No caller code, SQL, file paths or commands."""
import base64
import csv
import hashlib
import io
import json
import re
import sqlite3
import sys
import zipfile
from decimal import Decimal

MAX_ROWS = 5000
LIMIT = 2_000_000
HEAD = re.compile(r"[a-zA-Z][a-zA-Z0-9_ ]{0,63}")


def tabulate(rows):
    it = iter(rows)
    headers = [str(x or "").strip().lower().replace(" ", "_") for x in next(it, ())]
    if not headers or len(headers)>64 or len(set(headers))!=len(headers) or not all(HEAD.fullmatch(h) for h in headers):
        raise ValueError("Missing, duplicate or ambiguous headers")
    out=[]
    for row in it:
        if not any(x is not None and str(x).strip() for x in row): continue
        if len(row)!=len(headers) or len(out)>=MAX_ROWS: raise ValueError("Malformed or oversized table")
        vals=[str(x if x is not None else "").strip() for x in row]
        if any(len(x)>16000 for x in vals): raise ValueError("Oversized cell")
        out.append(dict(zip(headers,vals)))
    if not out: raise ValueError("Empty table")
    return out


def parse(q):
    raw=base64.b64decode(q["content"],validate=True)
    if not 0<len(raw)<=LIMIT: raise ValueError("Empty or oversized upload")
    suffix=q["name"].lower().rsplit(".",1)[-1]
    if suffix=="xlsx":
        import openpyxl
        with zipfile.ZipFile(io.BytesIO(raw)) as z:
            if len(z.infolist())>300 or sum(f.file_size for f in z.infolist())>12_000_000: raise ValueError("Oversized workbook")
        wb=openpyxl.load_workbook(io.BytesIO(raw),read_only=True,data_only=False,keep_links=False)
        if len(wb.worksheets)>20: raise ValueError("Too many sheets")
        sheets={}
        for ws in wb.worksheets:
            if ws.sheet_state!="visible": continue
            def cells():
                for row in ws.iter_rows():
                    if any(c.data_type=="f" for c in row): raise ValueError("Formula workbook: export values first")
                    yield [c.value for c in row]
            sheets[ws.title]=tabulate(cells())
        wb.close()
    elif suffix=="pdf":
        from pypdf import PdfReader
        doc=PdfReader(io.BytesIO(raw))
        if doc.is_encrypted or len(doc.pages)>64: raise ValueError("Encrypted or oversized PDF")
        sheets={"pages":[{"page":str(i),"text":p.extract_text() or ""} for i,p in enumerate(doc.pages,1)]}
        if not sheets["pages"] or not all(r["text"].strip() for r in sheets["pages"]): raise ValueError("Image-only or mixed scanned PDF")
    elif suffix in ("txt","csv","tsv"):
        text=raw.decode("utf-8-sig")
        if "\0" in text: raise ValueError("Binary input")
        widths=q.get("widths")
        if widths:
            if not 1<=len(widths)<=64 or not all(type(w) is int and 0<w<=128 for w in widths): raise ValueError("Invalid column widths")
            lines=text.splitlines()
            if any(len(line)!=sum(widths) for line in lines): raise ValueError("Fixed-width layout mismatch")
            def fields(line):
                offset=0
                for w in widths: yield line[offset:offset+w].strip(); offset+=w
            sheets={"data":tabulate([list(fields(l)) for l in lines])}
        elif suffix=="txt" and q.get("text_mode")=="notes":
            sheets={"notes":[{"line":str(i),"text":l} for i,l in enumerate(text.splitlines(),1) if l.strip()]}
        else:
            delimiter=q.get("delimiter") or ("\t" if suffix=="tsv" else "," if suffix=="csv" else csv.Sniffer().sniff(text[:4096],delimiters=",;\t|").delimiter)
            if delimiter not in [",",";","\t","|"]: raise ValueError("Invalid delimiter")
            sheets={"data":tabulate(csv.reader(io.StringIO(text),delimiter=delimiter,strict=True))}
    else: raise ValueError("Unsupported format")
    if not sheets or not 0<sum(map(len,sheets.values()))<=MAX_ROWS: raise ValueError("Empty or oversized snapshot")
    return {"sheets":sheets,"digest":digest(sheets)}


def digest(value):
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(",",":")).encode()).hexdigest()


PORTS={"r2r_reconciler":("bank","gl"),"fpa_variance_flux":("actual","budget"),"p2p_ap_3way_match":("invoice","po","receipt")}


def cents(s):
    if not re.fullmatch(r"-?\d{1,12}(?:\.\d{1,2})?",str(s)): raise ValueError("Amount must be exact decimal currency, at most two decimal places")
    return int(Decimal(str(s))*100)


def calculate(task):
    profile=task["profile"]; ports=PORTS[profile]; inputs=task["inputs"]
    if set(inputs)!=set(ports): raise ValueError("Required input ports missing or incorrect")
    sql=sqlite3.connect(":memory:")
    sql.execute("create table lines(port text, ref text, currency text, amount integer, locator text, primary key(port,ref,currency))")
    python_book={}
    for port in ports:
        snap=inputs[port]; rows=snap["rows"]
        if not rows: raise ValueError("Missing evidence")
        if any("journal_id" in r or "debit" in r or "credit" in r for r in rows):
            balances={}
            for r in rows:
                if not r.get("journal_id") or not r.get("currency") or "debit" not in r or "credit" not in r:
                    raise ValueError("Incomplete journal evidence")
                debit,credit=cents(r["debit"]),cents(r["credit"])
                if min(debit,credit)<0 or (debit>0)==(credit>0):raise ValueError("Invalid debit/credit line")
                k=(r["journal_id"],r["currency"]);balances[k]=balances.get(k,0)+debit-credit
            if any(balances.values()):raise ValueError("Unbalanced journal; cannot verify")
        for idx,row in enumerate(rows,1):
            key=row.get("reference",""); ccy=row.get("currency","")
            if not key or not re.fullmatch("[A-Z]{3}",ccy): raise ValueError("Missing reference or currency")
            amount=cents(row["amount"])
            sql.execute("insert into lines values(?,?,?,?,?)",(port,key,ccy,amount,f"{snap['id']}:{snap['sheet']}:{idx}"))
            python_book.setdefault((key,ccy),{})[port]=Decimal(row["amount"])
    # Port literals come exclusively from the fixed program above.
    pivot=",".join(f"max(case when port='{p}' then amount end)" for p in ports)
    results=[]; material=False
    for ref,ccy,*values in sql.execute(f"select ref,currency,{pivot} from lines group by ref,currency order by ref,currency"):
        diff=sql.execute("select coalesce(?,0)-coalesce(?,0)",values[:2]).fetchone()[0]
        missing=any(v is None for v in values)
        status="missing" if missing else "difference" if len(set(values))>1 else "matched"
        # Independent implementation: reproduce the SQL comparison from original decimal strings.
        b=python_book[(ref,ccy)]
        expected=int((b.get(ports[0],Decimal(0))-b.get(ports[1],Decimal(0)))*100)
        cross="missing" if set(b)!=set(ports) else "matched" if len(set(b.values()))==1 else "difference"
        if (expected,cross)!=(diff,status): raise ValueError("Independent verifier disagreement")
        evidence=[l[0] for l in sql.execute("select locator from lines where ref=? and currency=? order by port",(ref,ccy))]
        results.append({"reference":ref,"currency":ccy,"values_cents":dict(zip(ports,values)),"difference_cents":diff,"status":status,"evidence":evidence})
        material |= status!="matched"
    return {"profile":profile,"lines":results,"exceptions":sum(r["status"]!="matched" for r in results),
            "verified_by":"independent_decimal_reperformance","requires_review":material,"result_hash":digest(results),"posted":False}


if __name__=="__main__":
    import resource
    resource.setrlimit(resource.RLIMIT_CPU,(8,8))
    resource.setrlimit(resource.RLIMIT_AS,(512*1024**2,512*1024**2))
    resource.setrlimit(resource.RLIMIT_FSIZE,(0,0))
    try:
        task=json.load(sys.stdin)
        if task["operation"]=="verify":
            import runpy
            from pathlib import Path
            verifier=runpy.run_path(str(Path(__file__).with_name("critic.py")))["verify"]
            result=verifier(task["inputs"],task["result"],PORTS[task["profile"]])
        else:
            result=parse(task) if task["operation"]=="parse" else calculate(task) if task["operation"]=="calculate" else None
        if result is None: raise ValueError("Unknown operation")
        print(json.dumps({"ok":True,"result":result},separators=(",",":")))
    except Exception as exc:
        print(json.dumps({"ok":False,"error":str(exc)[:220] or "Input quarantined"}))
