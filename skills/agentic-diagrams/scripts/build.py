#!/usr/bin/env python3
"""Validate a diagram spec (JSON) and write a standalone interactive HTML file.
Usage: build.py spec.json out.html"""
import json, sys, html, pathlib
TYPES={"agent","tool","model","prompt","skill","output","user","human","memory","knowledge","environment","aggregator","gateway","router","channel","trigger","guardrail","observability"}
KINDS={"request","response","async","streaming","event","error"}
def fail(m): sys.exit("spec error: "+m)
def main(a):
    if len(a)!=2: sys.exit(__doc__)
    s=json.load(open(a[0])); ids=set()
    for n in s.get("nodes",[]):
        if n["id"] in ids: fail("duplicate node "+n["id"])
        ids.add(n["id"])
        if n.get("type","agent") not in TYPES: fail(f'{n["id"]}: unknown type {n.get("type")}; use {sorted(TYPES)}')
    if not ids: fail("no nodes")
    keys=set()
    for e in s.get("edges",[]):
        if e["from"] not in ids or e["to"] not in ids: fail(f"edge {e} references unknown node")
        if e.get("kind","request") not in KINDS: fail(f"unknown edge kind {e.get('kind')}")
        keys.add(e["from"]+">"+e["to"])
    for sc in s.get("scenarios",[]):
        for st in sc["steps"]:
            for k in st.get("edges",[st.get("edge")]):
                if k not in keys: fail(f'scenario "{sc["name"]}": step edge {k} not in edges')
    for g in s.get("groups",[]):
        for i in g["nodes"]:
            if i not in ids: fail("group references unknown node "+i)
    if len(s["nodes"])>14: print("warning: >14 nodes; consider decomposing into several diagrams",file=sys.stderr)
    t=pathlib.Path(__file__).parent.parent/"assets/template.html"
    out=t.read_text().replace("__TITLE__",html.escape(s.get("title","Diagram"))).replace("__SPEC__",json.dumps(s).replace("</","<\\/"))
    pathlib.Path(a[1]).write_text(out); print("wrote",a[1])
main(sys.argv[1:])
