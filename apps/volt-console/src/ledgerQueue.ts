/** Pure helpers for the Ledger review queue: filters, confidence, and which selected items a bulk decision may touch. */
export interface Decision { decision: "approve" | "reject" | "amend"; by: string; note: string }
export interface ReviewItem {
  item_id: string;
  kind: "mapping" | "policy_gap" | "allocation_rule" | "coa_design" | "coa_decision" | "coa_mapping";
  ref_id: string;
  reason: string;
  proposal: Record<string, unknown>;
  engagement_lead: Decision | null;
  client: Decision | null;
  client_visible: boolean;
}

/** The model's confidence for an item, 0 to 1, when it gave one (mappings do). */
export function confidenceOf(i: ReviewItem): number | undefined {
  const c = Number(i.proposal.confidence);
  if (!Number.isFinite(c)) return undefined;
  return c > 1 ? Math.min(1, c / 100) : Math.max(0, c);
}

export interface QueueFilter {
  status: "open" | "all";
  kind: ReviewItem["kind"] | "";
  /** "low" keeps items under 0.7, "high" keeps 0.7 and above; items with no confidence pass only "". */
  confidence: "" | "low" | "high";
}

export const isOpen = (i: ReviewItem) => !i.engagement_lead || (i.engagement_lead.decision === "approve" && !i.client);

export function filterQueue(items: ReviewItem[], f: QueueFilter): ReviewItem[] {
  return items.filter((i) => {
    if (f.status === "open" && !isOpen(i)) return false;
    if (f.kind && i.kind !== f.kind) return false;
    if (f.confidence) {
      const c = confidenceOf(i);
      if (c === undefined || (f.confidence === "low" ? c >= 0.7 : c < 0.7)) return false;
    }
    return true;
  });
}

/**
 * The selected items a bulk decision applies to. An engagement-lead decision skips items the lead already decided;
 * a client sign-off only ever includes items the engagement lead approved, so nothing reaches the client unapproved.
 * The ledger service enforces the same rule; this keeps the console from even asking.
 */
export function bulkTargets(items: ReviewItem[], selected: Set<string>, stage: "engagement_lead" | "client"): ReviewItem[] {
  return items.filter((i) => selected.has(i.item_id) && (stage === "engagement_lead" ? !i.engagement_lead : i.engagement_lead?.decision === "approve" && !i.client));
}
