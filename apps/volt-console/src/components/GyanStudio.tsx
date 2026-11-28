import {useEffect, useRef, useState} from "react";
import {FinanceArchitecture} from "./FinanceArchitecture";

type Result={exceptions?:number;critic?:{verified?:boolean};lines?:{reference:string;currency:string;status:string;difference_cents:number;evidence:string[]}[]};
type Run = {id:string; status:string; artifact_hash:string; document:{error?:string;results?:Record<string,Result>}};
type Version = {id:string; version:number};

export function GyanStudio({project,back}:{project:string;back:()=>void}) {
  const [view,setView]=useState<"Architecture"|"Simulations">("Architecture");
  return <section className="stack gyan" aria-label="Gyan Agents">
    <header><button className="btn sm" onClick={back}>Back to Workflows</button>
      <h1 className="page-title">Gyan Agents</h1><p className="page-sub">Follow a finance decision from source records to controller review.</p></header>
    <div className="row gyan-wrap">{(["Architecture","Simulations"] as const).map(v=><button key={v} className="btn" aria-pressed={view===v} onClick={()=>setView(v)}>{v}</button>)}</div>
    {view==="Architecture"?<FinanceArchitecture/>:<Simulations key={project} project={project}/>}
  </section>;
}

function Simulations({project}:{project:string}) {
  const [role,setRole]=useState(""),[status,setStatus]=useState("Checking simulation runtime…");
  const [scenario,select]=useState("match"),[runs,setRuns]=useState<Run[]>([]),[current,show]=useState<Run>();
  const [busy,setBusy]=useState(false), lock=useRef(false);
  const pending=useRef<{version:Version;key:string} | null>(null);
  async function api<T,>(path:string,body?:unknown):Promise<T> {
    const r=await fetch(`/api/gyan/${path}`,{method:body===undefined?"GET":"POST",headers:{"content-type":"application/json","x-volt-project":project},body:body===undefined?undefined:JSON.stringify(body)});
    const data=await r.json();if(!r.ok)throw Error(typeof data.detail==="string"?data.detail:data.error||"Request failed");return data;
  }
  useEffect(()=>{let active=true;(async()=>{
    try {const c=await api<{role:string}>("catalog"),list=await api<Run[]>("runs");
      if(active){setRole(c.role);setRuns(list);setStatus("Connected · synthetic records only");}}
    catch(e){if(active)setStatus(e instanceof Error?e.message:"Runtime unavailable");}
  })();return()=>{active=false};},[project]);
  async function act(work:()=>Promise<void>){if(lock.current)return;lock.current=true;setBusy(true);try{await work()}catch(e){setStatus(e instanceof Error?e.message:"Request failed")}finally{setBusy(false);lock.current=false}}
  async function simulate(){
    setStatus("Running synthetic simulation…");
    if(!pending.current){const version=await api<Version>(`template/${scenario}`,{});await api("drafts",version);pending.current={version,key:crypto.randomUUID()};}
    const {version,key}=pending.current;
    const r=await api<Run>("simulate",{id:version.id,version:version.version,key});pending.current=null;
    setRuns(old=>[r,...old.filter(x=>x.id!==r.id)]);show(r);setStatus("Simulation returned. No journal or payment was posted.");
  }
  async function decide(choice:string){
    if(!current)return;
    const result=await api<{status:string}>(`runs/${current.id}/decision`,{choice,artifact_hash:current.artifact_hash});
    const updated={...current,status:result.status};show(updated);setRuns(old=>old.map(x=>x.id===updated.id?updated:x));setStatus("Controller decision recorded. No posting.");
  }
  return <div className="stack"><h2>Synthetic simulations</h2><p>Choose a prepared case. The runtime pins the source records, calculates the result and independently checks it.</p>
    <div className="row gyan-wrap"><label>Finance case <select value={scenario} disabled={busy} onChange={e=>{select(e.target.value);pending.current=null}}><option value="match">Three-way match</option><option value="close">Bank reconciliation</option><option value="variance">Actual vs budget</option></select></label>
    <button className="btn primary" disabled={busy||!["designer","controller"].includes(role)} onClick={()=>void act(simulate)}>Run synthetic simulation</button></div>
    <p role="status">{status}</p>
    {!role&&<p>Architecture walkthroughs do not need a runtime. To run simulations locally, start <code>python3 apps/gyan-agents/scripts/local-studio.py</code> and open the local VOLT address.</p>}
    {runs.length>0&&<div className="stack"><h3>Project runs</h3>{runs.map(r=><button className="btn" disabled={busy} key={r.id} onClick={()=>show(r)}>{r.id.slice(0,8)} · {r.status}</button>)}</div>}
    {current&&<article className="card stack"><h3>Simulation result · {current.status}</h3>
    {current.document.error&&<p role="alert">{current.document.error}</p>}
    {Object.entries(current.document.results||{}).filter(([,v])=>Array.isArray(v?.lines)).map(([id,v])=><section key={id}><p>{v.exceptions} exceptions · {v.critic?.verified?"Independently verified":"Not verified"}</p>
      <div className="gyan-table"><table><caption>Source comparison · differences in minor currency units</caption><thead><tr>{["Reference","Status","Currency","Difference","Source rows"].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{v.lines!.map((l,i)=><tr key={i}><td>{l.reference}</td><td>{l.status}</td><td>{l.currency}</td><td>{l.difference_cents}</td><td><details><summary>{l.evidence.length} references</summary>{l.evidence.map(e=><code key={e}>{e}</code>)}</details></td></tr>)}</tbody></table></div></section>)}
    <details><summary>Full simulation record</summary><pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{JSON.stringify(current.document,null,2)}</pre></details>
    {role==="controller"&&current.status==="awaiting_hitl"&&["approve","reject"].map(choice=><button className="btn" disabled={busy} key={choice} onClick={()=>void act(()=>decide(choice))}>{choice} simulation</button>)}</article>}
  </div>;
}
