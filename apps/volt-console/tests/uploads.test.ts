import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AttachmentError, extractAttachment } from "../server/attachments";
import { listUploads, originalPath, readUpload, removeUpload, saveUpload } from "../server/uploads";

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

  it("refuses ids that are not library ids (no path traversal) and prunes the oldest beyond the file limit", () => {
    expect(readUpload("../../etc/passwd")).toBeUndefined();
    expect(originalPath("../x")).toBeUndefined();
    expect(removeUpload("../x")).toBe(false);
    process.env.VOLT_UPLOADS_MAX_FILES = "2";
    for (const n of ["1", "2", "3"]) saveUpload(ex(`f${n}.txt`), new Uint8Array([1]));
    expect(listUploads().map((m) => m.name)).toEqual(["f3.txt", "f2.txt"]);
  });
});
