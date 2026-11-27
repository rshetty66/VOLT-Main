import fs from "node:fs";
import path from "node:path";
import { PLUGIN_DIR } from "./catalog.js";

export interface Pattern {
  id:string; title:string; source:string; pages:string; signals:string[];
  idea:string; outline:string; exhibit:string; depth:string;
}
export function loadDeliverablePatterns(pluginDir=PLUGIN_DIR): Pattern[] {
  return JSON.parse(fs.readFileSync(path.join(pluginDir,"skills/client-deliverable-standards/references/deliverable-patterns.json"),"utf8"));
}
const normalize=(s:string)=>s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu," ").replace(/\s+/g," ").trim();
const intentPhrases:Record<string,string[]>={
  "benefits-validation":["validate these savings","prove the savings","were the savings realized","savings achieved"],
  "procurement-case":["savings case for sourcing","savings case for procurement","sourcing wave plan"],
  "options-summary":["summarize the shortlisted options for the board","board brief on the options"],
  "forecast-vintages":["why did the forecast change","compare forecast releases","compare forecast vintages"],
  "shock-assessment":["financial impact of a sudden drop","short term revenue impact"],
  "demand-outlook":["volume and fee income scenarios","volume and yield scenarios","project demand and revenues"],
};

/** Match artifact intent, not a firm name. An unrelated ask should get no template. */
export function pickPatterns(request:string,patterns:Pattern[]):Pattern[] {
  const q=` ${normalize(request)} `;
  return patterns.map(p=>{
    const terms=new Set([p.id,p.title,...p.signals,...(intentPhrases[p.id]??[])].map(normalize));
    const weights=[...terms].filter(t=>q.includes(` ${t} `)).map(t=>t.split(" ").length);
    return {p,score:weights.length?Math.max(...weights)*10+Math.min(weights.length,5):0};
  }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,2).map(x=>x.p);
}

export function deliverablePatternGuide(request:string,pluginDir=PLUGIN_DIR):string {
  if(!request.trim())return "";
  let library:Pattern[];
  try {library=loadDeliverablePatterns(pluginDir)}catch{return ""}
  const selected=pickPatterns(request,library);
  const ideas=/\b(deliverable|output|template)s?\s+(ideas|menu|catalog(?:ue)?|library|options)\b|\b(?:suggest|list|show)\s+(?:some |the |available )?(?:deliverables|templates)\b/i.test(request);
  if(!selected.length&&!ideas)return "";
  const rule="Internal reference for deliverable design, not a factual source. Adapt the structure and level of detail to the recipient, requested format, and available evidence. Do not reproduce exemplar wording, figures, logos, endorsements, or attribution in client copy. Never imply the example's results apply to the client. Calculate financial claims with authorized tools. Explicit user requirements take precedence.";
  if(ideas&&!selected.length)return `\n\n${rule}\nWhen proposing deliverable ideas, suggest a short list matched to the user's decision; the library offers:\n${library.map(p=>`- ${p.title}: ${p.idea}`).join("\n")}`;
  return `\n\n${rule}\nUse only the relevant parts; where two patterns match, make one coherent deliverable, not two reports.\n`+selected.map(p=>[
    `Pattern: ${p.title}`,`Decision: ${p.idea}`,`Storyline: ${p.outline}`,`Signature exhibit: ${p.exhibit}`,`Depth checks: ${p.depth}`,
  ].join("\n")).join("\n\n");
}
