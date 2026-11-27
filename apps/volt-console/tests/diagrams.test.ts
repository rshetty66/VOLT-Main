import { describe, expect, it } from "vitest";
import { SAMPLE_SPEC, extractJson, validateSpec } from "../shared/diagram";
import { generateDiagram } from "../server/diagrams";

const ok = { title: "T", nodes: [{ id: "a", type: "agent", label: "A" }, { id: "b", type: "tool", label: "B" }], edges: [{ from: "a", to: "b" }], scenarios: [{ name: "s", steps: [{ edge: "a>b", note: "go" }] }] };

describe("diagram spec", () => {
  it("accepts a valid spec and the sample", () => {
    expect(validateSpec(ok).nodes).toHaveLength(2);
    expect(SAMPLE_SPEC.scenarios?.length).toBe(2);
  });
  it("strips markup from model text", () => {
    const s = validateSpec({ ...ok, title: "<img src=x onerror=1>", nodes: [{ id: "a", label: "<b>A</b>" }, ok.nodes[1]] });
    expect(s.title + s.nodes[0].label).not.toMatch(/[<>]/);
  });
  it("rejects unknown edge targets, missing step edges and oversize diagrams", () => {
    expect(() => validateSpec({ ...ok, edges: [{ from: "a", to: "z" }] })).toThrow(/unknown node/);
    expect(() => validateSpec({ ...ok, scenarios: [{ name: "s", steps: [{ edge: "b>a", note: "x" }] }] })).toThrow(/does not exist/);
    expect(() => validateSpec({ nodes: Array.from({ length: 15 }, (_, i) => ({ id: `n${i}` })) })).toThrow(/limit/);
  });
  it("falls back on unknown node types and reads fenced JSON", () => {
    expect(validateSpec({ ...ok, nodes: [{ id: "a", type: "wizard", label: "A" }, ok.nodes[1]] }).nodes[0].type).toBe("agent");
    expect(extractJson("```json\n" + JSON.stringify(ok) + "\n```")).toEqual(ok);
    expect(() => extractJson("no json")).toThrow();
  });
});

describe("generateDiagram", () => {
  it("returns the sample in demo mode without calling the model", async () => {
    const r = await generateDiagram("some system to draw", false, new AbortController().signal, { messages: { create: () => { throw new Error("called"); } } } as never);
    expect(r.demo).toBe(true);
  });
  it("validates what the model returns", async () => {
    const client = { messages: { create: async () => ({ content: [{ type: "text", text: JSON.stringify(ok) }], usage: { input_tokens: 5, output_tokens: 7 } }) } };
    const r = await generateDiagram("some system to draw", true, new AbortController().signal, client as never);
    expect(r.spec.title).toBe("T");
    expect(r.outputTokens).toBe(7);
  });
});
