import fs from "node:fs";
import path from "node:path";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startMockAnthropic } from "./mockAnthropic";
import type { VoltEvent } from "../shared/events";
import type { Db } from "../server/db";
import type { TemplateProfile } from "../shared/template-profile";

// The sample templates are built by tests/fixtures/make-templates.py: each carries a known brand
// (theme "VOLT Brand", accent 1F3A5F / D98E04, Montserrat / Source Sans Pro) so every mapped value is checkable.
const fixture = (name: string) => fs.readFileSync(path.join(__dirname, "fixtures", name));

let mock: Awaited<ReturnType<typeof startMockAnthropic>>;
let db: Db;
let templates: typeof import("../server/templates");
let runs: typeof import("../server/runs");
let store: typeof import("../server/store");
let catalog: ReturnType<typeof import("../server/catalog").loadCatalog>;
let server: Server;
let base = "";
const ids: Record<string, string> = {};

beforeAll(async () => {
  mock = await startMockAnthropic();
  process.env.ANTHROPIC_API_KEY = "test-key";
  process.env.ANTHROPIC_BASE_URL = mock.url;
  templates = await import("../server/templates");
  runs = await import("../server/runs");
  store = await import("../server/store");
  const auth = await import("../server/auth");
  catalog = (await import("../server/catalog")).loadCatalog();
  db = await (await import("../server/db")).openDb();
  for (const [key, role] of [["ana", "consultant"], ["vic", "viewer"]] as const) {
    ids[key] = (await auth.createUser(db, { email: `${key}@example.com`, name: key, role, password: "correct-horse-battery" })).id;
  }
  const { createApp } = await import("../server/app");
  server = createApp({ db, catalog, mode: "live" }).listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  server.close();
  mock.close();
  await db.close();
});

async function as(email: string) {
  const r = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "correct-horse-battery" }) });
  const cookie = r.headers.get("set-cookie")!.split(";")[0];
  return async (method: string, url: string, body?: Buffer | object, headers: Record<string, string> = {}) => {
    const res = await fetch(base + url, {
      method,
      headers: { Cookie: cookie, ...(Buffer.isBuffer(body) ? { "Content-Type": "application/octet-stream" } : body ? { "Content-Type": "application/json" } : {}), ...headers },
      body: body === undefined ? undefined : Buffer.isBuffer(body) ? new Uint8Array(body) : JSON.stringify(body),
    });
    const buf = Buffer.from(await res.arrayBuffer());
    let data: any = null;
    try {
      data = JSON.parse(buf.toString("utf8"));
    } catch {
      /* binary */
    }
    return { status: res.status, data, buf, headers: res.headers };
  };
}
const importAs = async (email: string, name: string, bytes: Buffer) => (await as(email))("POST", "/api/templates/import", bytes, { "X-File-Name": encodeURIComponent(name) });

describe("importing an Office template into the library", () => {
  it("fills a Word template's brand from the file: colours, fonts, header, footer and logo", async () => {
    const t = await templates.importTemplate(db, fixture("brand-template.docx"), "Acme report.docx");
    expect(t).toMatchObject({
      name: "Acme report",
      primaryColor: "1F3A5F",
      accentColor: "D98E04",
      headingFont: "Montserrat", // Heading 1's effective font
      bodyFont: "Georgia", // the Normal style, which body text uses
      organisation: "Acme Advisory - Confidential",
      footerText: "acme-advisory.example",
      confidentiality: "Acme Advisory - Confidential",
      hasLogo: true,
      source: { kind: "word", fileName: "Acme report.docx" },
    });
    const brand = await templates.brandFor(db, t.id);
    expect(brand.logo?.type).toBe("image/png");
    expect(brand.headingFont).toBe("Montserrat");
  });

  it("keeps the formatting guide, the full profile and the original file", async () => {
    const t = await templates.importTemplate(db, fixture("brand-template.pptx"), "Deck.pptx");
    expect(t).toMatchObject({ headingFont: "Montserrat", bodyFont: "Source Sans Pro", hasLogo: true, source: { kind: "powerpoint" } });
    const f = await templates.getTemplateFormatting(db, t.id);
    expect(f?.guide).toContain("## Slide layouts");
    expect((f?.profile as TemplateProfile).powerpoint?.layouts).toHaveLength(11);
    expect((await templates.getTemplateSource(db, t.id))?.data.equals(fixture("brand-template.pptx"))).toBe(true);
  });

  it("maps an Excel workbook: header row font for headings, default cell font for body", async () => {
    const t = await templates.importTemplate(db, fixture("brand-template.xlsx"), "Board pack.xlsx");
    expect(t).toMatchObject({ headingFont: "Arial", bodyFont: "Calibri", organisation: "Acme Advisory", hasLogo: false, source: { kind: "excel" } });
  });

  it("falls back to the standard look for values a template does not have or cannot be used safely", () => {
    const profile = { kind: "word", name: "Odd", fileName: "odd.docx", theme: { name: "T", colors: {}, fonts: { major: 'Evil"/><x', minor: "" } }, warnings: [], guide: "" } as unknown as TemplateProfile;
    const input = templates.templateInputFromProfile(profile);
    expect(input).toMatchObject({ primaryColor: "1F3864", accentColor: "2E75B6", headingFont: "Calibri", bodyFont: "Calibri" });
  });

  it("formattingFor gives a run the guide of its engagement's template, and nothing for the standard", async () => {
    const t = await templates.importTemplate(db, fixture("brand-template.docx"), "Guide.docx");
    expect((await templates.formattingFor(db, t.id))?.guide).toContain("Heading 1");
    expect(await templates.formattingFor(db, null)).toBeNull();
    const handMade = await templates.createTemplate(db, { name: "Hand made", primaryColor: "112233", accentColor: "445566", headingFont: "Arial", bodyFont: "Arial" });
    expect(await templates.formattingFor(db, handMade.id)).toBeNull();
  });
});

describe("POST /api/templates/import", () => {
  it("creates the template for a consultant and records the source", async () => {
    const r = await importAs("ana@example.com", "Client deck.pptx", fixture("brand-template.pptx"));
    expect(r.status).toBe(201);
    expect(r.data).toMatchObject({ name: "Client deck", source: { kind: "powerpoint", fileName: "Client deck.pptx" }, hasLogo: true });
    const call = await as("ana@example.com");
    const f = await call("GET", `/api/templates/${r.data.id}/formatting`);
    expect(f.status).toBe(200);
    expect(f.data.guide).toContain("Montserrat");
    const src = await call("GET", `/api/templates/${r.data.id}/source`);
    expect(src.buf.equals(fixture("brand-template.pptx"))).toBe(true);
    expect(src.headers.get("content-disposition")).toContain("Client deck.pptx");
  });

  it("refuses viewers, unsupported types and mismatched contents", async () => {
    expect((await importAs("vic@example.com", "deck.pptx", fixture("brand-template.pptx"))).status).toBe(403);
    expect((await importAs("ana@example.com", "notes.txt", Buffer.from("hello"))).status).toBe(415);
    const mismatch = await importAs("ana@example.com", "renamed.xlsx", fixture("brand-template.docx"));
    expect(mismatch.status).toBe(400);
    expect(mismatch.data.error).toContain("Word document");
  });

  it("answers 404 for formatting and source of a hand-made template", async () => {
    const call = await as("ana@example.com");
    const made = await call("POST", "/api/templates", { name: "Plain", primaryColor: "#112233", accentColor: "#445566", headingFont: "Arial", bodyFont: "Arial" });
    expect((await call("GET", `/api/templates/${made.data.id}/formatting`)).status).toBe(404);
    expect((await call("GET", `/api/templates/${made.data.id}/source`)).status).toBe(404);
  });
});

describe("runs on an engagement with an imported template", () => {
  it("hand the formatting guide to the agents", async () => {
    const t = await templates.importTemplate(db, fixture("brand-template.docx"), "Engagement brand.docx");
    const eng = await store.createEngagement(db, { clientName: "Maple Harbour (fictional)", title: "Close", ownerId: ids.ana, templateId: t.id });
    const before = mock.requests.length;
    const seen: VoltEvent[] = [];
    const handle = await runs.startRun({ db, catalog, mode: "live", userId: ids.ana }, { prompt: "Draft the board paper", engagementId: eng.id }, (e) => seen.push(e));
    await handle.finished;
    const first = mock.requests[before].body.messages[0].content as string;
    expect(first).toContain("Draft the board paper");
    expect(first).toContain('Formatting template: "Engagement brand"');
    expect(first).toContain("Heading 1");
    expect(seen.some((e) => e.type === "status" && e.text.includes('Formatting template "Engagement brand"'))).toBe(true);
  });
});
