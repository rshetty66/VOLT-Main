export function optimizeDiagramBrief(goal:string,systems:string,requirements:string){
  const s=systems.trim(),r=requirements.trim();
  return [
    "Business decision and context",goal.trim(),
    "\nSystems in scope",s||"Not separately specified. Use any systems named in the business context.",
    "\nMandatory requirements",r||"Apply explicit requirements in the business context. No additional client mandates supplied.",
    "\nAssumptions (not client facts)",
    ...(!s?["• Where systems are unnamed, use functional roles (source, comparison tool, decision owner); assume no vendor, live integration or write access."]:["• Named systems are in scope; interfaces and access not explicitly supplied are illustrative."]),
    "• Use clearly labeled synthetic records unless approved data is explicitly provided. Unknown control thresholds, SLAs and materiality limits remain unspecified; never invent them.",
    "• Stated requirements take precedence over assumptions. Keep unconfirmed owners and operating details labeled as assumptions.",
    "\nRequested walkthrough","Narrate the normal decision and an exception or missing-evidence path. Trace one record, show relevant source fields and units, explain why each handoff matters, and end with the accountable owner and next action. Do not post or execute."
  ].join("\n");
}
