import { describe, expect, it } from "vitest";
import { setupProgress, setupSteps } from "../src/setup";

describe("setup checklist", () => {
  it("starts with only sign-in done and points at the knowledge base", () => {
    const steps = setupSteps({ uploads: 0, memory: 0, templates: 0, chats: 0 });
    const p = setupProgress(steps);
    expect(p).toMatchObject({ done: 1, total: 5 });
    expect(p.next?.id).toBe("knowledge");
    expect(p.next?.view).toBe("uploads");
  });

  it("marks each step done from real counts and moves to the next one", () => {
    const steps = setupSteps({ uploads: 2, memory: 1, templates: 0, chats: 0 });
    expect(steps.filter((s) => s.done).map((s) => s.id)).toEqual(["account", "knowledge", "memory"]);
    expect(setupProgress(steps).next?.id).toBe("template");
  });

  it("finishes when a question has been asked and nothing is left", () => {
    const p = setupProgress(setupSteps({ uploads: 1, memory: 1, templates: 1, chats: 3 }));
    expect(p).toMatchObject({ done: 5, total: 5 });
    expect(p.next).toBeUndefined();
  });

  it("only the last step has no screen to open", () => {
    const steps = setupSteps({ uploads: 0, memory: 0, templates: 0, chats: 0 });
    expect(steps.filter((s) => !s.view && s.cta).map((s) => s.id)).toEqual(["ask"]);
  });
});
