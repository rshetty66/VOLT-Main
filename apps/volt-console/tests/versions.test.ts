import { describe, expect, it } from "vitest";
import { linkCitations } from "../src/citations";
import { chatVersions, nextVersion } from "../src/versions";
import { runDeliverable } from "../src/exports";
import { voltFileName } from "../src/download";
import { newRun, type Run } from "../src/runState";
import { CHAT_FORMAT } from "../server/deliverable";

const run = (prompt: string, over: Partial<Run> = {}): Run => ({ ...newRun(prompt, "Rudra", "orchestrate"), state: "done", ...over });

describe("inline citations", () => {
  it("links source keys and evidence tags, and leaves code alone", () => {
    const md = "Seven steps move before month-end [S02][S03]. A guess [INFERENCE].\n\n```chart\n{\"labels\":[\"[S04]\"]}\n```\n`[S05]`";
    const out = linkCitations(md);
    expect(out).toContain("[S02](#cite-S02)[S03](#cite-S03)");
    expect(out).toContain("[inference](#tag-INFERENCE)");
    expect(out).toContain('{"labels":["[S04]"]}');
    expect(out).toContain("`[S05]`");
  });
  it("does not touch a key that is already a link or a reference", () => {
    expect(linkCitations("[S02](https://x.test) and [S03]: note")).toBe("[S02](https://x.test) and [S03]: note");
  });
});

describe("versions of a chat's deliverable", () => {
  it("numbers reruns after feedback under v1's name, and skips lookups", () => {
    const v1 = run("Plan a five-day close for a Canadian bank", { text: "# Five-day close plan\n\nBody", version: nextVersion([], "Plan a five-day close for a Canadian bank") });
    expect(v1.version).toEqual({ n: 1 });
    const lookup = run("list the documents in the knowledge base");
    expect(nextVersion([v1], lookup.prompt)).toBeUndefined();
    const v2 = run("Make wave 2 shorter and add the cost", { text: "# Revised five-day close", version: nextVersion([v1, lookup], "Make wave 2 shorter and add the cost") });
    expect(v2.version).toEqual({ n: 2, name: "Five-day close plan", feedback: "Make wave 2 shorter and add the cost" });
    expect(nextVersion([v1, lookup, v2], "Again, with IFRS 17 detail")).toMatchObject({ n: 3, name: "Five-day close plan" });
    expect(chatVersions([v1, lookup, v2]).map((r) => r.version!.n)).toEqual([1, 2]);
  });
  it("names every format of a version the same, with the version and the day it was written", () => {
    const v2 = run("Make it shorter", { text: "# Revised plan", startedAt: new Date(2026, 10, 27, 9).getTime(), version: { n: 2, name: "Five-day close plan", feedback: "Make it shorter" } });
    const d = runDeliverable(v2, false);
    expect(d.title).toBe("Five-day close plan");
    const name = (ext: string) => voltFileName(d.title, ext, d.markdown, d.version!.date, d.version!.n);
    expect(name("docx")).toBe("VOLT_Five-Day-Close-Plan_2026-11-27_v2.docx");
    expect(name("pptx")).toBe("VOLT_Five-Day-Close-Plan_2026-11-27_v2.pptx");
  });
});

describe("answer layout rule", () => {
  it("asks for headings, bullets, bold figures, tables and grouped source keys", () => {
    for (const w of ["headings", "bullets", "Bold the key figures", "table", "[S02][S03]"]) expect(CHAT_FORMAT).toContain(w);
  });
});

describe("key points", () => {
  it("drop source keys and evidence tags", async () => {
    const { plain } = await import("../src/runDigest");
    expect(plain("Close takes 9 days [S02][S03] at a cost [ASSUMPTION].")).toBe("Close takes 9 days at a cost.");
  });
});
