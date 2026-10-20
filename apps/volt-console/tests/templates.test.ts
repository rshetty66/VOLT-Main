import zlib from "node:zlib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import JSZip from "jszip";
import ExcelJS from "exceljs";
import { openDb, type Db } from "../server/db";
import { createEngagement, getEngagement, setEngagementTemplate } from "../server/store";
import { brandFor, createTemplate, deleteTemplate, getLogo, listTemplates, updateTemplate } from "../server/templates";
import { STANDARD_BRAND, inspectLogo, joinLabels, normaliseColour, textOn } from "../server/office/brand";
import { sampleContent } from "../server/office/sample";
import { buildDocx } from "../server/office/docx";
import { buildPptx } from "../server/office/pptx";
import { buildXlsx } from "../server/office/xlsx";

/** A real 3x2 PNG, built here so the test needs no fixture file. */
function png(width: number, height: number): Buffer {
  const crc = (buf: Buffer) => {
    let c = ~0;
    for (const b of buf) {
      c ^= b;
      for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
    }
    return ~c >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  const raw = Buffer.alloc((width * 3 + 1) * height, 0x40);
  for (let y = 0; y < height; y++) raw[y * (width * 3 + 1)] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
const LOGO = png(3, 2);

let db: Db;
beforeAll(async () => {
  db = await openDb();
});
afterAll(async () => {
  await db.close();
});

const maple = { name: "Maple Harbour Financial", organisation: "VOLT Advisory", primaryColor: "0B6E4F", accentColor: "C77D0A", headingFont: "Georgia", bodyFont: "Arial", footerText: "Board working draft", confidentiality: "Confidential - prepared for the Board" };

describe("brand helpers", () => {
  it("normalises colours, reads logo sizes and picks readable text", () => {
    expect(normaliseColour("#0b6e4f")).toBe("0B6E4F");
    expect(normaliseColour("green")).toBeNull();
    expect(inspectLogo(LOGO)).toEqual({ type: "image/png", width: 3, height: 2 });
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x32, 0x00, 0x64, 0x03]);
    expect(inspectLogo(jpeg)).toEqual({ type: "image/jpeg", width: 100, height: 50 });
    expect(inspectLogo(Buffer.from("GIF89a....."))).toBeNull();
    expect(textOn("1F3864")).toBe("FFFFFF");
    expect(textOn("F4D35E")).toBe("1A1A1A");
    expect(joinLabels(["Maple Harbour", "maple harbour", "", "Draft"], " | ")).toBe("Maple Harbour | Draft");
  });
});

describe("template library", () => {
  it("lists the built-in standard first and counts engagements using each template", async () => {
    const t = await createTemplate(db, { ...maple, logo: LOGO });
    expect(t.hasLogo).toBe(true);
    const e = await createEngagement(db, { clientName: "Maple Harbour Financial", title: "Close", templateId: t.id });
    expect(e.templateName).toBe("Maple Harbour Financial");
    await createEngagement(db, { clientName: "Other", title: "No template" });
    const list = await listTemplates(db);
    expect(list[0]).toMatchObject({ id: "standard", builtIn: true });
    expect(list.find((x) => x.id === t.id)?.engagementCount).toBe(1);
    expect((await getLogo(db, t.id))?.type).toBe("image/png");
  });

  it("gives an engagement its template's brand, and the standard when it has none or the template is deleted", async () => {
    const t = await createTemplate(db, { ...maple, logo: LOGO });
    const e = await createEngagement(db, { clientName: "Maple", title: "Close" });
    expect(await brandFor(db, e.templateId)).toBe(STANDARD_BRAND);
    await setEngagementTemplate(db, e.id, t.id);
    const brand = await brandFor(db, (await getEngagement(db, e.id))!.templateId);
    expect(brand).toMatchObject({ name: "Maple Harbour Financial", primary: "0B6E4F", headingFont: "Georgia", confidentiality: "Confidential - prepared for the Board" });
    expect(brand.logo?.width).toBe(3);
    expect(await deleteTemplate(db, t.id)).toBe(true);
    const after = (await getEngagement(db, e.id))!;
    expect(after.templateId).toBeNull();
    expect(await brandFor(db, after.templateId)).toBe(STANDARD_BRAND);
  });

  it("keeps the logo on update unless replaced or removed, and rejects non-images", async () => {
    const t = await createTemplate(db, { ...maple, logo: LOGO });
    expect((await updateTemplate(db, t.id, { ...maple, name: "Renamed" }))?.hasLogo).toBe(true);
    expect((await updateTemplate(db, t.id, { ...maple, logo: null }))?.hasLogo).toBe(false);
    await expect(createTemplate(db, { ...maple, logo: Buffer.from("not an image") })).rejects.toThrow(/PNG or JPEG/);
  });
});

describe("exports follow the template", () => {
  const brand = { ...STANDARD_BRAND, name: "Maple", primary: "0B6E4F", accent: "C77D0A", headingFont: "Georgia", bodyFont: "Arial", organisation: "VOLT Advisory", confidentiality: "Confidential - prepared for the Board", logo: { data: LOGO, ...inspectLogo(LOGO)! } };

  it("Word uses the template's fonts, colours, logo and confidentiality label", async () => {
    const zip = await JSZip.loadAsync(await buildDocx(sampleContent(), brand));
    const styles = await zip.file("word/styles.xml")!.async("string");
    expect(styles).toContain('w:ascii="Georgia"');
    expect(styles).toContain('w:ascii="Arial"');
    expect(styles).toContain('w:val="0B6E4F"');
    const doc = await zip.file("word/document.xml")!.async("string");
    expect(doc).toContain("Confidential - prepared for the Board");
    expect(doc).toContain('w:fill="0B6E4F"'); // table header
    expect(Object.keys(zip.files).some((n) => n.startsWith("word/media/"))).toBe(true);
  });

  it("PowerPoint uses the template's colours, fonts and logo", async () => {
    const zip = await JSZip.loadAsync(await buildPptx(sampleContent(), brand));
    const slides = (await Promise.all(Object.keys(zip.files).filter((n) => /^ppt\/(slides|slideMasters|slideLayouts)\/.*\.xml$/.test(n)).map((n) => zip.file(n)!.async("string")))).join("");
    expect(slides).toContain('val="0B6E4F"');
    expect(slides).toContain('typeface="Georgia"');
    expect(slides).toContain("Confidential - prepared for the Board");
    expect(Object.keys(zip.files).some((n) => n.startsWith("ppt/media/"))).toBe(true);
  });

  it("Excel uses the template's colours and fonts and carries the logo", async () => {
    const buf = await buildXlsx(sampleContent(), brand);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as Parameters<typeof wb.xlsx.load>[0]);
    const vc = wb.getWorksheet("Value case")!;
    let header: ExcelJS.Cell | undefined;
    vc.eachRow((row) => row.eachCell((c) => (header ??= c.value === "Year" ? c : undefined)));
    expect((header!.fill as ExcelJS.FillPattern).fgColor?.argb).toBe("FF0B6E4F");
    expect(header!.font.name).toBe("Arial");
    expect(wb.getWorksheet("Summary")!.getCell("A1").font.name).toBe("Georgia");
    expect(Object.keys((await JSZip.loadAsync(buf)).files).some((n) => n.startsWith("xl/media/"))).toBe(true);
  });

  it("without a template the exports keep the VOLT standard", async () => {
    const zip = await JSZip.loadAsync(await buildDocx(sampleContent()));
    expect(await zip.file("word/styles.xml")!.async("string")).toContain('w:val="1F3864"');
  });
});
