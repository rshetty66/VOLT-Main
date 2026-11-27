"""Project-isolated, simulation-only runtime. It has no finance write-back connector."""
import base64
import hashlib
import hmac
import json
import os
import re
import sqlite3
import subprocess
import sys
import tempfile
import time
import queue
from threading import Thread
from contextlib import contextmanager
from datetime import datetime, timezone
from graphlib import TopologicalSorter
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field

from .gateway import MCPGateway
from .schemas import WorkflowDAG
from .worker import PORTS, digest
from . import definitions

router=APIRouter(prefix="/studio")
TEMPLATES={"close":"r2r_reconciler","variance":"fpa_variance_flux","match":"p2p_ap_3way_match"}
OUTPUT={"r2r_reconciler":"bank_gl_matches","fpa_variance_flux":"variances","p2p_ap_3way_match":"line_matches"}
SAMPLE={"bank":[("A","10.00"),("B","8.75")],"gl":[("A","10.00")],"actual":[("sales","250.00")],
        "budget":[("sales","210.00")],"invoice":[("PO-1","105.00")],"po":[("PO-1","100.00")],"receipt":[("PO-1","100.00")]}
SCHEMA="""
CREATE TABLE IF NOT EXISTS snapshots(id TEXT PRIMARY KEY, document TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS drafts(id TEXT,version INTEGER,document TEXT NOT NULL,PRIMARY KEY(id,version));
CREATE TABLE IF NOT EXISTS briefs(id TEXT PRIMARY KEY, actor TEXT NOT NULL, document TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS plan_receipts(brief_id TEXT PRIMARY KEY,document TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS definitions(kind TEXT, name_key TEXT, signature TEXT, ref TEXT UNIQUE, document TEXT NOT NULL,
 PRIMARY KEY(kind,name_key),UNIQUE(kind,signature));
CREATE TABLE IF NOT EXISTS runs(id TEXT PRIMARY KEY, request_key TEXT UNIQUE NOT NULL, fingerprint TEXT NOT NULL,
 actor TEXT NOT NULL, status TEXT NOT NULL, artifact_hash TEXT NOT NULL, document TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS events(seq INTEGER PRIMARY KEY,run_id TEXT NOT NULL, document TEXT NOT NULL);
CREATE TRIGGER IF NOT EXISTS event_immutable BEFORE UPDATE ON events BEGIN SELECT RAISE(ABORT,'immutable'); END;
CREATE TRIGGER IF NOT EXISTS event_no_delete BEFORE DELETE ON events BEGIN SELECT RAISE(ABORT,'immutable'); END;
"""


def scope(request:Request):
    secret=os.getenv("GYAN_INTERNAL_TOKEN","")
    if len(secret)<32 or not hmac.compare_digest(request.headers.get("authorization",""),f"Bearer {secret}"):
        raise HTTPException(403,"Trusted VOLT gateway required")
    project=request.headers.get("x-gyan-project",""); actor=request.headers.get("x-gyan-actor","")
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,80}",project) or not actor: raise HTTPException(403,"Missing scope")
    return project,actor,request.headers.get("x-gyan-role","reader")


@contextmanager
def store(project):
    root=Path(os.getenv("GYAN_STUDIO_DIR","./gyan-workspaces"))
    root.mkdir(parents=True,exist_ok=True,mode=0o700)
    conn=sqlite3.connect(root/(hashlib.sha256(project.encode()).hexdigest()+".sqlite"),timeout=10)
    conn.row_factory=sqlite3.Row
    try:
        conn.executescript(SCHEMA);conn.execute("BEGIN IMMEDIATE")
        yield conn
        conn.commit()
    except BaseException:
        conn.rollback();raise
    finally:conn.close()


def isolated(task):
    with tempfile.TemporaryDirectory() as home:
        try:
            res=subprocess.run([sys.executable,"-IB",str(Path(__file__).with_name("worker.py"))],
                input=json.dumps(task),text=True,capture_output=True,timeout=12,cwd=home,env={"HOME":home,"LANG":"C.UTF-8"})
            obj=json.loads(res.stdout)
        except (ValueError,subprocess.TimeoutExpired) as exc: raise HTTPException(422,"Worker failed or exceeded limits") from exc
    if not obj["ok"]:raise HTTPException(422,obj["error"])
    return obj["result"]


def write_scope(auth):
    if auth[2] not in ("designer","controller"):raise HTTPException(403,"Designer role required")


def save_source(c, parsed, sheet):
    if sheet not in parsed["sheets"]:raise HTTPException(422,"Select a sheet: "+", ".join(parsed["sheets"]))
    rows=parsed["sheets"][sheet];sid=digest({"sheet":sheet,"rows":rows})
    def dtype(values):
        nonempty=[v for v in values if v!=""]
        if not nonempty:return "empty"
        if all(re.fullmatch(r"-?(0|[1-9][0-9]*)",v) for v in nonempty):return "integer-string"
        if all(re.fullmatch(r"-?\d+\.\d+",v) for v in nonempty):return "decimal-string"
        return "text"
    doc={"id":sid,"sheet":sheet,"rows":rows,"columns":list(rows[0]),"count":len(rows),
         "types":{k:dtype([r[k] for r in rows]) for k in rows[0]}}
    c.execute("insert or ignore into snapshots values(?,?)",(sid,json.dumps(doc)))
    return {k:v for k,v in doc.items() if k!="rows"}|{"sample":rows[:3]}


def get(c,table,key,value):
    # Both identifiers are internal constants.
    row=c.execute(f"select document from {table} where {key}=?",(value,)).fetchone()
    if not row:raise HTTPException(404,"Resource not in this project")
    return json.loads(row[0])


class Body(BaseModel):model_config=ConfigDict(extra="forbid")
class Upload(Body):
    name:str=Field(max_length=180);content:str=Field(max_length=2_666_672);sheet:str|None=None
    text_mode:str|None=None;delimiter:str|None=None;widths:list[int]|None=None
class Remote(Body):server:str;tool:str
class RunInput(Body):id:str;version:int=Field(ge=1);key:str=Field(min_length=8,max_length=128)
class Decision(Body):artifact_hash:str;choice:str=Field(pattern="^(approve|reject)$")
class Brief(Body):
    prompt:str=Field(min_length=1,max_length=20000)
    choice:str=Field(pattern="^(optimized|edited|original)$")


class NewDefinition(Body):
    kind:str=Field(pattern="^(agent|skill)$");name:str=Field(min_length=2,max_length=80)
    instructions:str=Field(min_length=12,max_length=12000)
    policy:str=Field(default="require_evidence",pattern="^(require_evidence|block_exceptions|controller_review)$")
    profile:str|None=None


@router.get("/definitions")
def find_definitions(kind:str="agent",q:str="",auth=Depends(scope)):
    if kind not in ("agent","skill") or len(q)>120:raise HTTPException(422,"Invalid search")
    with store(auth[0]) as c:return definitions.lookup(c,kind,q)


@router.post("/definitions")
def new_definition(q:NewDefinition,auth=Depends(scope)):
    write_scope(auth)
    if q.profile and (q.kind!="agent" or q.profile not in PORTS):raise HTTPException(422,"Invalid execution profile")
    with store(auth[0]) as c:return definitions.create(c,q.kind,q.name.strip(),q.instructions.strip(),q.policy,q.profile)


@router.post("/confirmed-draft")
def confirmed(q:Brief,auth=Depends(scope)):
    from .planner import propose
    write_scope(auth)
    started=time.monotonic()
    try:selection,route=propose(q.prompt)
    except ValueError as exc:raise HTTPException(422,str(exc)) from exc
    except Exception as exc:raise HTTPException(503,"Planning provider unavailable; nothing saved or run") from exc
    dag=template(selection.template,auth)
    brief={"message_id":str(uuid4()),"confirmed_at":datetime.now(timezone.utc).isoformat(),"prompt":q.prompt,"choice":q.choice}
    route=route|{"latency_ms":round((time.monotonic()-started)*1000),"template":selection.template}
    with store(auth[0]) as c:
        c.execute("insert into briefs values(?,?,?)",(brief["message_id"],auth[1],json.dumps(brief)))
        c.execute("insert into plan_receipts values(?,?)",(brief["message_id"],json.dumps(route)))
    return {"dag":dag|{"origin":"confirmed_chat","brief":brief},"routing":route,"rationale":selection.rationale}


@router.get("/catalog")
def catalog(auth=Depends(scope)):
    return {"profiles":PORTS,"templates":TEMPLATES,"role":auth[2],"mode":"simulation_only",
            "remote_sources":list(MCPGateway(auth[0]).servers)}


@router.get("/tools/{server}")
async def tools(server:str,auth=Depends(scope)):
    try:return await MCPGateway(auth[0]).discover(server)
    except ValueError as exc:raise HTTPException(403,str(exc)) from exc


@router.post("/remote-snapshot")
async def remote(q:Remote,auth=Depends(scope)):
    write_scope(auth)
    try:text=await MCPGateway(auth[0]).read(q.server,q.tool)
    except ValueError as exc:raise HTTPException(403,str(exc)) from exc
    return upload(Upload(name="read.csv",content=base64.b64encode(text.encode()).decode()),auth)


@router.post("/sources")
def upload(q:Upload,auth=Depends(scope)):
    write_scope(auth)
    p=isolated(q.model_dump()|{"operation":"parse"})
    with store(auth[0]) as c:
        return [save_source(c,p,k) for k in ([q.sheet] if q.sheet else p["sheets"])]


@router.get("/sources/{sid}")
def sample(sid:str,offset:int=0,limit:int=20,auth=Depends(scope)):
    if offset<0 or not 1<=limit<=100:raise HTTPException(422,"Invalid page")
    with store(auth[0]) as c:d=get(c,"snapshots","id",sid)
    return {k:v for k,v in d.items() if k!="rows"}|{"rows":d["rows"][offset:offset+limit]}


@router.post("/template/{name}")
def template(name:str,auth=Depends(scope)):
    write_scope(auth)
    if name not in TEMPLATES:raise HTTPException(404,"Unknown template")
    agent=TEMPLATES[name]; nodes=[];edges=[]
    with store(auth[0]) as c:
        for i,port in enumerate(PORTS[agent]):
            rows=[{"reference":r,"amount":a,"currency":"CAD"} for r,a in SAMPLE[port]]
            sid=save_source(c,{"sheets":{port:rows}},port)["id"]
            nodes.append({"id":port,"kind":"source","resource_id":port,"snapshot_id":sid,"label":f"Synthetic {port}","position":{"x":10,"y":i*90}})
            edges.append({"source":port,"target":"calculate","source_port":"rows","target_port":port})
    nodes+=[{"id":"calculate","kind":"agent","agent_id":agent,"agent_version":1,"position":{"x":250,"y":60}},
            {"id":"approve","kind":"approval","required_role":"controller","action":"review","position":{"x":500,"y":60}}]
    edges.append({"source":"calculate","target":"approve","source_port":OUTPUT[agent],"target_port":"proposal"})
    return {"id":"flow_"+uuid4().hex[:14],"version":1,"origin":"template","name":name+" simulation","nodes":nodes,"edges":edges}


def preflight(c,dag):
    nodes={n.id:n for n in dag.nodes}; active=False
    defs={d["ref"]:d for d in definitions.all_defs(c)}
    refs={k:v["kind"] for k,v in defs.items()}
    for n in dag.nodes:
        ins=[e for e in dag.edges if e.target==n.id]
        if n.kind=="source":
            d=get(c,"snapshots","id",n.snapshot_id)
            if not {"reference","amount","currency"}<=set(d["columns"]):raise HTTPException(422,"Source lacks reference, amount or currency")
        elif n.kind=="agent":
            if (n.definition_ref and refs.get(n.definition_ref)!="agent") or any(refs.get(s)!="skill" for s in n.skill_refs) or len(set(n.skill_refs))!=len(n.skill_refs):
                raise HTTPException(422,"Unknown, duplicate, changed or out-of-project definition reference")
            if n.definition_ref and defs[n.definition_ref].get("profile") not in (None,n.agent_id):
                raise HTTPException(422,"Agent definition is pinned to a different execution profile")
            if n.agent_id not in PORTS or n.agent_version!=1:raise HTTPException(422,"Unsupported deterministic adapter or version")
            if set(PORTS[n.agent_id])!={e.target_port for e in ins} or any(nodes[e.source].kind!="source" or e.source_port!="rows" for e in ins):
                raise HTTPException(422,"Map each required table input to a pinned source")
            active=True
        elif n.kind=="router":
            if n.field!="exceptions" or len(ins)!=1 or nodes[ins[0].source].kind!="agent" or ins[0].source_port!=OUTPUT[nodes[ins[0].source].agent_id]:
                raise HTTPException(422,"Router must compare a verified exception count")
        else:
            if n.required_role!="controller" or not ins or any(nodes[e.source].kind not in ("router","agent") for e in ins):raise HTTPException(422,"Invalid approval wiring")
            for e in ins:
                src=nodes[e.source]
                if src.kind=="agent" and e.source_port!=OUTPUT[src.agent_id]:raise HTTPException(422,"Invalid result port")
    if not active:raise HTTPException(422,"An executable profile is required")


@router.post("/drafts")
def save(dag:WorkflowDAG,auth=Depends(scope)):
    write_scope(auth)
    with store(auth[0]) as c:
        if dag.brief:
            pinned=c.execute("select actor,document from briefs where id=?",(dag.brief.message_id,)).fetchone()
            if not pinned or pinned["actor"]!=auth[1] or type(dag.brief).model_validate_json(pinned["document"])!=dag.brief:
                raise HTTPException(403,"Unverified brief confirmation")
        preflight(c,dag)
        try:c.execute("insert into drafts values(?,?,?)",(dag.id,dag.version,dag.model_dump_json()))
        except sqlite3.IntegrityError as exc:raise HTTPException(409,"Version already exists") from exc
    return {"id":dag.id,"version":dag.version,"executed":False}


@router.get("/drafts")
def drafts(auth=Depends(scope)):
    with store(auth[0]) as c:return [json.loads(r[0]) for r in c.execute("select document from drafts order by rowid desc limit 50")]


def emit(c,rid,status,node,detail):
    event={"status":status,"node":node,"detail":detail,"at":datetime.now(timezone.utc).isoformat()}
    seq=c.execute("insert into events(run_id,document) values(?,?)",(rid,json.dumps(event))).lastrowid
    return {"seq":seq,**event}


@router.post("/simulate")
def simulate(q:RunInput,auth=Depends(scope)):
    return execute(q,auth)


@router.post("/simulate-stream")
def sim_stream(q:RunInput,auth=Depends(scope)):
    write_scope(auth); events=queue.Queue()
    def work():
        try:events.put(("result",execute(q,auth,lambda item:events.put(("trace",item)))))
        except HTTPException as exc:events.put(("error",{"error":exc.detail}))
        except Exception:events.put(("error",{"error":"Simulation failed"}))
    def stream():
        t=Thread(target=work,daemon=True);t.start()
        while True:
            try:kind,item=events.get(timeout=5)
            except queue.Empty:yield ": heartbeat\n\n";continue
            yield f"event: {kind}\ndata: {json.dumps(item)}\n\n"
            if kind!="trace":break
    return StreamingResponse(stream(),media_type="text/event-stream",headers={"cache-control":"no-store","x-accel-buffering":"no"})


def execute(q,auth,notify=None):
    write_scope(auth); project,actor,_=auth
    with store(project) as c:
        fp=digest([actor,q.id,q.version])
        old=c.execute("select * from runs where request_key=?",(q.key,)).fetchone()
        if old:
            if old["fingerprint"]!=fp:raise HTTPException(409,"Idempotency key used for another request")
            return dict(old)|{"document":json.loads(old["document"])}
        row=c.execute("select document from drafts where id=? and version=?",(q.id,q.version)).fetchone()
        if not row:raise HTTPException(404,"Pinned version not found")
        dag=WorkflowDAG.model_validate_json(row[0]);preflight(c,dag)
        rid=str(uuid4()); results={}; values={}; required=False; error=None
        def mark(status,node,detail):
            event=emit(c,rid,status,node,detail)
            if notify:notify(event)
        if dag.brief:
            receipt=get(c,"plan_receipts","brief_id",dag.brief.message_id)
            mark("brief_confirmed","planner",receipt)
        nodes={n.id:n for n in dag.nodes}
        graph={n.id:[e.source for e in dag.edges if e.target==n.id] for n in dag.nodes}
        for key in TopologicalSorter(graph).static_order():
            n=nodes[key];ins=[e for e in dag.edges if e.target==key]
            if n.kind=="source":
                values[key]=get(c,"snapshots","id",n.snapshot_id)
                mark("source_pinned",key,{"snapshot":n.snapshot_id});continue
            if any(nodes[e.source].kind=="router" and values[e.source]!=e.source_port for e in ins):
                mark("skipped",key,{});continue
            if n.kind=="agent":
                try:
                    started=time.monotonic()
                    mark("running_deterministic_tool",key,{"profile":n.agent_id,"version":n.agent_version,"tool":"isolated_sqlite"})
                    args={"profile":n.agent_id,"inputs":{e.target_port:values[e.source] for e in ins}}
                    v=isolated({"operation":"calculate",**args})
                    v["critic"]=isolated({"operation":"verify",**args,"result":v})
                    policies={d["ref"]:d.get("policy","reference") for d in definitions.all_defs(c)
                              if d["ref"] in [n.definition_ref,*n.skill_refs]}
                    if "block_exceptions" in policies.values() and v["exceptions"]:
                        raise HTTPException(422,"Pinned definition blocks unresolved exceptions")
                    v["definition_policies"]=policies
                except HTTPException as exc:
                    error=str(exc.detail);mark("failed",key,{"error":error});break
                v["design_references"]={"agent":n.definition_ref,"skills":n.skill_refs}
                values[key]=results[key]=v
                # Absolute policy: every simulated result is a draft requiring independent approval.
                # A missing approval node or false branch can never waive this.
                required=True;mark("verified",key,{"result_hash":v["result_hash"],"verifier":v["critic"]["profile"],"latency_ms":round((time.monotonic()-started)*1000),"model":None,"usage":None})
            elif n.kind=="router":
                x=values[ins[0].source]["exceptions"];t=n.threshold
                values[key]="true" if {"eq":x==t,"lt":x<t,"lte":x<=t,"gt":x>t,"gte":x>=t}[n.operator] else "false"
                mark("routed",key,{"branch":values[key]})
            else:
                required=True;mark("approval_required",key,{"action":n.action})
        doc={"workflow":dag.id,"version":dag.version,"results":results,"error":error,"write_back":False}
        status="failed" if error else "awaiting_hitl" if required else "completed";sha=digest(doc)
        c.execute("insert into runs values(?,?,?,?,?,?,?)",(rid,q.key,fp,actor,status,sha,json.dumps(doc)))
        mark(status,"run",{"artifact_hash":sha})
        return {"id":rid,"status":status,"artifact_hash":sha,"document":doc}


@router.post("/runs/{rid}/decision")
def decision(rid:str,q:Decision,auth=Depends(scope)):
    with store(auth[0]) as c:
        row=c.execute("select * from runs where id=?",(rid,)).fetchone()
        if not row:raise HTTPException(404,"Unknown run")
        if auth[2]!="controller" or row["actor"]==auth[1]:raise HTTPException(403,"Independent controller required")
        if row["artifact_hash"]!=q.artifact_hash or row["status"]!="awaiting_hitl":raise HTTPException(409,"Stale decision")
        status="completed" if q.choice=="approve" else "rejected"
        c.execute("update runs set status=? where id=?",(status,rid))
        emit(c,rid,status,"controller",{"actor":auth[1],"artifact_hash":q.artifact_hash,"posted":False})
        return {"status":status,"posted":False}


@router.get("/runs")
def runs(auth=Depends(scope)):
    with store(auth[0]) as c:return [dict(r)|{"document":json.loads(r["document"])} for r in c.execute("select id,status,actor,artifact_hash,document from runs order by rowid desc limit 20")]


@router.get("/runs/{rid}/trace")
def trace(rid:str,request:Request,after:int=0,auth=Depends(scope)):
    try:cursor=max(after,int(request.headers.get("last-event-id","0")))
    except ValueError:raise HTTPException(422,"Invalid cursor")
    with store(auth[0]) as c:
        if not c.execute("select 1 from runs where id=?",(rid,)).fetchone():raise HTTPException(404,"Unknown run")
        rows=list(c.execute("select seq,document from events where run_id=? and seq>? order by seq",(rid,cursor)))
    return StreamingResponse(iter([f"id: {s}\ndata: {d}\n\n" for s,d in rows]),media_type="text/event-stream")
