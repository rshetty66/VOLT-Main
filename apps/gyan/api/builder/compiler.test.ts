import { describe, expect, it } from "vitest";
import {
  buildCompilerMessages,
  compileSpec,
  compilerSystemPrompt,
  type CompileInput,
} from "./compiler";
import type { BuildSpec } from "./spec";

const input: CompileInput = {
  prompt: "Build me an invoice tracker for my consultancy",
  clientFile: { name: "invoices.csv", content: "amount,due_date,client" },
};

function generatedSpec(): BuildSpec {
  return {
    appName: "Invoice Tracker",
    userStories: [
      { id: "US1", story: "Create an invoice", acceptance: "It appears in the list" },
      { id: "US2", story: "Mark it paid", acceptance: "Status changes to paid" },
      { id: "US3", story: "See overdue", acceptance: "Overdue section lists it" },
    ],
    entities: [
      {
        name: "Invoice",
        fields: [{ name: "amount", type: "money" }],
        relationships: [],
        provenance: "client-file",
      },
    ],
    screens: [
      {
        name: "InvoiceList",
        purpose: "See all invoices",
        primaryAction: "create invoice",
        reads: ["Invoice"],
        writes: ["Invoice"],
      },
    ],
    primaryFlow: "From the InvoiceList screen, create an invoice",
    authModel: "none",
    gates: ["G0", "G1", "G2", "G3", "G4"],
    unknowns: [],
  };
}

describe("compiler message contract", () => {
  it("system prompt encodes the spec constraints", () => {
    const p = compilerSystemPrompt();
    expect(p).toContain("3 to 7");
    expect(p).toContain("primaryFlow");
    expect(p).toContain("unknowns");
    expect(p).toContain("client-file");
    expect(p).toContain("Never invent secrets");
  });

  it("user message carries the prompt and client file marker", () => {
    const msgs = buildCompilerMessages(input);
    expect(msgs).toHaveLength(2);
    expect(msgs[0].role).toBe("system");
    const user = msgs[1].content as string;
    expect(user).toContain("invoice tracker");
    expect(user).toContain('Client file "invoices.csv"');
    expect(user).toContain('provenance "client-file"');
  });

  it("omits the client file section when none was supplied", () => {
    const user = buildCompilerMessages({ prompt: "a timer app" })[1]
      .content as string;
    expect(user).not.toContain("Client file");
  });
});

describe("compileSpec", () => {
  it("returns the spec with a passing G0 when generation is valid", async () => {
    const r = await compileSpec(input, {
      modelId: async () => "test-model",
      generate: async () => ({ object: generatedSpec() }),
    });
    expect(r.g0.ok).toBe(true);
    expect(r.spec.appName).toBe("Invoice Tracker");
    expect(r.spec.entities[0].provenance).toBe("client-file");
  });

  it("surfaces G0 policy failures instead of hiding them", async () => {
    const bad = generatedSpec();
    bad.primaryFlow = "Exports a PDF report";
    const r = await compileSpec(input, {
      modelId: async () => "test-model",
      generate: async () => ({ object: bad }),
    });
    expect(r.g0.ok).toBe(false);
    expect(r.g0.issues.join("\n")).toContain("primaryFlow");
  });

  it("throws when generation output does not match the schema at all", async () => {
    await expect(
      compileSpec(input, {
        modelId: async () => "test-model",
        generate: async () => ({ object: { appName: "x" } }),
      }),
    ).rejects.toThrow(/invalid spec/);
  });
});
