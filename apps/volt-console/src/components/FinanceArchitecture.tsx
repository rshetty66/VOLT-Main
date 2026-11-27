import {useEffect,useState} from "react";

const cases={
  r2r_reconciler:{name:"Bank reconciliation",inputs:["Bank statement","Cash GL"],job:"match bank and ledger entries by reference and currency",issue:"A deposit can be present on the statement but missing from the ledger.",output:"Matched items and cash exceptions"},
  fpa_variance_flux:{name:"Actual vs budget",inputs:["Actuals ledger","Budget extract"],job:"compare actual and budget amounts by reference and currency",issue:"A variance can be real, or one side of the comparison may be missing.",output:"Variance lines and missing references"},
  p2p_ap_3way_match:{name:"Three-way match",inputs:["AP invoice","Purchase order","Goods receipt"],job:"compare invoice, purchase order and receipt amounts by reference and currency",issue:"An invoice can disagree with the order even when the goods receipt is present.",output:"Three-way matches and differences"}
} as const;
type Profile=keyof typeof cases;

export function FinanceArchitecture({profile}:{profile?:string}){
  const [example,pick]=useState<Profile>(profile&&Object.hasOwn(cases,profile)?profile as Profile:"r2r_reconciler");
  const [stage,select]=useState(0),[playing,play]=useState(false),[audio,speak]=useState(false);
  const item=cases[example];
  const layers=[
    {label:"Source systems",type:"Finance data",icon:"01",nodes:item.inputs,title:"Start from records, not a model’s memory",story:`${item.issue} The workflow starts from ${item.inputs.join(" and ")} extracts. These are source-system roles, not connected production systems.`,handoff:"Structured rows with reference, currency and amount"},
    {label:"Evidence store",type:"Data control",icon:"02",nodes:["Pinned snapshots"],title:"Make the comparison reproducible",story:"Gyan pins a version of each input in the project’s SQLite workspace. A result points back to a particular source and row, so the controller can see exactly which records were compared.",handoff:"Snapshot IDs and row references"},
    {label:"Finance agent",type:"Orchestration",icon:"03",nodes:["Execution profile","Python / SQLite"],title:"Use an agent to coordinate, not to invent a number",story:`The approved workflow binds the inputs to a versioned finance profile. An isolated deterministic tool uses those inputs to ${item.job}. This is where the arithmetic happens; the language model does not calculate amounts.`,handoff:item.output},
    {label:"Independent critic",type:"Verification",icon:"04",nodes:["Reperform","Check provenance"],title:"Check the answer before handing it to a human",story:"A separate verifier recomputes the result from the pinned rows and checks its evidence. A failed check stops the run. A verified exception is still an exception; verification does not resolve it.",handoff:"Verified result and evidence, or a failed run"},
    {label:"Controller",type:"Accountability",icon:"05",nodes:["Review decision"],title:"Keep judgment and posting authority separate",story:"An authenticated controller, distinct from the builder, reviews the simulation artifact. Approval records a decision about that artifact. It does not clear an exception, post a journal, or update an ERP.",handoff:"Recorded decision and immutable event history"}
  ];
  const current=layers[stage];
  function jump(n:number){play(false);select(n)}
  useEffect(()=>{
    if(!playing)return;
    let active=true;const next=()=>{if(!active)return;if(stage===4)play(false);else select(stage+1)};
    const synth="speechSynthesis" in window?window.speechSynthesis:null;
    // Only opt in to installed voices. Never send narration to a remote voice service.
    const voice=audio?synth?.getVoices().find(v=>v.localService&&v.lang.startsWith("en")):undefined;
    let timer:ReturnType<typeof setTimeout>|undefined;
    if(synth&&voice){const msg=new SpeechSynthesisUtterance(current.title+". "+current.story);msg.voice=voice;msg.onend=next;msg.onerror=()=>{if(active){speak(false);play(false)}};synth.speak(msg)}
    else timer=setTimeout(next,14000);
    return()=>{active=false;clearTimeout(timer);if(voice)synth?.cancel()};
  },[playing,stage,audio,current.title,current.story]);
  const [hasVoice,setVoice]=useState(false);
  useEffect(()=>{if(!("speechSynthesis" in window))return;const s=window.speechSynthesis;const check=()=>setVoice(s.getVoices().some(v=>v.localService&&v.lang.startsWith("en")));check();s.addEventListener("voiceschanged",check);return()=>s.removeEventListener("voiceschanged",check)},[]);
  return <section className="gyan-story stack" aria-label="Finance architecture walkthrough">
    <div className="gyan-kicker">Finance architecture · narrated walkthrough</div><h2>Why this workflow is agentic</h2>
    <label>Finance scenario <select value={example} onChange={e=>{jump(0);pick(e.target.value as Profile)}}>{Object.entries(cases).map(([id,c])=><option key={id} value={id}>{c.name}</option>)}</select></label>
    <p>A script is enough to compare two amounts. The agentic workflow earns its place around that calculation: it coordinates inputs, verification, exceptions and a handoff to the person accountable for the decision. This walkthrough illustrates the design; it does not connect to a source system or start a run.</p>
    <div className="gyan-layers" aria-label="Architecture layers">{layers.map((l,i)=><button key={l.label} className="gyan-layer" aria-pressed={i===stage} onClick={()=>jump(i)}><small>{l.icon} / {l.type}</small><strong>{l.label}</strong>{l.nodes.map(n=><span key={n}>{n}</span>)}</button>)}</div>
    <article aria-live="polite" className="gyan-caption"><small>Chapter {stage+1} of 5</small><h3>{current.title}</h3><p>{current.story}</p><small>Handoff: {current.handoff}</small></article>
    <div className="row gyan-wrap"><button className="btn" disabled={!stage} onClick={()=>jump(stage-1)}>Previous chapter</button><button className="btn primary" onClick={()=>{if(!playing&&stage===4)select(0);play(!playing)}}>{playing?"Pause walkthrough":"Play walkthrough"}</button><button className="btn" disabled={stage===4} onClick={()=>jump(stage+1)}>Next chapter</button><label><input type="checkbox" checked={audio} disabled={!hasVoice} onChange={e=>speak(e.target.checked)}/> {hasVoice?"Speak narration":"Text narration · no local English voice"}</label></div>
  </section>;
}
