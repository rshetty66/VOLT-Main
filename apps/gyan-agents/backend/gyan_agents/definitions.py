"""Reference existing definitions; only new project definitions occupy local rows."""
import hashlib
import json
import os
import re
import unicodedata
from difflib import SequenceMatcher
from functools import lru_cache
from pathlib import Path

from fastapi import HTTPException


def norm(text):
    return "".join(c for c in unicodedata.normalize("NFKC",text).casefold() if c.isalnum())


@lru_cache(maxsize=1)
def builtin():
    plugin=Path(os.getenv("VOLT_PLUGIN_DIR",str(Path(__file__).resolve().parents[4]/"plugins/volt")))
    rows=[]
    for kind in ("agent","skill"):
        for v in json.loads((plugin/"data"/f"{kind}s.json").read_text()):
            file=plugin/"agents"/(v["id"]+".md") if kind=="agent" else plugin/"skills"/v["id"]/"SKILL.md"
            content=file.read_text() if file.is_file() else v.get("description","")
            sha=hashlib.sha256(content.encode()).hexdigest()
            rows.append({"kind":kind,"id":v["id"],"name":v.get("name") or v["id"],"origin":"VOLT",
                         "ref":f"volt:{kind}:{v['id']}@{sha[:16]}","signature":norm(content),"body":content})
    bindings=json.loads((plugin/"data/finance-workflow-bindings.json").read_text())
    by_id={r["id"]:r for r in rows if r["kind"]=="agent"}
    for v in json.loads((Path(__file__).parent/"seeds/catalog.json").read_text()):
        by_id[bindings[v["id"]]].setdefault("aliases",[]).extend([v["id"],v["name"]])
    return rows


def all_defs(c):
    return builtin()+[json.loads(r[0]) for r in c.execute("select document from definitions")]


def summary(r):return {k:v for k,v in r.items() if k not in ("body","signature")}


def lookup(c,kind,q):
    key=norm(q)
    scored=[]
    for r in all_defs(c):
        if r["kind"]!=kind:continue
        names=[norm(v) for v in [r["name"],r["id"],*r.get("aliases",[])]]
        score=max(1 if key==s else .9 if key and key in s else SequenceMatcher(None,key,s).ratio() for s in names)
        if not key or score>=.48:scored.append((score,r))
    return [summary(r) for _,r in sorted(scored,key=lambda v:(-v[0],v[1]["name"]))[:12]]


def create(c,kind,name,body,policy="require_evidence",profile=None):
    key=norm(name);sig=norm(body)
    if not key or not sig:raise HTTPException(422,"Meaningful name and instructions required")
    existing=[r for r in all_defs(c) if r["kind"]==kind]
    for r in existing:
        if key in [norm(v) for v in [r["name"],r["id"],*r.get("aliases",[])]] or sig==r["signature"]:
            return {"created":False,"definition":summary(r)}
    slug=re.sub(r"[^a-z0-9]+","-",unicodedata.normalize("NFKD",name).encode("ascii","ignore").decode().lower()).strip("-") or hashlib.sha256(key.encode()).hexdigest()[:12]
    if any(norm(slug) in (norm(r["name"]),norm(r["id"])) for r in existing):
        raise HTTPException(409,"Canonical ID already exists; reuse the existing definition")
    ref=f"project:{kind}:{slug}@1"
    d={"name":name,"id":slug,"ref":ref,"origin":"Project","kind":kind,"body":body,"signature":sig,"policy":policy,"profile":profile}
    c.execute("insert into definitions values(?,?,?,?,?)",(kind,key,hashlib.sha256(sig.encode()).hexdigest(),ref,json.dumps(d)))
    return {"created":True,"definition":summary(d)}
