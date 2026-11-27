import {useEffect,useRef,useState} from "react";
import {ReactFlow,Background,Controls,MarkerType,Position,type Connection} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {Diagrams,diagramHtml} from "./Diagrams";
import {validateSpec} from "../../shared/diagram";
import {downloadText} from "../download";

type Kind="source"|"agent"|"router"|"approval";
type Step={id:string;kind:Kind;label?:string;position?:{x:number;y:number};resource_id?:string;snapshot_id?:string;agent_id?:string;agent_version?:number;definition_ref?:string;skill_refs?:string[];required_role?:string;action?:string;field?:string;operator?:string;threshold?:number};
type Link={source:string;target:string;source_port:string;target_port:string};
type Dag={id:string;version:number;name:string;origin:string;nodes:Step[];edges:Link[];brief?:unknown};
type Definition={ref:string;kind:"agent"|"skill";name:string;origin:string;profile?:string};
type Run={id:string;status:string;artifact_hash:string;document:unknown};
type Source={id:string;sheet:string;columns:string[];count:number};
type Role="designer"|"reader"|"controller";
const uid=()=>crypto.randomUUID().replaceAll("-","").slice(0,14);
const blank=():Dag=>({id:`flow_${uid()}`,version:1,name:"Untitled workflow",origin:"manual",nodes:[],edges:[]});
const ports:Record<string,string[]>={r2r_reconciler:["bank","gl"],fpa_variance_flux:["actual","budget"],p2p_ap_3way_match:["invoice","po","receipt"]};
const outputs:Record<string,string>={r2r_reconciler:"bank_gl_matches",fpa_variance_flux:"variances",p2p_ap_3way_match:"line_matches"};
const captions:Record<Kind,string>={source:"Source",agent:"Finance agent",router:"Branch",approval:"Human approval"};
const colors:Record<Kind,string>={source:"#76b7d4",agent:"#74d4bc",router:"#d7b56f",approval:"#c79cdf"};
function illustrative():Dag{
  const id=blank();return {...id,name:"Bank reconciliation",nodes:[{id:"bank",kind:"source",label:"Bank statement",resource_id:"bank",position:{x:0,y:0}},{id:"gl",kind:"source",label:"Ledger cash",resource_id:"gl",position:{x:0,y:110}},{id:"calc",kind:"agent",agent_id:"r2r_reconciler",agent_version:1,label:"Reconcile",position:{x:230,y:55}},{id:"hold",kind:"approval",label:"Controller review",required_role:"controller",action:"review",position:{x:460,y:55}}],edges:[{source:"bank",target:"calc",source_port:"rows",target_port:"bank"},{source:"gl",target:"calc",source_port:"rows",target_port:"gl"},{source:"calc",target:"hold",source_port:"bank_gl_matches",target_port:"proposal"}]};
}
function storyboard(d:Dag){
  const t={source:"knowledge",agent:"agent",router:"router",approval:"human"} as const;
  const seen=new Set<string>();
  const edges=d.edges.filter(e=>{const k=e.source+">"+e.target;if(seen.has(k))return false;seen.add(k);return true;});
  return validateSpec({title:d.name,nodes:d.nodes.map(n=>({id:n.id,label:n.label||captions[n.kind],type:t[n.kind],sub:n.kind,detail:n.agent_id||n.resource_id||n.required_role||"Verified branch"})),edges:edges.map(e=>({from:e.source,to:e.target,label:e.target_port,kind:"request"})),
    scenarios:edges.length?[{name:"Design walkthrough (not execution)",steps:edges.map(e=>({edge:`${e.source}>${e.target}`,note:`${e.source_port} → ${e.target_port}`}))}]:[]});
}

export function GyanStudio({project,back}:{project:string;back:()=>void}){
  const [dag,setDag]=useState<Dag>(illustrative),[selected,select]=useState("calc"),[tab,setTab]=useState("Design");
  const [status,setStatus]=useState("Checking runtime…"),[role,setRole]=useState<Role>(),[busy,setBusy]=useState(false);
  const [from,setFrom]=useState(""),[to,setTo]=useState(""),[port,setPort]=useState(""),[branch,setBranch]=useState("true");
  const [brief,setBrief]=useState(""),[review,setReview]=useState<string|null>(null),[original,setOriginal]=useState(false);
  const [saved,setSaved]=useState(false),[versions,setVersions]=useState<Dag[]>([]),[runs,setRuns]=useState<Run[]>([]),[last,setLast]=useState<Run>();
  const [trace,setTrace]=useState(""),[sources,setSources]=useState<Source[]>([]),[html,setHtml]=useState("");
  const [knowledge,setKnowledge]=useState<{id:string;name:string}[]>([]);
  const [kind,setKind]=useState<"agent"|"skill">("agent"),[name,setName]=useState(""),[instructions,setInstructions]=useState(""),[matches,setMatches]=useState<Definition[]>([]);
  const [policy,setPolicy]=useState("require_evidence");
  const key=useRef(uid()), locked=useRef(false);const node=dag.nodes.find(n=>n.id===selected);
  const writable=role==="designer"||role==="controller";
  async function api<T,>(path:string,body?:unknown):Promise<T>{
    const res=await fetch(`/api/gyan/${path}`,{method:body===undefined?"GET":"POST",headers:{"content-type":"application/json","x-volt-project":project},body:body===undefined?undefined:JSON.stringify(body)});
    const data=await res.json();if(!res.ok)throw Error(typeof data.detail==="string"?data.detail:data.error||"Request rejected by Studio policy");return data;
  }
  useEffect(()=>{let active=true;api<{role:Role}>("catalog").then(c=>{if(active){setRole(c.role);setStatus("Connected · simulation only")}}).catch(e=>{if(active)setStatus(e.message)});return()=>{active=false}},[project]);
  useEffect(()=>{if(tab!=="Creator"||!role)return;let active=true;const timer=setTimeout(()=>{api<Definition[]>(`definitions?kind=${kind}&q=${encodeURIComponent(name)}`).then(r=>{if(active)setMatches(r)}).catch(e=>{if(active)setStatus(e.message)})},150);return()=>{active=false;clearTimeout(timer)}},[role,tab,name,kind]);
  async function act(f:()=>Promise<void>){if(locked.current)return;locked.current=true;setBusy(true);try{await f()}catch(e){setStatus(e instanceof Error?e.message:"Operation failed")}finally{locked.current=false;setBusy(false)}}
  function change(d:Dag){setDag(saved&&d.id===dag.id&&d.version===dag.version?{...d,version:d.version+1}:d);setSaved(false);setHtml("");setLast(undefined);key.current=uid()}
  function patch(p:Partial<Step>){change({...dag,nodes:dag.nodes.map(n=>n.id===selected?{...n,...p}:n)})}
  function add(k:Kind){const id=k+"_"+uid().slice(0,6);const extra=k==="agent"?{agent_id:"r2r_reconciler",agent_version:1}:k==="source"?{resource_id:id}:k==="approval"?{required_role:"controller",action:"review"}:{field:"exceptions",operator:"gt",threshold:0};
    change({...dag,nodes:[...dag.nodes,{id,kind:k,label:captions[k],position:{x:40+(dag.nodes.length%3)*210,y:80+Math.floor(dag.nodes.length/3)*100},...extra}]});select(id)}
  function connect(a:string,b:string,p?:string){
    const s=dag.nodes.find(n=>n.id===a),t=dag.nodes.find(n=>n.id===b);if(!s||!t||a===b||t.kind==="source"){setStatus("Choose two different compatible steps.");return}
    const target=p||(t.kind==="agent"?ports[t.agent_id!].find(x=>!dag.edges.some(e=>e.target===b&&e.target_port===x)):"proposal");
    if(!target||dag.edges.some(e=>e.target===b&&e.target_port===target)){setStatus("That input is already connected.");return}
    change({...dag,edges:[...dag.edges,{source:a,target:b,source_port:s.kind==="source"?"rows":s.kind==="router"?branch:outputs[s.agent_id!]||"proposal",target_port:target}]});
  }
  function attach(d:Definition){if(node?.kind!=="agent"){setStatus("Select a finance agent on the canvas first.");return}
    patch(d.kind==="agent"?{definition_ref:d.ref,agent_id:d.profile||node.agent_id}:{skill_refs:[...new Set([...(node.skill_refs||[]),d.ref])]});setStatus(`Referenced ${d.name}; no copy created.`)}
  async function loadRun(r:Run){setLast(r);const response=await fetch(`/api/gyan/runs/${r.id}/trace`,{headers:{"x-volt-project":project}});if(!response.ok)throw Error("Trace not available");setTrace(await response.text())}
  async function simulate(){
    const response=await fetch("/api/gyan/simulate-stream",{method:"POST",headers:{"x-volt-project":project,"content-type":"application/json"},
      body:JSON.stringify({id:dag.id,version:dag.version,key:key.current})});
    if(!response.ok||!response.body)throw Error("Simulation unavailable");
    const reader=response.body.getReader(),decoder=new TextDecoder();let buffer="",completed=false;
    for(;;){const {value,done}=await reader.read();if(done)break;
      buffer+=decoder.decode(value,{stream:true}).replace(/\r/g,"");let at;
      while((at=buffer.indexOf("\n\n"))>=0){const frame=buffer.slice(0,at);buffer=buffer.slice(at+2);
        const payload=frame.split("\n").find(x=>x.startsWith("data: "));if(!payload)continue;const item=JSON.parse(payload.slice(6));
        if(frame.startsWith("event: error"))throw Error(item.error);
        if(frame.startsWith("event: trace"))setStatus(`${item.node}: ${item.status}`);
        if(frame.startsWith("event: result")){completed=true;await loadRun(item);setStatus(`Simulation: ${item.status}. No posting.`)}
      }}
    if(!completed)throw Error("Stream interrupted. Retry with the same run key or check Runs.");
  }
  const choose=(d:Dag)=>{change(d);select(d.nodes.find(n=>n.kind==="agent")?.id||d.nodes[0]?.id||"");setTab("Design")};
  return <section className="stack gyan" aria-label="Gyan Agents studio">
    <div><button className="btn" onClick={back}>Back to Workflows</button><h1 className="page-title">Gyan Agents</h1><p className="page-sub">Design a workflow, inspect its evidence, then decide whether to simulate. Playback never starts a run.</p></div>
    <div className="row gyan-wrap gyan-modes">{["Design","Creator","Runs","Visual library"].map(t=><button key={t} className="btn" aria-pressed={tab===t} onClick={()=>{setTab(t);if(t==="Runs"&&role)void act(async()=>{setRuns(await api<Run[]>("runs"));setVersions(await api<Dag[]>("drafts"));})}}>{t}</button>)}</div>
    <div className="muted" role="status">{status}</div>
    {tab==="Visual library"?<Diagrams/>:tab==="Runs"?<div className="stack">
      <h2>Saved versions and simulations</h2>{!versions.length&&!runs.length&&<p>No saved versions or simulations loaded for this project.</p>}
      {versions.map(d=><button className="btn" key={d.id+d.version} onClick={()=>choose({...d,version:d.version+1})}>Edit {d.name} · v{d.version}</button>)}
      {runs.map(r=><button className="btn" key={r.id} onClick={()=>void act(()=>loadRun(r))}>{r.id.slice(0,8)} · {r.status}</button>)}
    </div>:tab==="Creator"?<div className="card stack"><h2>Agent and skill creator</h2><p>Search before creating. References are version-pinned; custom instructions do not grant tools or override finance controls.</p>
      <label>Type <select aria-label="Type" value={kind} onChange={e=>{setKind(e.target.value as typeof kind);setMatches([])}}><option>agent</option><option>skill</option></select></label>
      <label>Name or search<input className="input" value={name} onChange={e=>setName(e.target.value)} maxLength={80}/></label>
      {matches.map(d=><button className="btn" key={d.ref} onClick={()=>attach(d)}>Reuse {d.name} · {d.origin}</button>)}
      <label>Instructions<textarea className="input" value={instructions} onChange={e=>setInstructions(e.target.value)} maxLength={12000}/></label>
      <label>Execution guardrail <select value={policy} onChange={e=>setPolicy(e.target.value)}><option value="require_evidence">Require verified evidence</option><option value="block_exceptions">Block unresolved exceptions</option><option value="controller_review">Require controller review</option></select></label>
      <button className="btn primary" disabled={!writable||busy||name.trim().length<2||instructions.trim().length<12} onClick={()=>void act(async()=>{const v=await api<{created:boolean;definition:Definition}>("definitions",{name:name.trim(),kind,instructions,policy,profile:kind==="agent"?node?.agent_id:undefined});setMatches([v.definition]);setStatus(v.created?"Created one project definition. Select Reuse to attach it.":"Already exists. Reuse the pinned definition shown.");})}>Create or reuse definition</button></div>:
    <>
      <div className="card stack"><div className="row gyan-wrap gyan-template-list"><button className="btn" onClick={()=>choose(blank())}>Blank canvas</button>{[["close","Bank reconciliation"],["variance","Variance pack"],["match","Three-way match"]].map(([k,v])=><button key={k} className="btn" disabled={!writable||busy} onClick={()=>void act(async()=>choose(await api<Dag>("template/"+k,{})))}>{v}</button>)}</div>
      <details><summary>Design from a prompt</summary><label>Workflow brief<textarea className="input" value={brief} onChange={e=>{setBrief(e.target.value);setReview(null)}}/></label>
        <button className="btn" disabled={!writable||busy||!brief.trim()} onClick={()=>void act(async()=>{const r=await fetch("/api/optimize",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({prompt:brief})});const x=await r.json();
          if(!r.ok||!x.optimized?.prompt){setOriginal(true);setReview(brief);setStatus("Optimization unavailable. Review the original or cancel.");}else{setOriginal(false);setReview(x.optimized.prompt)}})}>Optimize brief</button>
        {review!==null&&<><textarea className="input" aria-label="Review brief" value={review} onChange={e=>setReview(e.target.value)}/><button className="btn" disabled={busy||!review.trim()} onClick={()=>void act(async()=>{const v=await api<{dag:Dag}>("confirmed-draft",{prompt:review,choice:original?"original":"edited"});choose(v.dag);setReview(null);setStatus("Draft created. Verify source bindings before simulation.");})}>Confirm brief and draft only</button><button className="btn" onClick={()=>setReview(null)}>Cancel</button></>}</details></div>
      <label>Workflow name<input className="input" maxLength={120} value={dag.name} onChange={e=>change({...dag,name:e.target.value})}/></label>
      <div className="row gyan-wrap">{(["source","agent","router","approval"] as Kind[]).map(k=><button key={k} className="btn" onClick={()=>add(k)}>Add {captions[k]}</button>)}</div>
      <div className="gyan-canvas"><ReactFlow fitView fitViewOptions={{maxZoom:1.15,padding:.15}} colorMode="dark" nodes={dag.nodes.map(n=>({id:n.id,sourcePosition:Position.Right,targetPosition:Position.Left,position:n.position||{x:0,y:0},data:{label:<><small>{captions[n.kind]}</small><br/>{n.label||n.id}</>},style:{borderColor:colors[n.kind],background:"#080808",color:"#eee"},selected:n.id===selected}))}
        edges={dag.edges.map((e,i)=>({id:`edge${i}`,type:"smoothstep",source:e.source,target:e.target,label:e.target_port,markerEnd:{type:MarkerType.ArrowClosed}}))}
        onNodesChange={cs=>{const moves=new Map(cs.flatMap(c=>c.type==="position"&&c.position?[[c.id,c.position] as const]:[]));if(moves.size)change({...dag,nodes:dag.nodes.map(n=>moves.has(n.id)?{...n,position:moves.get(n.id)}:n)})}}
        onNodeClick={(_,n)=>select(n.id)} onConnect={(c:Connection)=>connect(c.source,c.target)} deleteKeyCode={null}><Background/><Controls/></ReactFlow></div>
      <div className="card stack"><label>Inspect step <select value={selected} onChange={e=>select(e.target.value)}><option value="">Select step</option>{dag.nodes.map(n=><option key={n.id} value={n.id}>{n.label||n.id}</option>)}</select></label>
        {node&&<><label>Step label <input className="input" value={node.label||""} onChange={e=>patch({label:e.target.value})}/></label>
          {node.kind==="agent"&&<><label>Execution profile <select value={node.agent_id} onChange={e=>patch({agent_id:e.target.value})}>{Object.keys(ports).map(x=><option key={x}>{x}</option>)}</select></label>
            <small>Design references: {[node.definition_ref,...(node.skill_refs||[])].filter(Boolean).join(", ")||"none"}</small><button className="btn" onClick={()=>setTab("Creator")}>Find or create agent / skill</button></>}
          {node.kind==="router"&&<label>Branch if exception count exceeds <input type="number" min="0" step="1" value={node.threshold??0} onChange={e=>patch({threshold:Number(e.target.value),operator:"gt"})}/></label>}
          {node.kind==="source"&&<><small>Pinned snapshot: {node.snapshot_id||"not bound"}</small>
          <button className="btn" disabled={!writable||busy} onClick={()=>void act(async()=>{const files=await api<{id:string;name:string}[]>("knowledge");setKnowledge(files);if(!files.length)setStatus("No supported files in this project’s Knowledge base.");})}>Pick from project Knowledge</button>
          {knowledge.map(f=><button className="btn" key={f.id} disabled={busy} onClick={()=>void act(async()=>{const items=await api<Source[]>("import-knowledge",{id:f.id});setSources(items);if(items.length===1)patch({snapshot_id:items[0].id});setKnowledge([])})}>{f.name}</button>)}
          <label>Import source <input type="file" accept=".csv,.tsv,.txt,.xlsx,.pdf" disabled={!writable||busy} onChange={e=>{const f=e.target.files?.[0];if(!f)return;void act(async()=>{if(f.size>2e6)throw Error("Maximum upload is 2 MB");const data=await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(",")[1]);r.onerror=reject;r.readAsDataURL(f)});
          const items=await api<Source[]>("sources",{name:f.name,content:data});setSources(items);if(items.length===1)patch({snapshot_id:items[0].id});setStatus("Source snapshot captured. Select the sheet to bind.");})}}/></label>
          {sources.length>0&&<label>Sheet <select value={node.snapshot_id||""} onChange={e=>patch({snapshot_id:e.target.value})}><option value="">Choose sheet</option>{sources.map(s=><option key={s.id} value={s.id}>{s.sheet} · {s.count} rows</option>)}</select></label>}</>}
          <button className="btn" onClick={()=>{change({...dag,nodes:dag.nodes.filter(n=>n.id!==selected),edges:dag.edges.filter(e=>e.source!==selected&&e.target!==selected)});select("")}}>Remove step from draft</button></>}
      </div>
      <details className="card"><summary>Connect steps without dragging</summary><div className="row gyan-wrap">{[[from,setFrom,"From"],[to,setTo,"To"]].map(([v,set,title])=><label key={String(title)}>{String(title)} <select value={String(v)} onChange={e=>(set as typeof setFrom)(e.target.value)}><option value="">Select</option>{dag.nodes.map(n=><option key={n.id} value={n.id}>{n.label||n.id}</option>)}</select></label>)}
      <label>Target port <input value={port} placeholder="Auto" onChange={e=>setPort(e.target.value)}/></label><label>Router output <select value={branch} onChange={e=>setBranch(e.target.value)}><option>true</option><option>false</option></select></label><button className="btn" onClick={()=>connect(from,to,port)}>Connect</button></div>
      {dag.edges.map((e,i)=><button className="btn" key={i} onClick={()=>change({...dag,edges:dag.edges.filter((_,j)=>i!==j)})}>Disconnect {e.source} → {e.target}:{e.target_port}</button>)}</details>
      <div className="row gyan-wrap"><button className="btn" disabled={!dag.nodes.length} onClick={()=>void act(async()=>{setHtml(diagramHtml(storyboard(dag)));setStatus("Design playback only. No finance operation runs.");})}>Play diagram</button>
        <button className="btn" onClick={()=>downloadText(`${dag.id}.json`,JSON.stringify(dag,null,2),"application/json")}>Export workflow JSON</button>
        <button className="btn" disabled={!html} onClick={()=>downloadText(`${dag.id}.html`,html,"text/html")}>Export diagram HTML</button>
        <button className="btn" disabled={!writable||busy||saved} onClick={()=>void act(async()=>{await api("drafts",dag);setSaved(true);setStatus(`Version ${dag.version} saved. Nothing executed.`);})}>Validate and save v{dag.version}</button>
        {saved&&<button className="btn" onClick={()=>change({...dag,version:dag.version+1})}>Edit next version</button>}
        <button className="btn primary" disabled={!writable||!saved||busy} onClick={()=>void act(simulate)}>Run simulation</button></div>
      {html&&<iframe title="Gyan design playback" srcDoc={html} sandbox="allow-scripts allow-downloads allow-modals" className="gyan-playback"/>}
    </>}
    {last&&(tab==="Design"||tab==="Runs")&&<details className="card" open><summary>Run evidence · {last.status}</summary><pre>{JSON.stringify(last.document,null,2)}</pre><details><summary>Event replay</summary><pre>{trace}</pre></details>
      {role==="controller"&&last.status==="awaiting_hitl"&&["approve","reject"].map(choice=><button className="btn" key={choice} disabled={busy} onClick={()=>void act(async()=>{const v=await api<{status:string}>(`runs/${last.id}/decision`,{choice,artifact_hash:last.artifact_hash});await loadRun({...last,status:v.status});setStatus("Controller decision recorded. No posting.");})}>{choice} simulation</button>)}</details>}
  </section>;
}
