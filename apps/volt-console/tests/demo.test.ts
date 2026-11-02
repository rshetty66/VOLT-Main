import { describe, expect, it } from "vitest";
import { loadCatalog } from "../server/catalog";
import { runDemo } from "../server/demo";
import type { VoltEvent } from "../shared/events";

const catalog = loadCatalog();

describe("demo single-agent reply", () => {
  it("builds the Lens line from the agent's role text, not the Prompt Defense Baseline", async () => {
    const events: VoltEvent[] = [];
    await runDemo(
      catalog,
      { prompt: "How should we design our accounting hub?", agentId: "accounting-hub-architect" },
      (e) => events.push(e),
      new AbortController().signal,
    );
    const text = events.map((e) => (e.type === "text_delta" ? e.text : "")).join("");
    expect(text).not.toContain("Prompt Defense Baseline");
    expect(text).toContain("**Lens:** You are the Accounting Hub Architect.");
  }, 20_000);
});
