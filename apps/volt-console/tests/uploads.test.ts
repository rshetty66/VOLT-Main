import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AttachmentError, extractAttachment } from "../server/attachments";
import { UploadsFullError, listUploads, originalPath, readUpload, removeUpload, saveUpload, touchUploads, updateUpload, uploadMeta } from "../server/uploads";

const PDF = (text: string) =>
  new TextEncoder().encode(
    `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 100]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n4 0 obj<</Length 44>>stream\nBT /F1 12 Tf 20 50 Td (${text}) Tj ET\nendstream endobj\n5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\ntrailer<</Root 1 0 R/Size 6>>\n%%EOF`,
  );
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46]);

describe("PDF and image attachments", () => {
  it("reads the text layer of a PDF, page by page", async () => {
    const out = await extractAttachment("memo.pdf", PDF("Close takes 12 days"));
    expect(out.text).toContain("## Page 1");
    expect(out.text).toContain("Close takes 12 days");
  });

  it("rejects a file named .pdf that is not a PDF, and a PDF with no text layer", async () => {
    await expect(extractAttachment("x.pdf", new TextEncoder().encode("not a pdf"))).rejects.toBeInstanceOf(AttachmentError);
    await expect(extractAttachment("x.jpg", new TextEncoder().encode("not a jpeg"))).rejects.toMatchObject({ code: "unreadable" });
  });

  describe("image reading", () => {
    let server: http.Server;
    let seen: any;
    const saved = { url: process.env.ANTHROPIC_BASE_URL, key: process.env.ANTHROPIC_API_KEY };
    beforeEach(async () => {
      server = http.createServer((req, res) => {
        let b = "";
        req.on("data", (c) => (b += c));
        req.on("end", () => {
          seen = JSON.parse(b);
          res.writeHead(200, { "content-type": "application/json" });
          res.end(JSON.stringify({ id: "m", type: "message", role: "assistant", model: "claude-haiku-5-5", content: [{ type: "text", text: "Revenue 1,200" }], stop_reason: "end_turn", usage: { input_tokens: 5, output_tokens: 3 } }));
        });
      });
      await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
      process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      process.env.ANTHROPIC_API_KEY = "test";
    });
    afterEach(() => {
      server.close();
      for (const [k, v] of [["ANTHROPIC_BASE_URL", saved.url], ["ANTHROPIC_API_KEY", saved.key]] as const) v === undefined ? delete process.env[k] : (process.env[k] = v);
    });

    it("reads a JPEG once through vision and returns labelled text", async () => {
      const out = await extractAttachment("scan.jpeg", JPEG);
      expect(out.text).toContain("Revenue 1,200");
      expect(out.text).toContain("transcription may contain errors");
      expect(seen.messages[0].content[0]).toMatchObject({ type: "image", source: { media_type: "image/jpeg" } });
    });
  });
});

describe("uploads library", () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "volt-uploads-"));
    process.env.VOLT_DATA_DIR = dir;
  });
  afterEach(() => {
    delete process.env.VOLT_DATA_DIR;
    delete process.env.VOLT_UPLOADS_MAX_FILES;
    delete process.env.VOLT_UPLOADS_MAX_MB;
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const ex = (name: string, text = "body") => ({ name, text, chars: text.length, truncated: false });

  it("keeps the original and the text, lists newest first, and counts uses", () => {
    const a = saveUpload(ex("a.pdf", "alpha"), new Uint8Array([1, 2, 3]));
    saveUpload(ex("b.csv", "beta"), new Uint8Array([4]));
    expect(listUploads().map((m) => m.name)).toEqual(["b.csv", "a.pdf"]);
    expect(fs.readFileSync(originalPath(a.id)!)).toEqual(Buffer.from([1, 2, 3]));
    expect(readUpload(a.id)).toMatchObject({ text: "alpha", meta: { uses: 1 } });
  });

  it("replaces an earlier upload of the same name and removes entries", () => {
    const a = saveUpload(ex("a.pdf", "v1"), new Uint8Array([1]));
    const a2 = saveUpload(ex("a.pdf", "v2"), new Uint8Array([2]));
    expect(listUploads()).toHaveLength(1);
    expect(readUpload(a.id)).toBeUndefined();
    expect(removeUpload(a2.id)).toBe(true);
    expect(listUploads()).toEqual([]);
  });

  it("refreshes a web source in place: same id and added time, new text and a new last-read time", () => {
    const url = "https://example.com/ifrs17";
    const first = saveUpload(ex("IFRS 17 (example.com)", "old"), new Uint8Array([1]), { url });
    expect(first.readAt).toBeTypeOf("number");
    const again = saveUpload(ex("IFRS 17 (example.com)", "new"), new Uint8Array([2]), { url, keep: { ...first, readAt: 0 } });
    expect(again).toMatchObject({ id: first.id, createdAt: first.createdAt, url });
    expect(again.readAt).toBeGreaterThan(0);
    expect(listUploads()).toHaveLength(1);
    expect(readUpload(first.id)?.text).toBe("new");
    expect(uploadMeta("../x")).toBeUndefined();
  });

  it("refuses ids that are not library ids (no path traversal), and refuses a new file over the limits instead of dropping old ones", () => {
    expect(readUpload("../../etc/passwd")).toBeUndefined();
    expect(originalPath("../x")).toBeUndefined();
    expect(removeUpload("../x")).toBe(false);
    process.env.VOLT_UPLOADS_MAX_FILES = "2";
    for (const n of ["1", "2"]) saveUpload(ex(`f${n}.txt`), new Uint8Array([1]));
    expect(() => saveUpload(ex("f3.txt"), new Uint8Array([1]))).toThrow(UploadsFullError);
    // Replacing a file of the same name still fits.
    saveUpload(ex("f2.txt", "v2"), new Uint8Array([1]));
    expect(listUploads().map((m) => m.name)).toEqual(["f2.txt", "f1.txt"]);
    process.env.VOLT_UPLOADS_MAX_FILES = "10";
    process.env.VOLT_UPLOADS_MAX_MB = "1";
    expect(() => saveUpload(ex("big.mov"), new Uint8Array(1024 * 1024))).toThrow(/full/);
  });

  it("archives by hand and after 30 days unused: kept, out of the project list, restorable", () => {
    const a = saveUpload(ex("a.pdf"), new Uint8Array([1]), { projectId: "p1" });
    const b = saveUpload(ex("b.pdf"), new Uint8Array([1]), { projectId: "p1" });
    updateUpload(a.id, { archived: true });
    expect(listUploads("p1").map((m) => m.name)).toEqual(["b.pdf"]);
    expect(listUploads("p1", { archived: true }).map((m) => m.name)).toEqual(["a.pdf"]);
    const later = Date.now() + 31 * 86_400_000;
    expect(listUploads("p1", { now: later })).toEqual([]);
    expect(listUploads("p1", { archived: true, now: later }).map((m) => m.name).sort()).toEqual(["a.pdf", "b.pdf"]);
    touchUploads([b.id]);
    expect(updateUpload(a.id, { archived: false })).toMatchObject({ archived: false });
    expect(listUploads("p1").map((m) => m.name)).toEqual(["b.pdf", "a.pdf"]);
    expect(listUploads()).toHaveLength(2);
  });

  it("puts files in folders and shares a file with every project", () => {
    const a = saveUpload(ex("ifrs17.pdf"), new Uint8Array([1]), { projectId: "p1", folder: "Standards" });
    expect(a.folder).toBe("Standards");
    expect(updateUpload(a.id, { folder: "  IFRS / Insurance  " })?.folder).toBe("IFRS Insurance");
    expect(listUploads("p2")).toEqual([]);
    updateUpload(a.id, { allProjects: true });
    expect(listUploads("p2").map((m) => m.name)).toEqual(["ifrs17.pdf"]);
    // A new version keeps its folder and sharing.
    const v2 = saveUpload(ex("ifrs17.pdf", "v2"), new Uint8Array([2]), { projectId: "p1" });
    expect(v2).toMatchObject({ folder: "IFRS Insurance", allProjects: true });
    expect(updateUpload(v2.id, { folder: null, allProjects: false })).not.toHaveProperty("folder");
    expect(listUploads("p2")).toEqual([]);
    expect(updateUpload("../x", { archived: true })).toBeUndefined();
  });
});
