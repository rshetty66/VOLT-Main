import { describe, expect, it } from "vitest";
import { SCOPE_QUESTIONS, defaultScope, scopeBrief, scopeLabel, scopeSchema } from "../shared/scope";
import { withTemplate } from "../server/orchestrator";

describe("chat scope questions", () => {
  it("asks at most five short questions, each with a default that is one of its options", () => {
    expect(SCOPE_QUESTIONS.length).toBeLessThanOrEqual(5);
    for (const q of SCOPE_QUESTIONS) {
      expect(Object.keys(q.options)).toContain(q.fallback);
      expect(Object.keys(q.options).length).toBeLessThanOrEqual(6);
    }
  });

  it("offers every file deliverable create_file can make for the chat", () => {
    const deliverable = SCOPE_QUESTIONS.find((q) => q.key === "deliverable")!;
    expect(Object.keys(deliverable.options)).toEqual(["chat", "html", "pptx", "docx", "xlsx"]);
    expect(scopeBrief({ deliverable: "xlsx" })).toContain("an Excel workbook made with create_file");
  });

  it("accepts the defaults and rejects an unknown answer or field", () => {
    expect(scopeSchema.safeParse(defaultScope()).success).toBe(true);
    expect(scopeSchema.safeParse({}).success).toBe(true);
    expect(scopeSchema.safeParse({ client_type: "hedge_fund" }).success).toBe(false);
    expect(scopeSchema.safeParse({ colour: "red" }).success).toBe(false);
  });

  it("turns the answers into one scope block for the brief", () => {
    const brief = scopeBrief({ client_type: "insurer", use_case: "segment_profitability", gaap: "ifrs_us_gaap", deliverable: "pptx", depth: "quick" });
    expect(brief).toContain("- Client type: Insurer");
    expect(brief).toContain("- Outcome: Segment profitability");
    expect(brief).toContain("- Reporting basis: IFRS and US GAAP");
    expect(brief).toContain("do not ask again");
    expect(brief).toContain("Keep the answer short");
    expect(brief).toContain("a PowerPoint deck made with create_file");
  });

  it("asks for no file when the answer stays in chat, and adds nothing for an empty scope", () => {
    expect(scopeBrief({ deliverable: "chat" })).not.toContain("create_file");
    expect(scopeBrief({})).toBe("");
  });

  it("labels the chip in question order", () => {
    expect(scopeLabel(defaultScope())).toBe("Bank · Faster close · IFRS · Answer in chat · Standard");
  });

  it("reaches the lead with the request, and only when a scope was set", () => {
    expect(withTemplate({ prompt: "Which branches make money?", scope: { client_type: "credit_union" } })).toContain("- Client type: Credit union");
    expect(withTemplate({ prompt: "Which branches make money?" })).toBe("Which branches make money?");
  });
});
