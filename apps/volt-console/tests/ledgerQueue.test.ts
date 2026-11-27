import { describe, expect, it } from "vitest";
import { bulkTargets, confidenceOf, filterQueue, type ReviewItem } from "../src/ledgerQueue";

const lead = { decision: "approve" as const, by: "user:rakesh", note: "" };
const item = (id: string, patch: Partial<ReviewItem> = {}): ReviewItem => ({ item_id: id, kind: "mapping", ref_id: "r", reason: "low_confidence", proposal: { confidence: 0.9 }, engagement_lead: null, client: null, client_visible: false, ...patch });

describe("ledger review queue", () => {
  const items = [
    item("a"),
    item("b", { proposal: { confidence: 0.4 } }),
    item("c", { engagement_lead: lead }),
    item("d", { kind: "policy_gap", proposal: {} }),
    item("e", { engagement_lead: lead, client: lead }),
    item("f", { engagement_lead: { ...lead, decision: "reject" } }),
  ];

  it("reads confidence as 0 to 1 and leaves it unset when the model gave none", () => {
    expect(confidenceOf(item("x", { proposal: { confidence: 85 } }))).toBe(0.85);
    expect(confidenceOf(items[3])).toBeUndefined();
  });

  it("filters by status, type and confidence", () => {
    expect(filterQueue(items, { status: "open", kind: "", confidence: "" }).map((i) => i.item_id)).toEqual(["a", "b", "c", "d"]);
    expect(filterQueue(items, { status: "all", kind: "policy_gap", confidence: "" }).map((i) => i.item_id)).toEqual(["d"]);
    expect(filterQueue(items, { status: "all", kind: "", confidence: "low" }).map((i) => i.item_id)).toEqual(["b"]);
  });

  it("never puts an item the engagement lead has not approved into a client sign-off", () => {
    const all = new Set(items.map((i) => i.item_id));
    expect(bulkTargets(items, all, "client").map((i) => i.item_id)).toEqual(["c"]);
    expect(bulkTargets(items, all, "engagement_lead").map((i) => i.item_id)).toEqual(["a", "b", "d"]);
  });
});
