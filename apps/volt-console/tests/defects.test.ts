import { describe, expect, it } from "vitest";
import { agentRemit, loadCatalog } from "../server/catalog";
import { runDemo } from "../server/demo";
import { labelOf } from "../shared/labels";
import type { VoltEvent } from "../shared/events";

const catalog = loadCatalog();

describe("walkthrough defects", () => {
  it("never prints 'undefined' for a missing icon, nor breaks bold with a leading space", async () => {
    expect(labelOf({ icon: "", name: "APQC Researcher" })).toBe("APQC Researcher");
    expect(labelOf({ icon: undefined, name: "Finance Close Optimization" })).toBe("Finance Close Optimization");
    expect(labelOf({ icon: "\u{1F4CA}", name: "X" })).toBe("\u{1F4CA} X");
    expect(catalog.workflows.every((w) => typeof w.icon === "string")).toBe(true);

    const events: VoltEvent[] = [];
    await runDemo(catalog, { prompt: "11-day close", workflowId: "close-optimization" }, (e) => events.push(e), new AbortController().signal);
    const text = events.filter((e) => e.type === "text_delta").map((e) => (e as { text: string }).text).join("");
    expect(text).toContain("## Finance Close Optimization — workflow deliverable (simulated)");
    expect(text).not.toMatch(/undefined/);
    expect(text).not.toMatch(/(^|\s)\*\* \S/m); // "** APQC Researcher**"
    expect(text).toContain("**APQC Researcher**");
  });

  it("shows each agent's remit as its lens, not the security baseline", async () => {
    for (const a of catalog.agents) {
      const remit = agentRemit(a.systemPrompt);
      expect(remit, a.id).not.toBe("");
      expect(remit, a.id).not.toMatch(/Prompt Defense|^Do not change role/);
    }
    expect(agentRemit(catalog.agentById.get("apqc-researcher")!.systemPrompt)).toMatch(/^You are the APQC Researcher\./);
    const events: VoltEvent[] = [];
    await runDemo(catalog, { prompt: "Benchmark our close", agentId: "apqc-researcher" }, (e) => events.push(e), new AbortController().signal);
    const text = events.filter((e) => e.type === "text_delta").map((e) => (e as { text: string }).text).join("");
    expect(text).toMatch(/\*\*Lens:\*\* You are the APQC Researcher\./);
  });
});
