import {validateSpec} from "./diagram.js";

// Source values mirror the synthetic template rows in gyan_agents/studio.py.
// These are illustrative captions, not an execution engine or live results.
export const financeStories = {
  r2r_reconciler:{
    title:"Bank reconciliation",ref:"B",records:{bank:"CAD 8.75",cashGL:"No row for B"},
    chapters:["Cash control asks why deposit B is not in the ledger. The bank statement shows CAD 8.75; the cash ledger has no row with reference B.",
      "Pin both extracts, including the ledger searched. A missing row is not a zero-dollar ledger entry.",
      "Compare reference and currency. A second reference, A, matches at CAD 10.00 on both sides; B remains bank-only.",
      "The verifier repeats the search for B. It can confirm the missing reference, not whether timing or an omission caused it.",
      "The cash controller assigns B for investigation against the next ledger extract. Do not invent an offset or post a journal."],
  },
  fpa_variance_flux:{
    title:"Actual vs budget",ref:"sales",records:{actual:"CAD 250.00",budget:"CAD 210.00"},
    chapters:["FP&A needs to explain the sales line before the forecast meeting. The actuals extract shows CAD 250.00 against a CAD 210.00 budget.",
      "Pin the actual and budget rows for reference sales. Both are CAD; neither row contains price or volume drivers.",
      "Compare actual less budget for sales. The illustrative variance is CAD 40.00 above budget.",
      "The verifier can reproduce the difference. It cannot attribute that difference to price or volume without more evidence.",
      "The planning owner requests the price and volume split before changing the forecast. A favorable variance alone is not a forecast revision."],
  },
  p2p_ap_3way_match:{
    title:"Three-way match",ref:"PO-1",records:{invoice:"CAD 105.00",purchaseOrder:"CAD 100.00",receipt:"CAD 100.00"},
    chapters:["Accounts payable must decide what to do with invoice PO-1. The supplier billed CAD 105.00; the order and receipt each show CAD 100.00.",
      "Pin the invoice, order and receipt under PO-1 in CAD. A later amendment must not silently change what the reviewer sees.",
      "Match all three records. The invoice is CAD 5.00 above the order; a receipt on file does not authorize the extra charge.",
      "Independently reperform the comparison. The mismatch is verified, but its cause is not: no approved price amendment is in these records.",
      "AP asks purchasing for an approved amendment or the supplier for a corrected invoice. Reviewing this simulation does not release payment."],
  }
} as const;
export type FinanceProfile=keyof typeof financeStories;

export function financeDiagram(profile:FinanceProfile){
  const s=financeStories[profile];
  const path=["records>snapshot","snapshot>tool","tool>verify","verify>owner","owner>action"];
  const payload={synthetic:true,reference:s.ref,...s.records};
  return validateSpec({title:`${s.title} · synthetic business case`,
    nodes:[["records","knowledge","Source records"],["snapshot","memory","Pinned evidence"],["tool","tool","Finance calculation"],["verify","guardrail","Independent check"],["owner","human","Decision owner"],["action","output","Next action"],["hold","output","Stop review"]].map(([id,type,label])=>({id,type,label})),
    edges:[...path,"verify>hold"].map((p,i)=>({from:p.split(">")[0],to:p.split(">")[1],kind:i===5?"error":"request"})),
    scenarios:[{name:"Trace the business decision",steps:path.map((edge,i)=>({edge,note:s.chapters[i],payload:i===0?payload:{synthetic:true,reference:s.ref}}))},
      {name:"Missing evidence · stop",steps:[{edge:path[0],note:s.chapters[0],payload},{edge:path[1],note:`The source row for ${s.ref} cannot be traced to a pinned extract.`,payload:{synthetic:true,reference:s.ref,sourceRow:null}},{edge:path[2],note:"Send the incomplete finding to the independent evidence check."},{edge:"verify>hold",note:"Stop before controller review. The source owner must restore the row and rerun verification; no financial action is authorized."}]}]});
}
