"""Production-build smoke test. Uses disposable credentials, storage and loopback ports."""
import json
import os
import secrets
import subprocess
import tempfile
import time
from contextlib import ExitStack
from pathlib import Path
from urllib.request import urlopen
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[3]
web=root/"apps/volt-console"; backend=root/"apps/gyan-agents/backend"
with ExitStack() as stack:
    tmp=stack.enter_context(tempfile.TemporaryDirectory())
    secret=secrets.token_hex(32); password=secrets.token_urlsafe(24)
    env=os.environ|{"VOLT_HOST":"127.0.0.1","PORT":"8941","VOLT_MODE":"demo","VOLT_DATA_DIR":tmp+"/volt",
        "NODE_ENV":"production","VOLT_SESSION_SECRET":secrets.token_hex(32),"VOLT_AUTH_MODE":"password",
        "GYAN_INTERNAL_TOKEN":secret,"GYAN_INTERNAL_URL":"http://127.0.0.1:8942","GYAN_STUDIO_DIR":tmp+"/gyan",
        "GYAN_PROJECT_ROLES":json.dumps({"general":{"designer":"designer","reviewer":"controller"}})}
    for name in ("designer","reviewer"):
        subprocess.run(["node_modules/.bin/tsx","scripts/add-user.ts",name],cwd=web,input=password+"\n",text=True,env=env,check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    for cwd,args in ((backend,[".venv/bin/uvicorn","gyan_agents.api:create_app","--factory","--port","8942"]),
                     (web,["node_modules/.bin/tsx","server/index.ts"])):
        p=subprocess.Popen(args,cwd=cwd,env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);stack.callback(p.wait);stack.callback(p.terminate)
    for _ in range(150):
        try:urlopen("http://127.0.0.1:8941/",timeout=1);break
        except OSError:time.sleep(.1)
    with sync_playwright() as pw:
        browser=pw.chromium.launch()
        for w in (1280,390):
            page=browser.new_page(viewport={"width":w,"height":850}); errors=[]
            page.on("pageerror",lambda e:errors.append(str(e)));base="http://127.0.0.1:8941"
            assert page.request.post(base+"/api/login",data={"username":"designer","password":password}).ok
            page.goto(base);page.get_by_role("button",name="Diagrams",exact=True).click()
            page.get_by_role("heading",name="Diagram builder").wait_for()
            page.get_by_label("Business decision or process").fill("Decide whether AP should hold a disputed invoice")
            page.get_by_label("Systems in scope").fill("Coupa and SAP")
            page.get_by_label("Mandatory requirements").fill("Never release payment automatically")
            page.get_by_role("button",name="Optimize prompt").click()
            brief=page.get_by_label("Review optimized prompt")
            assert all(k in brief.input_value() for k in ("Coupa and SAP","Never release payment automatically","Assumptions"))
            assert page.get_by_role("button",name="Confirm and build diagram").is_visible()
            sent=[]
            def demo_diagram(route):
                sent.append(route.request.post_data_json["description"])
                route.fulfill(json={"spec":{"title":"Approved scope","nodes":[{"id":"a","type":"human","label":"AP owner"},{"id":"b","type":"output","label":"Review"}],"edges":[{"from":"a","to":"b"}],"groups":[],"scenarios":[{"name":"Review","steps":[{"edge":"a>b","note":"Review the invoice."}]}]},"demo":False,"model":"smoke fixture"})
            page.route("**/api/diagrams",demo_diagram)
            approved=brief.input_value()+"\nOwner: AP manager."
            brief.fill(approved)
            assert not sent
            page.get_by_role("button",name="Confirm and build diagram").click()
            page.locator('iframe[title="Approved scope"]').wait_for()
            assert sent==[approved]
            page.frame_locator("iframe").locator("#sc").wait_for()
            page.get_by_role("button",name="Workflows",exact=True).click()
            page.get_by_role("button",name="Gyan Agents",exact=False).click()
            assert page.get_by_role("button",name="Diagram builder",exact=True).count()==0
            page.get_by_role("button",name="Architecture",exact=True).click()
            page.get_by_role("heading",name="Why this workflow is agentic").wait_for()
            page.get_by_role("button",name="Next chapter").click()
            page.get_by_text("Make the comparison reproducible",exact=True).wait_for()
            page.get_by_label("Finance scenario").select_option("p2p_ap_3way_match")
            page.get_by_text("Goods receipt",exact=True).wait_for()
            page.get_by_role("button",name="Play walkthrough").click()
            page.get_by_role("button",name="Pause walkthrough").click()
            assert page.evaluate("document.documentElement.scrollWidth<=innerWidth")
            assert not page.get_by_role("button",name="Design",exact=True).count()
            assert not page.get_by_role("button",name="Creator",exact=True).count()
            page.get_by_role("button",name="Simulations",exact=True).click()
            page.get_by_label("Finance case").select_option("close")
            page.get_by_role("button",name="Run synthetic simulation",exact=True).click()
            page.get_by_text("Simulation result · awaiting_hitl").wait_for()
            page.get_by_text("Independently verified",exact=False).wait_for()
            page.get_by_role("cell",name="missing",exact=True).wait_for()
            assert page.evaluate("document.documentElement.scrollWidth<=innerWidth")
            page.screenshot(path=f"/tmp/gyan-studio-{w}.png")
            page.route("**/api/gyan/catalog",lambda route:route.fulfill(status=503,json={"error":"Runtime is not connected"}))
            page.get_by_role("button",name="Back to Workflows").click()
            page.get_by_role("button",name="Gyan Agents",exact=False).click()
            page.get_by_role("button",name="Simulations",exact=True).click()
            page.get_by_text("Runtime is not connected",exact=True).wait_for()
            assert page.get_by_role("button",name="Run synthetic simulation",exact=True).is_disabled()
            page.get_by_role("button",name="Architecture",exact=True).click()
            page.get_by_label("Finance scenario").select_option("p2p_ap_3way_match")
            assert page.get_by_label("Finance scenario").input_value()=="p2p_ap_3way_match"
            assert not errors,errors
            print(f"PASS {w}px: simulation and evidence, architecture narration, unavailable runtime, diagram brief review, retired builder, overflow")
            page.close()
        browser.close()
