import base64
import io
import json
from concurrent.futures import ThreadPoolExecutor

import pytest
from fastapi.testclient import TestClient
from openpyxl import Workbook
from gyan_agents import db
from gyan_agents import studio
from gyan_agents.api import create_app
from gyan_agents.studio import isolated

TOKEN="studio-test-only-"+"x"*32
def headers(project="north",actor="builder",role="designer"):
    return {"authorization":"Bearer "+TOKEN,"x-gyan-project":project,"x-gyan-actor":actor,"x-gyan-role":role}


@pytest.fixture
def client(tmp_path,monkeypatch):
    monkeypatch.setenv("GYAN_STUDIO_DIR",str(tmp_path/"studio"));monkeypatch.setenv("GYAN_INTERNAL_TOKEN",TOKEN)
    with TestClient(create_app(db.make_engine("sqlite://"))) as c:yield c


def post(c,url,data=None,head=None):
    return c.post("/studio/"+url,json=data or {},headers=head or headers())


@pytest.mark.parametrize("template,expected",[("close",1),("variance",1),("match",1)])
def test_gates(client,template,expected):
    d=post(client,"template/"+template).json()
    # Removing the designer's approval node must not change server approval policy.
    d["nodes"]=[n for n in d["nodes"] if n["kind"]!="approval"];d["edges"]=[e for e in d["edges"] if e["target"]!="approve"]
    assert post(client,"drafts",d).is_success
    assert post(client,"drafts",d).status_code==409
    req={"id":d["id"],"version":1,"key":"same-safe-key"}
    r=post(client,"simulate",req).json(); assert r["status"]=="awaiting_hitl",r
    out=r["document"]["results"]["calculate"];assert out["exceptions"]==expected and out["critic"]["verified"]
    assert all(line["evidence"] for line in out["lines"]);assert out["posted"] is False
    assert post(client,"simulate",req).json()["id"]==r["id"]
    decision={"artifact_hash":r["artifact_hash"],"choice":"approve"};url=f"runs/{r['id']}/decision"
    assert post(client,url,decision,headers(role="controller")).status_code==403
    auth=headers(actor="controller-2",role="controller")
    assert post(client,url,decision|{"artifact_hash":"bad"},auth).status_code==409
    assert post(client,url,decision,auth).json()=={"status":"completed","posted":False}
    assert post(client,url,decision,auth).status_code==409
    trace=client.get(f"/studio/runs/{r['id']}/trace",headers=headers());assert "source_pinned" in trace.text and "completed" in trace.text
    assert client.get(f"/studio/runs/{r['id']}/trace",headers=headers("other")).status_code==404


def test_files_quarantine_and_isolation(client):
    def upload(name,raw,**opts):return post(client,"sources",{"name":name,"content":base64.b64encode(raw).decode(),**opts})
    raw=b"reference,amount,currency\nR1,10.25,CAD\n"
    first=upload("bank.csv",raw).json()[0]; assert upload("bank.csv",raw).json()[0]["id"]==first["id"]
    assert client.get("/studio/sources/"+first["id"],headers=headers("other")).status_code==404
    assert client.get("/studio/sources/"+first["id"]+"?limit=101",headers=headers()).status_code==422
    assert upload("notes.txt",b"Line A\nLine B",text_mode="notes").json()[0]["count"]==2
    assert upload("fixed.txt",b"ref  amount\nA    123456",widths=[5,6]).is_success
    wb=Workbook();wb.active.append(["ref","amount"]);wb.active.append(["A",10]);w=wb.create_sheet("Other");w.append(["line"]);w.append(["B"])
    buf=io.BytesIO();wb.save(buf); assert len(upload("work.xlsx",buf.getvalue()).json())==2
    assert upload("fake.pdf",b"%PDF-foo").status_code==422
    assert upload("image.jpg",b"data").status_code==422
    assert upload("bad.csv",b"a,a\n1,2").status_code==422
    assert client.get("/studio/catalog").status_code==403
    assert post(client,"template/close",head=headers(role="reader")).status_code==403
    assert post(client,"remote-snapshot",{"server":"missing","tool":"delete"}).status_code==403


def test_creator_duplicate_and_cross_project(client):
    a={"kind":"agent","name":"Month-End Close Conductor","instructions":"Inspect all evidence before drafting."}
    assert not post(client,"definitions",a).json()["created"]
    skill=a|{"kind":"skill","name":"Insurance close check","policy":"block_exceptions"}
    rs=list(ThreadPoolExecutor(3).map(lambda _:post(client,"definitions",skill).json(),range(3)))
    assert sum(r["created"] for r in rs)==1
    assert not post(client,"definitions",skill|{"name":"INSURANCE--CLOSE CHECK"}).json()["created"]
    assert not post(client,"definitions",skill|{"name":"Another name"}).json()["created"]
    ref=rs[0]["definition"]["ref"];dag=post(client,"template/close").json()
    agent=next(n for n in dag["nodes"] if n["kind"]=="agent");agent["skill_refs"]=[ref,ref]
    assert post(client,"drafts",dag).status_code==422
    agent["skill_refs"]=[ref];assert post(client,"drafts",dag).is_success
    r=post(client,"simulate",{"id":dag["id"],"version":1,"key":"exception-policy"}).json();assert r["status"]=="failed"
    foreign=post(client,"template/close",head=headers("other")).json()
    next(n for n in foreign["nodes"] if n["kind"]=="agent")["skill_refs"]=[ref]
    assert post(client,"drafts",foreign,headers("other")).status_code==422


def test_confirmed_brief_and_bad_pins(client):
    d=post(client,"confirmed-draft",{"prompt":"Reconcile bank statements","choice":"edited"}).json()["dag"]
    assert post(client,"drafts",d).is_success
    assert client.get("/studio/runs",headers=headers()).json()==[]
    d["version"]=2;d["brief"]["prompt"]="substituted"
    assert post(client,"drafts",d).status_code==403
    d=post(client,"template/match").json(); next(n for n in d["nodes"] if n["kind"]=="agent")["agent_version"]=99
    assert post(client,"drafts",d).status_code==422


def test_critic_rejects_unsupported_figure_and_unbalanced_journal():
    inputs={p:{"id":p,"sheet":"data","rows":[{"reference":"X","currency":"CAD","amount":"10.25"}]} for p in ["bank","gl"]}
    task={"profile":"r2r_reconciler","inputs":inputs}
    result=isolated(task|{"operation":"calculate"});result["lines"][0]["difference_cents"]=99
    with pytest.raises(Exception,match="Unsupported figure"):isolated(task|{"operation":"verify","result":result})
    inputs["gl"]["rows"][0].update(journal_id="J",debit="10.25",credit="0")
    with pytest.raises(Exception,match="Unbalanced journal"):isolated(task|{"operation":"calculate"})


def assert_failed_simulation(client, dag, expected_error):
    assert post(client, "drafts", dag).is_success
    response = post(client, "simulate", {"id": dag["id"], "version": dag["version"], "key": "failure-case"})
    assert response.is_success
    run = response.json()
    assert run["status"] == "failed"
    assert expected_error in run["document"]["error"]
    assert run["document"]["results"] == {}
    assert run["document"]["write_back"] is False

    path = f"/studio/runs/{run['id']}/trace"
    trace = client.get(path, headers=headers())
    assert trace.is_success
    events = [json.loads(line[6:]) for line in trace.text.splitlines() if line.startswith("data: ")]
    assert any(e["node"] == "calculate" and e["status"] == "failed" for e in events)
    assert events[-1]["status"] == "failed"
    assert not {"verified", "approval_required", "awaiting_hitl", "completed"} & {e["status"] for e in events}

    decision = post(client, f"runs/{run['id']}/decision", {"choice": "approve", "artifact_hash": run["artifact_hash"]},
                    headers(actor="independent-controller", role="controller"))
    assert decision.status_code == 409


@pytest.mark.parametrize("credit", ["9000.00", "9999.99"], ids=["CAD-6000-over-materiality", "first-cent-over-CAD-5000-limit"])
def test_material_unbalanced_journal_fails_before_approval(client, credit):
    dag = post(client, "template/close").json()
    csv = ("reference,amount,currency,journal_id,debit,credit\n"
           "A,15000.00,CAD,J1,15000.00,0.00\n"
           f"B,-{credit},CAD,J1,0.00,{credit}\n").encode()
    uploaded = post(client, "sources", {"name": "journal.csv", "content": base64.b64encode(csv).decode()})
    assert uploaded.is_success
    next(n for n in dag["nodes"] if n["id"] == "gl")["snapshot_id"] = uploaded.json()[0]["id"]
    assert_failed_simulation(client, dag, "Unbalanced journal")


def test_correct_figure_without_source_evidence_fails_independent_verification(client, monkeypatch):
    dag = post(client, "template/close").json()
    # A material figure that matches exactly in both sources: only provenance is faulty.
    for source in ("bank", "gl"):
        raw = f"reference,amount,currency,source\nA,15000.00,CAD,{source}\n".encode()
        uploaded = post(client, "sources", {"name": f"{source}.csv", "content": base64.b64encode(raw).decode()})
        assert uploaded.is_success
        next(n for n in dag["nodes"] if n["id"] == source)["snapshot_id"] = uploaded.json()[0]["id"]

    def drop_evidence_after_calculation(task):
        # Both subprocesses are real. Only the handoff is fault-injected: preserve
        # the numbers and remove the pinned row references from one matched line.
        result = isolated(task)
        if task["operation"] == "calculate":
            line = next(r for r in result["lines"] if r["status"] == "matched")
            assert line["evidence"]
            line["evidence"] = []
        return result

    monkeypatch.setattr(studio, "isolated", drop_evidence_after_calculation)
    assert_failed_simulation(client, dag, "Unsupported figure or source reference")
