import { describe, expect, it } from "vitest";
import { checkSpec, type BuildSpec } from "./spec";

function validSpec(): BuildSpec {
  return {
    appName: "Invoice Tracker",
    userStories: [
      { id: "US1", story: "Create an invoice", acceptance: "Invoice appears in list" },
      { id: "US2", story: "Mark invoice paid", acceptance: "Status changes to paid" },
      { id: "US3", story: "See overdue invoices", acceptance: "Overdue section lists them" },
    ],
    entities: [
      {
        name: "Invoice",
        fields: [{ name: "amount", type: "number" }],
        relationships: [],
        provenance: "proposed",
      },
    ],
    screens: [
      {
        name: "InvoiceList",
        purpose: "See all invoices",
        primaryAction: "create invoice",
        reads: ["Invoice"],
        writes: [],
      },
    ],
    primaryFlow: "From the InvoiceList screen, create an invoice",
    authModel: "none",
    gates: ["G0", "G1", "G2", "G3", "G4"],
    unknowns: [],
  };
}

describe("checkSpec", () => {
  it("passes a complete spec", () => {
    const r = checkSpec(validSpec());
    expect(r.ok).toBe(true);
    expect(r.issues).toEqual([]);
    expect(r.blockingUnknowns).toEqual([]);
    expect(r.spec?.appName).toBe("Invoice Tracker");
  });

  it("rejects specs missing required shape", () => {
    const r = checkSpec({ appName: "x" });
    expect(r.ok).toBe(false);
    expect(r.issues.length).toBeGreaterThan(0);
    expect(r.spec).toBeUndefined();
  });

  it("rejects fewer than 3 user stories", () => {
    const spec = validSpec();
    spec.userStories = spec.userStories.slice(0, 2);
    const r = checkSpec(spec);
    expect(r.ok).toBe(false);
    expect(r.issues.join("\n")).toContain("userStories");
  });

  it("fails when the primary flow names no declared screen", () => {
    const spec = validSpec();
    spec.primaryFlow = "User exports a PDF report";
    const r = checkSpec(spec);
    expect(r.ok).toBe(false);
    expect(r.issues.join("\n")).toContain("primaryFlow");
  });

  it("fails when a screen references an undeclared entity", () => {
    const spec = validSpec();
    spec.screens[0].writes = ["Client"];
    const r = checkSpec(spec);
    expect(r.ok).toBe(false);
    expect(r.issues.join("\n")).toContain('undeclared entity "Client"');
  });

  it("blocks codegen on blocking unknowns but not on non-blocking ones", () => {
    const blocked = validSpec();
    blocked.unknowns = [
      { decision: "Which bank feed?", resolvingInput: "bank name", blocking: true },
    ];
    const r1 = checkSpec(blocked);
    expect(r1.ok).toBe(false);
    expect(r1.blockingUnknowns).toHaveLength(1);

    const rideAlong = validSpec();
    rideAlong.unknowns = [
      { decision: "Preferred chart color?", resolvingInput: "hex color", blocking: false },
    ];
    const r2 = checkSpec(rideAlong);
    expect(r2.ok).toBe(true);
    expect(r2.blockingUnknowns).toEqual([]);
  });
});
