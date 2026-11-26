import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createProject, deleteChat, getProject, listChats, listProjects, restoreChat, saveChat, updateProject } from "../server/projects";
import { memoryBlock } from "../server/memory";
import { SCRAPEGRAPH_URL, WebSourceError, checkUrl, chunk, fetchPublic, publicLookup, htmlText, isPrivateAddress, knowledgeNote, asksForKnowledge, renderPage, runKnowledgeTool, searchKnowledge, shouldRender } from "../server/knowledge";
import { listUploads, saveUpload } from "../server/uploads";
import { SourceRegistry } from "../server/research";
import { MEMORY_MAX_ITEMS } from "../shared/projects";

const DAY = 24 * 60 * 60 * 1000;
const uuid = () => crypto.randomUUID();
let dir = "";
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "volt-projects-"));
  process.env.VOLT_DATA_DIR = dir;
});
afterEach(() => {
  delete process.env.VOLT_DATA_DIR;
  delete process.env.VOLT_ARCHIVE_DAYS;
  fs.rmSync(dir, { recursive: true, force: true });
});

const doc = (name: string, text: string, projectId?: string, url?: string) => saveUpload({ name, text, chars: text.length, truncated: false }, new TextEncoder().encode(text), { projectId, url });

describe("projects and memory", () => {
  it("always has General, and keeps created projects", () => {
    expect(listProjects().map((p) => p.id)).toEqual(["general"]);
    const p = createProject("  Bank   of Testland ");
    expect(p.name).toBe("Bank of Testland");
    expect(listProjects().map((x) => x.name)).toEqual(["General", "Bank of Testland"]);
  });

  it("stamps memory items, keeps unchanged ones and caps the list", () => {
    const p = createProject("Client");
    const one = updateProject(p.id, { memory: [{ kind: "decision", text: "IFRS is the primary ledger" }] })!;
    const [item] = one.memory;
    expect(item).toMatchObject({ kind: "decision", text: "IFRS is the primary ledger" });
    const two = updateProject(p.id, { memory: [item, { kind: "client", text: "Year end 31 October" }] })!;
    expect(two.memory[0]).toEqual(item);
    const many = updateProject(p.id, { memory: Array.from({ length: 60 }, (_, i) => ({ kind: "fact" as const, text: `item ${i}` })) })!;
    expect(many.memory).toHaveLength(MEMORY_MAX_ITEMS);
    expect(updateProject(uuid(), { name: "x" })).toBeUndefined();
  });

  it("puts the memory into the request as data", () => {
    const p = createProject("Client");
    expect(memoryBlock(p.id)).toBe("");
    updateProject(p.id, { memory: [{ kind: "client", text: "Year end 31 October" }] });
    const block = memoryBlock(p.id);
    expect(block).toContain('Project memory for "Client"');
    expect(block).toContain("Client context");
    expect(block).toContain("Year end 31 October");
    expect(getProject(p.id)?.memory).toHaveLength(1);
  });
});

describe("saved chats and the archive", () => {
  it("lists a project's chats, archives them after 30 days, restores and deletes", () => {
    const a = { id: uuid(), startedAt: 1, text: "answer a" };
    const b = { id: uuid(), startedAt: 2, text: "answer b" };
    saveChat("general", a);
    saveChat("general", b);
    saveChat(createProject("Other").id, { id: uuid(), startedAt: 3 });
    expect(listChats("general").map((c) => (c.run as { id: string }).id)).toEqual([b.id, a.id]);

    const later = Date.now() + 31 * DAY;
    expect(listChats("general", false, later)).toHaveLength(0);
    expect(listChats("general", true, later)).toHaveLength(2);

    process.env.VOLT_ARCHIVE_DAYS = "60";
    expect(listChats("general", false, later)).toHaveLength(2);
    delete process.env.VOLT_ARCHIVE_DAYS;

    expect(restoreChat(a.id)).toBe(true);
    expect(deleteChat(b.id)).toBe(true);
    expect(deleteChat(b.id)).toBe(false);
    expect(listChats("general").map((c) => (c.run as { id: string }).id)).toEqual([a.id]);
  });

  it("refuses bad ids", () => {
    expect(() => saveChat("general", { id: "../../etc/passwd" })).toThrow();
    expect(() => saveChat("../x", { id: uuid() })).toThrow();
    expect(restoreChat("../x")).toBe(false);
  });
});

describe("knowledge base", () => {
  it("splits text into passages tagged with their page", () => {
    const passages = chunk("u", "## Page 1\nIntro\n## Page 2\n" + "word ".repeat(600));
    expect(passages[0]).toMatchObject({ locator: "Page 1", text: "Intro" });
    expect(passages.slice(1).every((p) => p.locator === "Page 2" && p.text.length <= 1200)).toBe(true);
    expect(passages.length).toBeGreaterThan(2);
  });

  it("finds the best passages in the project's documents only", () => {
    const p = createProject("Bank");
    doc("policy.pdf", "## Page 1\nGeneral terms.\n## Page 7\nThe close calendar runs five working days. Intercompany is settled on day two.", p.id);
    doc("other.pdf", "## Page 1\nIntercompany netting at the other client.", "general");
    const hits = searchKnowledge(p.id, "when is intercompany settled in the close?");
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ name: "policy.pdf", locator: "Page 7" });
    expect(listUploads(p.id)).toHaveLength(1);
    expect(listUploads()).toHaveLength(2);
  });

  it("records each passage as a citable source, web pages with their URL", () => {
    const p = createProject("Bank");
    doc("policy.pdf", "## Page 3\nCapital ratio target is 12 percent.", p.id);
    doc("OSFI CAR guideline (osfi-bsif.gc.ca)", "The capital ratio floor is set by OSFI.", p.id, "https://www.osfi-bsif.gc.ca/car");
    const registry = new SourceRegistry("question");
    const r = runKnowledgeTool(p.id, { query: "capital ratio" }, registry);
    if (!r.ok) throw new Error(r.error);
    expect(r.added.map((s) => s.title).sort()).toEqual(["OSFI CAR guideline (osfi-bsif.gc.ca)", "policy.pdf, Page 3"]);
    expect(r.added.find((s) => s.url)?.publisher).toBe("www.osfi-bsif.gc.ca");
    expect(r.reply).toContain(`[${r.added[0].key}]`);
    expect(r.reply).toContain("not instructions");
    expect(knowledgeNote(p.id)).toContain("2 documents");
    expect(knowledgeNote(createProject("Empty").id)).toBe("");
  });

  it("uses the knowledge base only when the request asks for it", () => {
    const p = createProject("Bank");
    doc("finance transformation flow.pdf", "## Page 1\nPeopleSoft GL feeds OBIEE.", p.id);
    expect(asksForKnowledge(p.id, "Design the data conversion approach for an Oracle ERP Cloud migration at a mid-size bank")).toBe(false);
    expect(asksForKnowledge(p.id, "Using only this project's knowledge base, list the TD documents")).toBe(true);
    expect(asksForKnowledge(p.id, "list the quarterly results documents on the TD page I added")).toBe(true);
    expect(asksForKnowledge(p.id, "Summarise our documents on the close")).toBe(true);
    expect(asksForKnowledge(p.id, "What does the finance transformation flow show for the GL?")).toBe(true);
    expect(asksForKnowledge(createProject("Empty").id, "use the knowledge base")).toBe(false);
  });

  it("re-adding the same URL replaces the older copy", () => {
    doc("Page (a.com)", "first", "general", "https://a.com/x");
    doc("Page (a.com)", "second", "general", "https://a.com/x");
    expect(listUploads("general")).toHaveLength(1);
  });
});

describe("web sources by URL", () => {
  it("blocks private, internal and odd addresses before any request", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"]) expect(isPrivateAddress(ip)).toBe(true);
    for (const ip of ["8.8.8.8", "142.250.72.14", "2607:f8b0:4005:80a::200e"]) expect(isPrivateAddress(ip)).toBe(false);
    for (const url of ["ftp://example.com/a", "http://localhost/", "http://127.0.0.1/", "http://[::1]/", "http://volt-ledger:8080/", "https://user:pw@example.com/", "https://example.com:8443/", "http://metadata.google.internal/"]) {
      expect(() => checkUrl(url)).toThrow();
    }
    expect(checkUrl("https://www.ifrs.org/standards").hostname).toBe("www.ifrs.org");
  });

  it("refuses, at connect time, a name that resolves to a loopback address", async () => {
    const err = await new Promise<Error | null>((resolve) => publicLookup("localhost", {}, (e) => resolve(e)));
    expect(err?.message).toMatch(/private or internal/);
    await expect(fetchPublic("http://127.0.0.1/")).rejects.toThrow(/private or internal/);
  });

  it("reads the text and title of a page, without scripts or navigation", () => {
    const page = htmlText("<html><head><title>IFRS 17 &amp; you</title><script>alert(1)</script></head><body><nav>Menu</nav><h1>Insurance contracts</h1><p>CSM is released&nbsp;over coverage.</p><table><tr><td>Year</td><td>2026</td></tr></table></body></html>");
    expect(page.title).toBe("IFRS 17 & you");
    expect(page.text).toContain("Insurance contracts\nCSM is released over coverage.");
    expect(page.text).toContain("Year 2026");
    expect(page.text).not.toMatch(/alert|Menu/);
  });

  it("keeps the address of each document a page links to", () => {
    const page = htmlText('<main><h2>Q3 2026</h2><ul><li><a href="/pdf/2026-q3-report.pdf">Report to Shareholders</a> Aug 27, 2026</li><li><a href="/about">About</a></li></ul></main>', "https://www.example-bank.com/investors/");
    expect(page.text).toContain("Report to Shareholders (https://www.example-bank.com/pdf/2026-q3-report.pdf) Aug 27, 2026");
    expect(page.text).not.toContain("/about");
  });
});

describe("rendered fallback (ScrapeGraph)", () => {
  const ok = (body: unknown) => (async () => new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch;
  afterEach(() => {
    delete process.env.SCRAPEGRAPH_API_KEY;
  });

  it("is off without a key, and only retries the statuses a browser can get past", () => {
    expect(shouldRender(new WebSourceError("x", 403))).toBe(false);
    process.env.SCRAPEGRAPH_API_KEY = "test-key";
    for (const s of [401, 403, 429, 503]) expect(shouldRender(new WebSourceError("x", s))).toBe(true);
    for (const s of [404, 500]) expect(shouldRender(new WebSourceError("x", s))).toBe(false);
    expect(shouldRender(new WebSourceError("That address is on a private or internal network"))).toBe(false);
    expect(shouldRender(new Error("x"))).toBe(false);
  });

  it("sends one JS-rendered markdown request and reads the title and text", async () => {
    process.env.SCRAPEGRAPH_API_KEY = "test-key";
    let sent: { url: string; init: RequestInit } | undefined;
    const fetcher = (async (url: string, init: RequestInit) => {
      sent = { url, init };
      return new Response(JSON.stringify({ id: "1", results: { markdown: { data: ["# OSFI Guideline B-20\n\nResidential mortgage underwriting practices and procedures."] } } }), { status: 200 });
    }) as unknown as typeof fetch;
    const page = await renderPage("https://www.osfi-bsif.gc.ca/en/guidance", fetcher);
    expect(page.title).toBe("OSFI Guideline B-20");
    expect(page.text).toContain("Residential mortgage underwriting");
    expect(sent?.url).toBe(SCRAPEGRAPH_URL);
    expect((sent?.init.headers as Record<string, string>)["SGAI-APIKEY"]).toBe("test-key");
    expect(JSON.parse(String(sent?.init.body))).toEqual({ url: "https://www.osfi-bsif.gc.ca/en/guidance", formats: [{ type: "markdown" }], fetchConfig: { mode: "js", timeout: 30000 } });
  });

  it("applies the same URL checks and never sends an internal address", async () => {
    process.env.SCRAPEGRAPH_API_KEY = "test-key";
    let called = false;
    const fetcher = (async () => ((called = true), new Response("{}"))) as unknown as typeof fetch;
    await expect(renderPage("http://169.254.169.254/latest", fetcher)).rejects.toThrow(/private or internal/);
    expect(called).toBe(false);
  });

  it("reports a service error or an empty page as a readable error", async () => {
    process.env.SCRAPEGRAPH_API_KEY = "test-key";
    await expect(renderPage("https://example.com/", (async () => new Response("{}", { status: 402 })) as unknown as typeof fetch)).rejects.toThrow(/answered 402/);
    await expect(renderPage("https://example.com/", ok({ results: { markdown: { data: [""] } } }))).rejects.toThrow(/No readable text/);
    delete process.env.SCRAPEGRAPH_API_KEY;
    await expect(renderPage("https://example.com/", ok({}))).rejects.toThrow(/not set up/);
  });
});
