import { describe, expect, it } from "vitest";
import { moveCursor, pickerRows } from "../src/components/AgentPicker";

const agents = [
  { id: "rudra", name: "Rudra", layer: "Lead" },
  { id: "coa", name: "CoA designer", layer: "Ledger" },
  { id: "close", name: "Close lead", layer: "Close" },
  { id: "recs", name: "Reconciliations", layer: "Close" },
];

describe("agent picker", () => {
  it("lists Rudra first, then recent agents, then every agent grouped by layer", () => {
    const rows = pickerRows(agents, "", ["recs"]);
    expect(rows.map((r) => `${r.group}:${r.id}`)).toEqual([":rudra", "Recent:recs", "Ledger:coa", "Close:close", "Close:recs"]);
  });

  it("filters by name or layer as you type and hides the recent group while searching", () => {
    expect(pickerRows(agents, "close", ["recs"]).map((r) => r.id)).toEqual(["close", "recs"]);
    expect(pickerRows(agents, "coa", []).map((r) => r.id)).toEqual(["coa"]);
    expect(pickerRows(agents, "zzz", [])).toEqual([]);
  });

  it("ignores recent ids that are no longer in the catalogue", () => {
    expect(pickerRows(agents, "", ["gone"]).some((r) => r.id === "gone")).toBe(false);
  });

  it("moves with the arrow keys, Home, End and Page keys, and stays in range", () => {
    expect(moveCursor("ArrowDown", 0, 5)).toBe(1);
    expect(moveCursor("ArrowDown", 4, 5)).toBe(4);
    expect(moveCursor("ArrowUp", 0, 5)).toBe(0);
    expect(moveCursor("End", 1, 5)).toBe(4);
    expect(moveCursor("Home", 3, 5)).toBe(0);
    expect(moveCursor("PageDown", 0, 20)).toBe(8);
    expect(moveCursor("PageUp", 3, 20)).toBe(0);
    expect(moveCursor("a", 2, 5)).toBeUndefined();
    expect(moveCursor("End", 0, 0)).toBe(0);
  });
});
