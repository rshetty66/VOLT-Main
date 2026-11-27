/** Applies to all domains, not just finance. This is an editorial standard, not a readiness certification. */
export const CLIENT_OUTPUT = `Delivery standard for every answer and file:
Write the finished artifact the intended recipient can use without the conversation. Match the user's audience, purpose, format and length; do not turn a dataset, short answer, design or operating procedure into a consulting report. A decision brief leads with the decision, recommendation, trade-off and who acts next. A design explains how to implement it, a procedure gives the operator steps and checks, and a dataset states its grain, units and definitions. In slides, each headline states the point of the slide. Use a specific plain-text title, not an intake heading.
Keep material assumptions, limits and source attribution next to the claims they qualify. Never turn an unverified figure into a finding or delete a caveat to make the work look finished. If verification is unavailable, omit the unsupported claim or state exactly what cannot be concluded and how it affects the decision. Do not call untested work production-ready.
Keep agent activity, method logs, confidence scoring and research residue out of ordinary client deliverables. Provide working papers when explicitly requested. Format and audience take precedence over generic word, chart, exhibit or section quotas.`;

export function cleanTitle(value: string): string {
  return value.trim().replace(/^#{1,6}\s+/, "").replace(/^(\*\*|__)([\s\S]+)\1$/, "$2").trim();
}

export const wantsLongReport=(request:string)=>/\b(?:comprehensive|detailed|in[- ]depth|full[- ]length)\s+(?:assessment|business case|report)\b/i.test(request)&&!/\b(?:brief|concise|one[- ]page|slides?|deck)\b/i.test(request);

/** Do not silently strip material uncertainty. Send the artifact back for repair. */
export function editorialBlocker(text: string): string | undefined {
  if (/\[(?:verify|citation needed|insert (?:source|client name|figure)(?: here)?)\]/i.test(text))
    return "Unresolved editorial marker. Verify and cite the claim, or replace it with a clear limitation and its implication. Do not simply remove the marker.";
  if (/\b(?:compiled|derived|assembled) from recall of (?:public |press )?(?:announcements|reports|releases)\b/i.test(text))
    return "Recalled material is not a verified finding. Check the underlying documents or omit the unsupported findings and explain the limitation.";
}
