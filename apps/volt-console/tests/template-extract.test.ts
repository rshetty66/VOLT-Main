import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { zipSync, strToU8 } from "fflate";
import { analyseTemplate, extractTemplate, TemplateError } from "../server/template-extract";

const fixture = (name: string) => new Uint8Array(fs.readFileSync(path.join(__dirname, "fixtures", name)));
const errorCode = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return e instanceof TemplateError ? e.code : `not a TemplateError: ${String(e)}`;
  }
  return "no error";
};

describe("Word template extraction", () => {
  const p = extractTemplate(fixture("brand-template.docx"), "brand-template.docx");

  it("reads the theme colours and fonts", () => {
    expect(p.kind).toBe("word");
    expect(p.theme?.name).toBe("VOLT Brand");
    expect(p.theme?.colors.accent1).toBe("1F3A5F");
    expect(p.theme?.colors.accent2).toBe("D98E04");
    expect(p.theme?.fonts).toEqual({ major: "Montserrat", minor: "Source Sans Pro" });
  });

  it("reads page setup and margins", () => {
    expect(p.word?.page).toMatchObject({ widthIn: 8.5, heightIn: 11, orientation: "portrait" });
    expect(p.word?.page.marginsIn).toMatchObject({ top: 1, bottom: 1, left: 1.25, right: 1.25 });
  });

  it("resolves effective paragraph styles through inheritance", () => {
    const style = (n: string) => p.word?.styles.find((s) => s.name === n);
    expect(style("Normal")).toMatchObject({ font: "Georgia", sizePt: 11, color: "333333", spaceAfterPt: 6 });
    // The style names Arial but also the theme heading font; Word renders the theme font.
    expect(style("Heading 1")).toMatchObject({ font: "Montserrat", sizePt: 20, bold: true, color: "1F3A5F", spaceBeforePt: 18 });
    expect(style("Header")?.basedOn).toBe("Normal");
    // Auto-generated linked "Char" styles are left out.
    expect(p.word?.styles.some((s) => s.name.endsWith(" Char"))).toBe(false);
    expect(style("Title")?.sizePt).toBe(32);
    expect(style("Heading 1")?.used).toBe(true);
  });

  it("reads header and footer text", () => {
    expect(p.word?.headers).toContain("Acme Advisory - Confidential");
    expect(p.word?.footers).toContain("acme-advisory.example");
  });

  it("writes a formatting guide agents can follow", () => {
    expect(p.guide).toContain("1F3A5F");
    expect(p.guide).toContain("Montserrat");
    expect(p.guide).toContain("Heading 1");
    expect(p.guide).toContain("8.5 x 11 in");
  });
});

describe("Excel template extraction", () => {
  const p = extractTemplate(fixture("brand-template.xlsx"), "brand-template.xlsx");
  const summary = p.excel?.sheets.find((s) => s.name === "Summary");

  it("reads the theme and workbook structure", () => {
    expect(p.kind).toBe("excel");
    expect(p.theme?.colors.accent1).toBe("1F3A5F");
    expect(p.excel?.sheets.map((s) => s.name)).toEqual(["Summary", "Data"]);
  });

  it("reads sheet layout settings", () => {
    expect(summary).toMatchObject({ frozenAt: "A2", showGridLines: false, tabColor: "D98E04", orientation: "landscape", header: "Acme Advisory" });
    expect(summary?.columnWidths).toContainEqual({ columns: "A", width: 28 });
  });

  it("reads the header row style", () => {
    expect(summary?.headerRow).toMatchObject({ font: "Arial", bold: true, color: "FFFFFF", fill: "1F3A5F", align: "center" });
  });

  it("reads number formats, named styles and table styles", () => {
    expect(p.excel?.numberFormats).toEqual(expect.arrayContaining(["#,##0.00;[Red](#,##0.00)", "0.0%"]));
    expect(p.excel?.cellStyles).toContain("VOLT Header");
    expect(p.excel?.tables).toContainEqual({ name: "EntityAmounts", sheet: "Data", style: "TableStyleMedium2" });
  });
});

describe("PowerPoint template extraction", () => {
  const p = extractTemplate(fixture("brand-template.pptx"), "brand-template.pptx");

  it("reads slide size and theme", () => {
    expect(p.kind).toBe("powerpoint");
    expect(p.powerpoint?.slideSize).toEqual({ widthIn: 13.33, heightIn: 7.5, aspect: "16:9" });
    expect(p.theme?.fonts.major).toBe("Montserrat");
  });

  it("resolves master text styles to theme fonts", () => {
    expect(p.powerpoint?.textStyles.title).toMatchObject({ sizePt: 44, font: "Montserrat", align: "center" });
    expect(p.powerpoint?.textStyles.body[0]).toMatchObject({ sizePt: 32, font: "Source Sans Pro" });
  });

  it("lists layouts with placeholders and the slides that use them", () => {
    const layouts = p.powerpoint!.layouts;
    expect(layouts).toHaveLength(11);
    expect(layouts[0]).toMatchObject({ name: "VOLT Title", type: "title", usedBySlides: 1 });
    expect(layouts[0].placeholders.map((ph) => ph.type)).toContain("ctrTitle");
    expect(layouts[0].placeholders.every((ph) => ph.w > 0 && ph.h > 0)).toBe(true);
    expect(p.powerpoint?.slides.map((s) => s.layout)).toEqual(["VOLT Title", "Title and Content"]);
  });
});

describe("unsafe or unsupported uploads are rejected", () => {
  const docx = fixture("brand-template.docx");

  it("rejects unsupported and macro-enabled types", () => {
    expect(errorCode(() => extractTemplate(docx, "notes.txt"))).toBe("unsupported_type");
    expect(errorCode(() => extractTemplate(docx, "deck.pptm"))).toBe("unsupported_type");
  });

  it("rejects files that are not Office packages", () => {
    expect(errorCode(() => extractTemplate(strToU8("hello"), "fake.docx"))).toBe("invalid_file");
    expect(errorCode(() => extractTemplate(zipSync({ "a.txt": strToU8("x") }), "fake.docx"))).toBe("invalid_file");
  });

  it("rejects a package whose content does not match its extension", () => {
    expect(errorCode(() => extractTemplate(docx, "renamed.xlsx"))).toBe("type_mismatch");
  });

  it("rejects XML with a DOCTYPE (entity expansion)", () => {
    const evil = zipSync({
      "[Content_Types].xml": strToU8('<?xml version="1.0"?><Types><Override PartName="/word/document.xml"/></Types>'),
      "word/document.xml": strToU8('<?xml version="1.0"?><!DOCTYPE x [<!ENTITY a "aaaa">]><w:document/>'),
    });
    expect(errorCode(() => extractTemplate(evil, "evil.docx"))).toBe("invalid_file");
  });

  it("stops inflating a part that expands past the limit (zip bomb)", () => {
    const bomb = zipSync(
      {
        "[Content_Types].xml": strToU8('<?xml version="1.0"?><Types><Override PartName="/word/document.xml"/></Types>'),
        "word/document.xml": new Uint8Array(40 * 1024 * 1024),
      },
      { level: 9 },
    );
    expect(bomb.length).toBeLessThan(1024 * 1024);
    expect(errorCode(() => extractTemplate(bomb, "bomb.docx"))).toBe("too_large");
  });
});

describe("logo extraction", () => {
  it("takes the logo from a Word header", () => {
    const { profile, logo } = analyseTemplate(fixture("brand-template.docx"), "brand-template.docx");
    expect(logo?.type).toBe("image/png");
    expect(Buffer.from(logo!.data.subarray(1, 4)).toString("ascii")).toBe("PNG");
    expect(profile.logo).toMatchObject({ type: "image/png", sizeBytes: logo!.data.length });
  });

  it("takes the logo from the PowerPoint slide master", () => {
    const { logo } = analyseTemplate(fixture("brand-template.pptx"), "brand-template.pptx");
    expect(logo).toMatchObject({ type: "image/png", fileName: "brand-logo.png" });
  });

  it("returns no logo when the template has none", () => {
    expect(analyseTemplate(fixture("brand-template.xlsx"), "brand-template.xlsx").logo).toBeUndefined();
  });
});
