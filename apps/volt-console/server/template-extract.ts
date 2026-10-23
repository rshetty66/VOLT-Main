/**
 * Template import: extract the formatting of an uploaded Word, Excel or PowerPoint
 * template into a TemplateProfile (theme, styles, page setup, layouts, cell formats),
 * a Markdown formatting guide for agents, and the logo from its header or slide master.
 * server/templates.ts turns the result into a template in the library.
 *
 * Office files are ZIP packages of XML. Uploads are untrusted, so the package is read
 * with a small bounded ZIP reader (no ZIP64, no encryption, per-part and total
 * inflate limits) and XML is parsed with entity processing off; any DOCTYPE is
 * refused. Only the XML parts the extractor needs are inflated; media is never read.
 */
import crypto from "node:crypto";
import path from "node:path";
import { Inflate } from "fflate";
import { XMLParser } from "fast-xml-parser";
import {
  MAX_TEMPLATE_BYTES,
  type CellStyle,
  type ExcelFormat,
  type ExcelSheet,
  type Placeholder,
  type PowerPointFormat,
  type TemplateKind,
  type TemplateProfile,
  type TextStyle,
  type ThemeInfo,
  type WordFormat,
} from "../shared/template-profile.js";

export type TemplateErrorCode = "unsupported_type" | "invalid_file" | "type_mismatch" | "too_large";

export class TemplateError extends Error {
  constructor(
    public code: TemplateErrorCode,
    message: string,
  ) {
    super(message);
  }
}

const PART_LIMIT = 20 * 1024 * 1024;
const TOTAL_LIMIT = 64 * 1024 * 1024;
const MAX_ENTRIES = 5000;

const KIND_BY_EXT: Record<string, TemplateKind> = {
  ".docx": "word",
  ".dotx": "word",
  ".xlsx": "excel",
  ".xltx": "excel",
  ".pptx": "powerpoint",
  ".potx": "powerpoint",
};

// ── Bounded ZIP reader ───────────────────────────────────────────────────────

interface Entry {
  method: number;
  compSize: number;
  size: number;
  localOffset: number;
}

class Package {
  private entries = new Map<string, Entry>();
  private cache = new Map<string, string>();
  private inflated = 0;

  constructor(private data: Uint8Array) {
    const v = new DataView(data.buffer, data.byteOffset, data.byteLength);
    if (data.length < 22 || v.getUint32(0, true) !== 0x04034b50) throw new TemplateError("invalid_file", "Not an Office file (not a ZIP package).");
    let eocd = -1;
    for (let i = data.length - 22; i >= Math.max(0, data.length - 22 - 65535); i--) {
      if (v.getUint32(i, true) === 0x06054b50) {
        eocd = i;
        break;
      }
    }
    if (eocd < 0) throw new TemplateError("invalid_file", "The file is damaged (no ZIP directory).");
    const count = v.getUint16(eocd + 10, true);
    const cdOffset = v.getUint32(eocd + 16, true);
    if (count === 0xffff || cdOffset === 0xffffffff) throw new TemplateError("invalid_file", "ZIP64 packages are not supported for templates.");
    if (count > MAX_ENTRIES) throw new TemplateError("too_large", `The package has more than ${MAX_ENTRIES} parts.`);
    const utf8 = new TextDecoder();
    let p = cdOffset;
    for (let n = 0; n < count; n++) {
      if (p + 46 > data.length || v.getUint32(p, true) !== 0x02014b50) throw new TemplateError("invalid_file", "The file is damaged (bad ZIP directory).");
      const flags = v.getUint16(p + 8, true);
      const nameLen = v.getUint16(p + 28, true);
      const name = utf8.decode(data.subarray(p + 46, p + 46 + nameLen));
      if (flags & 1) throw new TemplateError("invalid_file", "Password-protected files cannot be read. Remove the password and upload again.");
      this.entries.set(name, {
        method: v.getUint16(p + 10, true),
        compSize: v.getUint32(p + 20, true),
        size: v.getUint32(p + 24, true),
        localOffset: v.getUint32(p + 42, true),
      });
      p += 46 + nameLen + v.getUint16(p + 30, true) + v.getUint16(p + 32, true);
    }
  }

  names() {
    return [...this.entries.keys()];
  }

  has(name: string) {
    return this.entries.has(name);
  }

  /** Bytes of one part, inflated within the limits; null when absent. */
  bytes(name: string): Uint8Array | null {
    const e = this.entries.get(name);
    if (!e) return null;
    const v = new DataView(this.data.buffer, this.data.byteOffset, this.data.byteLength);
    if (e.localOffset + 30 > this.data.length || v.getUint32(e.localOffset, true) !== 0x04034b50) throw new TemplateError("invalid_file", `The file is damaged (${name}).`);
    const start = e.localOffset + 30 + v.getUint16(e.localOffset + 26, true) + v.getUint16(e.localOffset + 28, true);
    if (start + e.compSize > this.data.length) throw new TemplateError("invalid_file", `The file is damaged (${name}).`);
    const comp = this.data.subarray(start, start + e.compSize);
    let bytes: Uint8Array;
    if (e.method === 0) {
      bytes = comp;
    } else if (e.method === 8) {
      const chunks: Uint8Array[] = [];
      let total = 0;
      const inflater = new Inflate((chunk) => {
        total += chunk.length;
        if (total > PART_LIMIT) throw new TemplateError("too_large", `Part ${name} expands past ${PART_LIMIT / 1024 / 1024} MB.`);
        chunks.push(chunk);
      });
      try {
        for (let i = 0; i < comp.length; i += 4096) inflater.push(comp.subarray(i, i + 4096), i + 4096 >= comp.length);
        if (comp.length === 0) inflater.push(new Uint8Array(0), true);
      } catch (err) {
        if (err instanceof TemplateError) throw err;
        throw new TemplateError("invalid_file", `The file is damaged (${name}).`);
      }
      bytes = new Uint8Array(total);
      let o = 0;
      for (const c of chunks) {
        bytes.set(c, o);
        o += c.length;
      }
    } else {
      throw new TemplateError("invalid_file", `Unsupported compression in ${name}.`);
    }
    if (bytes.length > PART_LIMIT) throw new TemplateError("too_large", `Part ${name} is larger than ${PART_LIMIT / 1024 / 1024} MB.`);
    this.inflated += bytes.length;
    if (this.inflated > TOTAL_LIMIT) throw new TemplateError("too_large", "The template expands past the size limit.");
    return bytes;
  }

  /** UTF-8 text of one part, inflated within the limits; null when absent. */
  text(name: string): string | null {
    const hit = this.cache.get(name);
    if (hit !== undefined) return hit;
    const bytes = this.bytes(name);
    if (bytes === null) return null;
    const text = new TextDecoder().decode(bytes).replace(/^\uFEFF/, "");
    this.cache.set(name, text);
    return text;
  }
}

// ── XML helpers ──────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type X = any;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  processEntities: false,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
});

function parseXml(text: string | null, part: string): X {
  if (text === null) return null;
  if (/<!DOCTYPE/i.test(text)) throw new TemplateError("invalid_file", `Refused ${part}: XML with a DOCTYPE is not allowed in Office files.`);
  try {
    return parser.parse(text);
  } catch {
    throw new TemplateError("invalid_file", `The file is damaged (${part} is not valid XML).`);
  }
}

const xmlOf = (pkg: Package, part: string) => parseXml(pkg.text(part), part);
const arr = <T = X>(x: T | T[] | undefined | null): T[] => (x === undefined || x === null ? [] : Array.isArray(x) ? x : [x]);
const decode = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&");
const str = (x: X): string | undefined => (x === undefined || x === null ? undefined : typeof x === "object" ? (x["#text"] !== undefined ? String(x["#text"]) : undefined) : String(x));
const num = (x: X): number | undefined => {
  const n = Number(x);
  return x === undefined || x === null || x === "" || Number.isNaN(n) ? undefined : n;
};
const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
const hex = (s?: string) => (s && /^[0-9a-f]{6,8}$/i.test(s) ? s.slice(-6).toUpperCase() : undefined);
/** OOXML on/off element: present and not explicitly false. */
const on = (node: X, key: string): boolean | undefined => {
  if (!node || !(key in node)) return undefined;
  const val = node[key]?.["@w:val"] ?? node[key]?.["@val"];
  return !(val === "0" || val === "false" || val === "off");
};
const prune = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

/** All text inside a node, joined per paragraph. */
function textOf(node: X, tKey: string, pKey: string): string[] {
  const out: string[] = [];
  const walk = (n: X, acc: string[]) => {
    if (n === null || typeof n !== "object") return;
    for (const [k, v] of Object.entries(n)) {
      if (k.startsWith("@")) continue;
      if (k === pKey) {
        for (const para of arr(v)) {
          const parts: string[] = [];
          walk(para, parts);
          const line = decode(parts.join("")).replace(/\s+/g, " ").trim();
          if (line) out.push(line);
        }
      } else if (k === tKey) {
        for (const t of arr(v)) acc.push(str(t) ?? (typeof t === "string" ? t : ""));
      } else {
        for (const child of arr(v)) walk(child, acc);
      }
    }
  };
  walk(node, []);
  return out;
}

/** Relationships of a part: rId -> { target path in the package, type }. */
function relsOf(pkg: Package, part: string): Map<string, { target: string; type: string }> {
  const dir = path.posix.dirname(part);
  const relsPart = path.posix.join(dir, "_rels", `${path.posix.basename(part)}.rels`);
  const doc = xmlOf(pkg, relsPart);
  const out = new Map<string, { target: string; type: string }>();
  for (const r of arr(doc?.Relationships?.Relationship)) {
    if (r["@TargetMode"] === "External") continue;
    const t = String(r["@Target"] ?? "");
    const target = t.startsWith("/") ? t.slice(1) : path.posix.normalize(path.posix.join(dir, t));
    out.set(String(r["@Id"]), { target, type: String(r["@Type"] ?? "") });
  }
  return out;
}

/** The first PNG or JPEG image a part links to (a logo in a header or on a slide master). */
function firstImage(pkg: Package, parts: string[]): string | undefined {
  for (const part of parts) {
    for (const r of relsOf(pkg, part).values()) {
      if (r.type.endsWith("/image") && /\.(png|jpe?g)$/i.test(r.target) && pkg.has(r.target)) return r.target;
    }
  }
  return undefined;
}

// ── Theme ────────────────────────────────────────────────────────────────────

const THEME_SLOTS = ["dk1", "lt1", "dk2", "lt2", "accent1", "accent2", "accent3", "accent4", "accent5", "accent6", "hlink", "folHlink"];

function parseTheme(pkg: Package, part: string | undefined): ThemeInfo | null {
  if (!part) return null;
  const t = xmlOf(pkg, part)?.["a:theme"];
  if (!t) return null;
  const scheme = t["a:themeElements"]?.["a:clrScheme"] ?? {};
  const colors: Record<string, string> = {};
  for (const slot of THEME_SLOTS) {
    const node = scheme[`a:${slot}`];
    const c = hex(node?.["a:srgbClr"]?.["@val"]) ?? hex(node?.["a:sysClr"]?.["@lastClr"]);
    if (c) colors[slot] = c;
  }
  const fonts = t["a:themeElements"]?.["a:fontScheme"] ?? {};
  return {
    name: decode(String(t["@name"] ?? "Theme")),
    colors,
    fonts: {
      major: decode(String(fonts["a:majorFont"]?.["a:latin"]?.["@typeface"] ?? "")),
      minor: decode(String(fonts["a:minorFont"]?.["a:latin"]?.["@typeface"] ?? "")),
    },
  };
}

class Context {
  warnings = new Set<string>();
  constructor(public theme: ThemeInfo | null) {}
  themeColor(slot: string | undefined): string | undefined {
    if (!slot) return undefined;
    const alias: Record<string, string> = {
      text1: "dk1", dark1: "dk1", tx1: "dk1", background1: "lt1", light1: "lt1", bg1: "lt1",
      text2: "dk2", dark2: "dk2", tx2: "dk2", background2: "lt2", light2: "lt2", bg2: "lt2",
      hyperlink: "hlink", followedHyperlink: "folHlink",
    };
    return this.theme?.colors[alias[slot] ?? slot];
  }
  themeFont(ref: string | undefined): string | undefined {
    if (!ref) return undefined;
    if (/^major/i.test(ref) || ref.startsWith("+mj")) return this.theme?.fonts.major || undefined;
    if (/^minor/i.test(ref) || ref.startsWith("+mn")) return this.theme?.fonts.minor || undefined;
    return decode(ref);
  }
}

// ── Word ─────────────────────────────────────────────────────────────────────

const KEY_WORD_STYLES = [
  "normal", "title", "subtitle", "heading 1", "heading 2", "heading 3", "heading 4", "heading 5", "heading 6",
  "quote", "intense quote", "caption", "list paragraph", "list bullet", "list number", "toc heading",
  "header", "footer", "footnote text", "hyperlink", "table grid",
];
/** Built-in style names are stored in lower case ("heading 1"); Word shows them in title case. */
const displayStyleName = (name: string) =>
  name === name.toLowerCase() && KEY_WORD_STYLES.includes(name)
    ? name.replace(/\b\w/g, (c) => c.toUpperCase()).replace(/^Toc /, "TOC ")
    : name;
const WORD_ALIGN: Record<string, string> ={ both: "justify", start: "left", end: "right", left: "left", center: "center", right: "right", distribute: "justify" };

function wordRun(rPr: X, ctx: Context): Partial<TextStyle> {
  if (!rPr || typeof rPr !== "object") return {};
  const f = rPr["w:rFonts"];
  const color = rPr["w:color"];
  if (color?.["@w:themeTint"] || color?.["@w:themeShade"]) ctx.warnings.add("Some colours use a tint or shade of a theme colour; they are shown at the base theme colour.");
  return prune({
    // Word gives a theme font attribute precedence over an explicit font name in the same element.
    font: f ? (ctx.themeFont(f["@w:asciiTheme"] ?? f["@w:hAnsiTheme"]) ?? (f["@w:ascii"] ? decode(f["@w:ascii"]) : f["@w:hAnsi"] ? decode(f["@w:hAnsi"]) : undefined)) : undefined,
    sizePt: num(rPr["w:sz"]?.["@w:val"]) !== undefined ? num(rPr["w:sz"]["@w:val"])! / 2 : undefined,
    bold: on(rPr, "w:b"),
    italic: on(rPr, "w:i"),
    color: color ? (color["@w:themeColor"] ? ctx.themeColor(color["@w:themeColor"]) : hex(color["@w:val"])) : undefined,
  });
}

function wordPara(pPr: X): Partial<TextStyle> {
  if (!pPr || typeof pPr !== "object") return {};
  const sp = pPr["w:spacing"];
  const line = num(sp?.["@w:line"]);
  const rule = sp?.["@w:lineRule"] ?? "auto";
  return prune({
    spaceBeforePt: num(sp?.["@w:before"]) !== undefined ? round(num(sp["@w:before"])! / 20, 1) : undefined,
    spaceAfterPt: num(sp?.["@w:after"]) !== undefined ? round(num(sp["@w:after"])! / 20, 1) : undefined,
    lineSpacing: line === undefined ? undefined : rule === "auto" ? `${round(line / 240)}x` : `${round(line / 20, 1)} pt`,
    align: pPr["w:jc"]?.["@w:val"] ? WORD_ALIGN[pPr["w:jc"]["@w:val"]] ?? pPr["w:jc"]["@w:val"] : undefined,
  });
}

function extractWord(pkg: Package, main: string): { theme: ThemeInfo | null; word: WordFormat; warnings: string[]; logoPart?: string } {
  const dir = path.posix.dirname(main);
  const docRels = relsOf(pkg, main);
  const rel = (suffix: string) => [...docRels.values()].filter((r) => r.type.endsWith(suffix)).map((r) => r.target);
  const themePart = rel("/theme")[0] ?? (pkg.has(`${dir}/theme/theme1.xml`) ? `${dir}/theme/theme1.xml` : undefined);
  const ctx = new Context(parseTheme(pkg, themePart));
  const doc = xmlOf(pkg, main);
  const body = doc?.["w:document"]?.["w:body"];

  // Styles, resolved through basedOn over the document defaults.
  const styles = xmlOf(pkg, rel("/styles")[0] ?? `${dir}/styles.xml`)?.["w:styles"] ?? {};
  const dd = styles["w:docDefaults"] ?? {};
  const defaults: TextStyle = { name: "Document defaults", ...wordRun(dd["w:rPrDefault"]?.["w:rPr"], ctx), ...wordPara(dd["w:pPrDefault"]?.["w:pPr"]) };
  const raw = new Map<string, X>();
  for (const s of arr(styles["w:style"])) raw.set(String(s["@w:styleId"]), s);
  const memo = new Map<string, TextStyle>();
  const effective = (id: string, seen = new Set<string>()): TextStyle => {
    const hit = memo.get(id);
    if (hit) return hit;
    const s = raw.get(id);
    const parentId = s?.["w:basedOn"]?.["@w:val"];
    const parent = parentId && raw.has(parentId) && !seen.has(parentId) ? effective(parentId, seen.add(id)) : defaults;
    const own = { ...wordRun(s?.["w:rPr"], ctx), ...wordPara(s?.["w:pPr"]) };
    const name = displayStyleName(decode(String(s?.["w:name"]?.["@w:val"] ?? id)));
    const out: TextStyle = prune({
      ...parent,
      ...own,
      name,
      type: s?.["@w:type"],
      basedOn: parentId ? displayStyleName(decode(String(raw.get(parentId)?.["w:name"]?.["@w:val"] ?? parentId))) : undefined,
      used: undefined,
    });
    memo.set(id, out);
    return out;
  };

  const usedIds = new Set<string>();
  const scan = [pkg.text(main) ?? "", ...rel("/header").map((p) => pkg.text(p) ?? ""), ...rel("/footer").map((p) => pkg.text(p) ?? "")].join("");
  for (const m of scan.matchAll(/<w:(?:pStyle|rStyle|tblStyle) w:val="([^"]+)"/g)) usedIds.add(m[1]);
  const defaultPara = [...raw.values()].find((s) => s["@w:type"] === "paragraph" && (s["@w:default"] === "1" || s["@w:default"] === "true"));
  if (defaultPara && /<w:p[ >]/.test(scan)) usedIds.add(String(defaultPara["@w:styleId"]));

  const picked = [...raw.entries()]
    .filter(([id, s]) => {
      if (usedIds.has(id)) return true;
      // Word auto-creates "<Style> Char" character styles linked to paragraph styles; they mirror the paragraph style.
      if (s["@w:type"] === "character" && s["w:link"]) return false;
      const name = String(s["w:name"]?.["@w:val"] ?? id).toLowerCase();
      return KEY_WORD_STYLES.includes(name) || s["@w:customStyle"] === "1";
    })
    .map(([id]) => {
      const e: TextStyle = { ...effective(id), used: usedIds.has(id) };
      if (e.type === "character") {
        delete e.spaceBeforePt;
        delete e.spaceAfterPt;
        delete e.lineSpacing;
        delete e.align;
      }
      return e;
    });
  const rank = (s: TextStyle) => {
    const i = KEY_WORD_STYLES.indexOf(s.name.toLowerCase());
    return i < 0 ? 100 : i;
  };
  picked.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  if (picked.length > 40) ctx.warnings.add(`The template defines ${picked.length} relevant styles; the first 40 are listed.`);

  // Page setup from the body's final section.
  const sect = arr(body?.["w:sectPr"]).at(-1) ?? {};
  const pg = sect["w:pgSz"] ?? {};
  const mar = sect["w:pgMar"] ?? {};
  const inch = (v: X) => (num(v) === undefined ? undefined : round(num(v)! / 1440));
  const w = inch(pg["@w:w"]) ?? 8.5;
  const h = inch(pg["@w:h"]) ?? 11;
  if (!sect["w:pgSz"]) ctx.warnings.add("No page size is set; Letter (8.5 x 11 in) is assumed.");

  const lines = (parts: string[]) => [...new Set(parts.flatMap((p) => textOf(xmlOf(pkg, p), "w:t", "w:p")))].map((l) => l.slice(0, 200));
  const fontTable = xmlOf(pkg, rel("/fontTable")[0] ?? `${dir}/fontTable.xml`);

  return {
    theme: ctx.theme,
    warnings: [...ctx.warnings],
    logoPart: firstImage(pkg, rel("/header")),
    word: {
      page: {
        widthIn: w,
        heightIn: h,
        orientation: pg["@w:orient"] === "landscape" || w > h ? "landscape" : "portrait",
        marginsIn: prune({ top: inch(mar["@w:top"]) ?? 1, right: inch(mar["@w:right"]) ?? 1, bottom: inch(mar["@w:bottom"]) ?? 1, left: inch(mar["@w:left"]) ?? 1, header: inch(mar["@w:header"]), footer: inch(mar["@w:footer"]) }),
        columns: num(sect["w:cols"]?.["@w:num"]),
      },
      defaults,
      styles: picked.slice(0, 40),
      headers: lines(rel("/header")),
      footers: lines(rel("/footer")),
      fonts: arr(fontTable?.["w:fonts"]?.["w:font"]).map((f) => decode(String(f["@w:name"]))).filter(Boolean),
    },
  };
}

// ── Excel ────────────────────────────────────────────────────────────────────

/** SpreadsheetML theme colour indexes swap the first two pairs. */
const EXCEL_THEME = ["lt1", "dk1", "lt2", "dk2", "accent1", "accent2", "accent3", "accent4", "accent5", "accent6", "hlink", "folHlink"];
const BUILTIN_NUMFMT: Record<number, string> = {
  1: "0", 2: "0.00", 3: "#,##0", 4: "#,##0.00", 9: "0%", 10: "0.00%", 11: "0.00E+00", 12: "# ?/?", 13: "# ??/??",
  14: "mm-dd-yy", 15: "d-mmm-yy", 16: "d-mmm", 17: "mmm-yy", 18: "h:mm AM/PM", 19: "h:mm:ss AM/PM", 20: "h:mm", 21: "h:mm:ss",
  22: "m/d/yy h:mm", 37: "#,##0 ;(#,##0)", 38: "#,##0 ;[Red](#,##0)", 39: "#,##0.00;(#,##0.00)", 40: "#,##0.00;[Red](#,##0.00)", 49: "@",
};

function colLetters(n: number): string {
  let s = "";
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s;
  return s;
}

function cleanHeaderFooter(s: string | undefined): string | undefined {
  if (!s) return undefined;
  const out = decode(s)
    .replace(/&K[0-9A-Fa-f]{6}/g, "")
    .replace(/&"[^"]*"/g, "")
    .replace(/&\d+/g, "")
    .replace(/&&/g, "\u0000")
    .replace(/&[A-Za-z]/g, " ")
    .replace(/\u0000/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  return out || undefined;
}

function extractExcel(pkg: Package, main: string): { theme: ThemeInfo | null; excel: ExcelFormat; warnings: string[] } {
  const wbRels = relsOf(pkg, main);
  const rel = (suffix: string) => [...wbRels.values()].filter((r) => r.type.endsWith(suffix)).map((r) => r.target);
  const ctx = new Context(parseTheme(pkg, rel("/theme")[0]));
  const color = (c: X): string | undefined => {
    if (!c) return undefined;
    if (c["@tint"] && Number(c["@tint"]) !== 0) ctx.warnings.add("Some colours use a tint of a theme colour; they are shown at the base theme colour.");
    return hex(c["@rgb"]) ?? (num(c["@theme"]) !== undefined ? ctx.themeColor(EXCEL_THEME.at(num(c["@theme"])!)) : undefined);
  };

  const ss = xmlOf(pkg, rel("/styles")[0] ?? "xl/styles.xml")?.styleSheet ?? {};
  const customFmts = new Map<number, string>(arr(ss.numFmts?.numFmt).map((f) => [Number(f["@numFmtId"]), decode(String(f["@formatCode"]))]));
  const fmt = (id: number) => customFmts.get(id) ?? BUILTIN_NUMFMT[id];
  const fonts: CellStyle[] = arr(ss.fonts?.font).map((f) =>
    prune({ font: f.name?.["@val"] ? decode(f.name["@val"]) : undefined, sizePt: num(f.sz?.["@val"]), bold: on(f, "b"), italic: on(f, "i"), color: color(f.color) }),
  );
  const fills: (string | undefined)[] = arr(ss.fills?.fill).map((f) => (f.patternFill?.["@patternType"] === "solid" ? color(f.patternFill.fgColor) : undefined));
  const xfs = arr(ss.cellXfs?.xf);
  const cellStyle = (s: number): CellStyle | undefined => {
    const xf = xfs.at(s);
    if (!xf) return undefined;
    const font = fonts.at(num(xf["@fontId"]) ?? 0) ?? {};
    const nf = num(xf["@numFmtId"]) ?? 0;
    return prune({ ...font, fill: fills.at(num(xf["@fillId"]) ?? 0), numberFormat: nf ? fmt(nf) : undefined, align: xf.alignment?.["@horizontal"] });
  };
  const usedFmts = new Set<string>(customFmts.values());
  for (const xf of xfs) {
    const id = num(xf["@numFmtId"]) ?? 0;
    if (id && fmt(id)) usedFmts.add(fmt(id));
  }

  const tables: ExcelFormat["tables"] = [];
  const sheets: ExcelSheet[] = arr(xmlOf(pkg, main)?.workbook?.sheets?.sheet).map((sh) => {
    const name = decode(String(sh["@name"]));
    const part = wbRels.get(String(sh["@r:id"]))?.target;
    const ws = part ? xmlOf(pkg, part)?.worksheet : null;
    if (!ws) return { name, showGridLines: true, columnWidths: [] };
    const view = arr(ws.sheetViews?.sheetView)[0] ?? {};
    const pane = view.pane;
    const firstRow = arr(ws.sheetData?.row)[0];
    const counts = new Map<number, number>();
    for (const c of arr(firstRow?.c)) {
      const s = num(c["@s"]);
      if (s) counts.set(s, (counts.get(s) ?? 0) + 1);
    }
    const headerXf = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    for (const r of part ? relsOf(pkg, part).values() : []) {
      if (!r.type.endsWith("/table")) continue;
      const t = xmlOf(pkg, r.target)?.table;
      if (t) tables.push({ name: decode(String(t["@displayName"] ?? t["@name"])), sheet: name, style: String(t.tableStyleInfo?.["@name"] ?? "none") });
    }
    return prune({
      name,
      tabColor: color(ws.sheetPr?.tabColor),
      frozenAt: pane && String(pane["@state"] ?? "").startsWith("frozen") ? pane["@topLeftCell"] : undefined,
      showGridLines: view["@showGridLines"] !== "0" && view["@showGridLines"] !== "false",
      zoomPct: num(view["@zoomScale"]),
      orientation: ws.pageSetup?.["@orientation"],
      columnWidths: arr(ws.cols?.col).map((c) => {
        const a = colLetters(Number(c["@min"]));
        const b = colLetters(Number(c["@max"]));
        return { columns: a === b ? a : `${a}:${b}`, width: round(Number(c["@width"])) };
      }),
      header: cleanHeaderFooter(str(ws.headerFooter?.oddHeader)),
      footer: cleanHeaderFooter(str(ws.headerFooter?.oddFooter)),
      headerRow: headerXf ? cellStyle(headerXf) : undefined,
    }) as ExcelSheet;
  });

  const distinct = <T>(xs: T[]) => [...new Map(xs.map((x) => [JSON.stringify(x), x])).values()];
  return {
    theme: ctx.theme,
    warnings: [...ctx.warnings],
    excel: prune({
      defaultFont: fonts[0],
      sheets,
      cellStyles: arr(ss.cellStyles?.cellStyle).map((c) => decode(String(c["@name"]))),
      numberFormats: [...usedFmts],
      fonts: distinct(fonts).slice(0, 12),
      fills: distinct(fills.filter((f): f is string => !!f)),
      tables,
    }) as ExcelFormat,
  };
}

// ── PowerPoint ───────────────────────────────────────────────────────────────

const EMU_PER_INCH = 914400;
const PPT_ALIGN: Record<string, string> = { l: "left", ctr: "center", r: "right", just: "justify", dist: "justify" };

function extractPowerPoint(pkg: Package, main: string): { theme: ThemeInfo | null; powerpoint: PowerPointFormat; warnings: string[]; logoPart?: string } {
  const pres = xmlOf(pkg, main)?.["p:presentation"] ?? {};
  const presRels = relsOf(pkg, main);
  const masterIds = arr(pres["p:sldMasterIdLst"]?.["p:sldMasterId"]);
  const masterPart = presRels.get(String(masterIds[0]?.["@r:id"]))?.target ?? [...presRels.values()].find((r) => r.type.endsWith("/slideMaster"))?.target;
  const masterRels = masterPart ? relsOf(pkg, masterPart) : new Map<string, { target: string; type: string }>();
  const ctx = new Context(parseTheme(pkg, [...masterRels.values()].find((r) => r.type.endsWith("/theme"))?.target));
  const master = masterPart ? xmlOf(pkg, masterPart)?.["p:sldMaster"] : null;
  if (!master) ctx.warnings.add("No slide master was found.");
  const clrMap: Record<string, string> = master?.["p:clrMap"] ? Object.fromEntries(Object.entries(master["p:clrMap"]).map(([k, v]) => [k.slice(1), String(v)])) : {};
  const fill = (node: X): string | undefined => {
    const sf = node?.["a:solidFill"] ?? node;
    if (!sf) return undefined;
    if (sf["a:srgbClr"]) return hex(sf["a:srgbClr"]["@val"]);
    const scheme = sf["a:schemeClr"]?.["@val"];
    if (!scheme) return undefined;
    if (sf["a:schemeClr"]["a:lumMod"] || sf["a:schemeClr"]["a:tint"] || sf["a:schemeClr"]["a:shade"]) ctx.warnings.add("Some colours use a tint or shade of a theme colour; they are shown at the base theme colour.");
    return ctx.themeColor(clrMap[scheme] ?? scheme);
  };
  const level = (lvl: X, name: string): TextStyle | undefined => {
    if (!lvl) return undefined;
    const r = lvl["a:defRPr"] ?? {};
    return prune({
      name,
      font: ctx.themeFont(r["a:latin"]?.["@typeface"]),
      sizePt: num(r["@sz"]) !== undefined ? num(r["@sz"])! / 100 : undefined,
      bold: r["@b"] === undefined ? undefined : r["@b"] === "1" || r["@b"] === "true",
      italic: r["@i"] === undefined ? undefined : r["@i"] === "1" || r["@i"] === "true",
      color: fill(r),
      align: lvl["@algn"] ? PPT_ALIGN[lvl["@algn"]] ?? lvl["@algn"] : undefined,
    });
  };
  const tx = master?.["p:txStyles"] ?? {};
  const body = [1, 2, 3].map((i) => level(tx["p:bodyStyle"]?.[`a:lvl${i}pPr`], `Body level ${i}`)).filter((s): s is TextStyle => !!s);

  const cx = num(pres["p:sldSz"]?.["@cx"]) ?? 9144000;
  const cy = num(pres["p:sldSz"]?.["@cy"]) ?? 6858000;
  const ratio = cx / cy;
  const aspect = ([["16:9", 16 / 9], ["4:3", 4 / 3], ["16:10", 16 / 10], ["A4", 297 / 210], ["Letter", 11 / 8.5]] as const).find(([, r]) => Math.abs(r - ratio) < 0.01)?.[0] ?? `${round(ratio)}:1`;

  type Xfrm = { x: number; y: number; w: number; h: number };
  const xfrmOf = (sp: X): Xfrm | undefined => {
    const x = sp?.["p:spPr"]?.["a:xfrm"];
    if (!x?.["a:off"] || !x?.["a:ext"]) return undefined;
    return { x: Number(x["a:off"]["@x"]), y: Number(x["a:off"]["@y"]), w: Number(x["a:ext"]["@cx"]), h: Number(x["a:ext"]["@cy"]) };
  };
  const phOf = (sp: X) => sp?.["p:nvSpPr"]?.["p:nvPr"]?.["p:ph"];
  const masterPh = new Map<string, Xfrm>();
  for (const sp of arr(master?.["p:cSld"]?.["p:spTree"]?.["p:sp"])) {
    const ph = phOf(sp);
    const xf = xfrmOf(sp);
    if (ph && xf) masterPh.set(String(ph["@type"] ?? "body"), xf);
  }
  const inherit: Record<string, string> = { ctrTitle: "title", subTitle: "body", content: "body", obj: "body", pic: "body", chart: "body", tbl: "body", dgm: "body", media: "body", clipArt: "body" };
  const pct = (v: number, of: number) => round((v / of) * 100, 1);
  const placeholders = (doc: X): Placeholder[] =>
    arr(doc?.["p:cSld"]?.["p:spTree"]?.["p:sp"]).flatMap((sp) => {
      const ph = phOf(sp);
      if (ph === undefined) return [];
      const type = String(ph?.["@type"] ?? "content");
      const xf = xfrmOf(sp) ?? masterPh.get(type) ?? masterPh.get(inherit[type] ?? type);
      if (!xf) return [];
      return [{ type, name: decode(String(sp["p:nvSpPr"]?.["p:cNvPr"]?.["@name"] ?? type)), x: pct(xf.x, cx), y: pct(xf.y, cy), w: pct(xf.w, cx), h: pct(xf.h, cy) }];
    });

  const layoutIds = arr(master?.["p:sldLayoutIdLst"]?.["p:sldLayoutId"]).map((l) => masterRels.get(String(l["@r:id"]))?.target).filter((t): t is string => !!t);
  const layoutParts = layoutIds.length ? layoutIds : [...masterRels.values()].filter((r) => r.type.endsWith("/slideLayout")).map((r) => r.target);
  const layoutDocs = new Map<string, X>(layoutParts.map((p) => [p, xmlOf(pkg, p)?.["p:sldLayout"]]));
  const layoutName = (p: string) => decode(String(layoutDocs.get(p)?.["p:cSld"]?.["@name"] ?? path.posix.basename(p, ".xml")));

  const slides = arr(pres["p:sldIdLst"]?.["p:sldId"]).flatMap((s, i) => {
    const part = presRels.get(String(s["@r:id"]))?.target;
    if (!part) return [];
    const layoutPart = [...relsOf(pkg, part).values()].find((r) => r.type.endsWith("/slideLayout"))?.target;
    const doc = xmlOf(pkg, part)?.["p:sld"];
    const titleSp = arr(doc?.["p:cSld"]?.["p:spTree"]?.["p:sp"]).find((sp) => ["title", "ctrTitle"].includes(String(phOf(sp)?.["@type"])));
    const title = titleSp ? textOf(titleSp, "a:t", "a:p").join(" ").slice(0, 120) : undefined;
    return [prune({ index: i + 1, layout: layoutPart ? (layoutDocs.has(layoutPart) ? layoutName(layoutPart) : decode(String(xmlOf(pkg, layoutPart)?.["p:sldLayout"]?.["p:cSld"]?.["@name"] ?? "unknown"))) : "unknown", title, part: layoutPart })];
  });

  const bg = master?.["p:cSld"]?.["p:bg"];
  return {
    theme: ctx.theme,
    warnings: [...ctx.warnings],
    logoPart: firstImage(pkg, [...(masterPart ? [masterPart] : []), ...layoutParts.slice(0, 1)]),
    powerpoint: prune({
      slideSize: { widthIn: round(cx / EMU_PER_INCH), heightIn: round(cy / EMU_PER_INCH), aspect },
      slideCount: slides.length,
      masterCount: masterIds.length,
      background: bg ? fill(bg["p:bgPr"]) ?? fill(bg["p:bgRef"]) : undefined,
      masterImages: [...masterRels.values()].filter((r) => r.type.endsWith("/image")).length,
      textStyles: prune({ title: level(tx["p:titleStyle"]?.["a:lvl1pPr"], "Title"), body }),
      layouts: layoutParts.map((p) => ({
        name: layoutName(p),
        type: String(layoutDocs.get(p)?.["@type"] ?? "custom"),
        placeholders: placeholders(layoutDocs.get(p)),
        usedBySlides: slides.filter((s) => s.part === p).length,
      })),
      slides: slides.map(({ part: _p, ...s }) => s),
    }) as PowerPointFormat,
  };
}

// ── Formatting guide ─────────────────────────────────────────────────────────

const SLOT_LABEL: Record<string, string> = {
  dk1: "Dark 1 (text)", lt1: "Light 1 (background)", dk2: "Dark 2", lt2: "Light 2",
  accent1: "Accent 1", accent2: "Accent 2", accent3: "Accent 3", accent4: "Accent 4", accent5: "Accent 5", accent6: "Accent 6",
  hlink: "Hyperlink", folHlink: "Followed hyperlink",
};
export const PLACEHOLDER_LABEL: Record<string, string> = {
  title: "title", ctrTitle: "centred title", subTitle: "subtitle", body: "text", content: "content", obj: "content",
  dt: "date", ftr: "footer", sldNum: "slide number", pic: "picture", chart: "chart", tbl: "table", dgm: "diagram", media: "media", clipArt: "clip art", hdr: "header",
};
const cell = (s?: string | number) => (s === undefined || s === "" ? "-" : String(s).replace(/\|/g, "\\|"));
const styleRow = (s: TextStyle) =>
  `| ${cell(s.name)} | ${cell(s.font)} | ${cell(s.sizePt !== undefined ? `${s.sizePt} pt` : undefined)} | ${[s.bold ? "bold" : "", s.italic ? "italic" : ""].filter(Boolean).join(", ") || "regular"} | ${cell(s.color ? `#${s.color}` : undefined)} | ${cell([s.spaceBeforePt !== undefined ? `${s.spaceBeforePt} pt before` : "", s.spaceAfterPt !== undefined ? `${s.spaceAfterPt} pt after` : "", s.lineSpacing ? `line ${s.lineSpacing}` : "", s.align ?? ""].filter(Boolean).join(", "))} |`;
const cellStyleText = (c: CellStyle) =>
  [c.font, c.sizePt !== undefined ? `${c.sizePt} pt` : "", c.bold ? "bold" : "", c.italic ? "italic" : "", c.color ? `text #${c.color}` : "", c.fill ? `fill #${c.fill}` : "", c.align ? `${c.align}-aligned` : "", c.numberFormat ? `format \`${c.numberFormat}\`` : ""].filter(Boolean).join(", ");

export function formattingGuide(p: Omit<TemplateProfile, "guide">): string {
  const kindLabel = { word: "Word", excel: "Excel", powerpoint: "PowerPoint" }[p.kind];
  const skill = { word: "docx", excel: "xlsx", powerpoint: "pptx" }[p.kind];
  const carries = { word: "styles, headers and page setup", excel: "cell styles, number formats and sheet setup", powerpoint: "slide master and layouts" }[p.kind];
  const out = [
    `# Formatting guide: ${p.name}`,
    "",
    `Source: ${p.fileName} (${kindLabel} template). Apply this formatting to every deliverable built from this template. When producing the file with the ${skill} skill, start from the original template file so its ${carries} carry over.`,
  ];
  if (p.theme) {
    out.push("", "## Brand theme", "", `Theme "${p.theme.name}". Heading font: ${p.theme.fonts.major || "-"}. Body font: ${p.theme.fonts.minor || "-"}.`, "", "| Colour role | Hex |", "| --- | --- |");
    for (const slot of THEME_SLOTS) if (p.theme.colors[slot]) out.push(`| ${SLOT_LABEL[slot]} | #${p.theme.colors[slot]} |`);
  }
  if (p.word) {
    const w = p.word;
    const m = w.page.marginsIn;
    out.push("", "## Page setup", "", `- ${w.page.widthIn} x ${w.page.heightIn} in, ${w.page.orientation}${w.page.columns && w.page.columns > 1 ? `, ${w.page.columns} columns` : ""}`, `- Margins: top ${m.top} in, right ${m.right} in, bottom ${m.bottom} in, left ${m.left} in`);
    out.push("", "## Paragraph and character styles", "", "| Style | Font | Size | Weight | Colour | Spacing and alignment |", "| --- | --- | --- | --- | --- | --- |", styleRow(w.defaults), ...w.styles.map(styleRow));
    if (w.headers.length || w.footers.length) {
      out.push("", "## Headers and footers", "");
      for (const h of w.headers) out.push(`- Header: ${h}`);
      for (const f of w.footers) out.push(`- Footer: ${f}`);
    }
  }
  if (p.excel) {
    const x = p.excel;
    out.push("", "## Workbook layout", "", "| Sheet | Frozen at | Gridlines | Tab colour | Orientation | Header row style |", "| --- | --- | --- | --- | --- | --- |");
    for (const s of x.sheets) out.push(`| ${cell(s.name)} | ${cell(s.frozenAt)} | ${s.showGridLines ? "shown" : "hidden"} | ${cell(s.tabColor ? `#${s.tabColor}` : undefined)} | ${cell(s.orientation)} | ${cell(s.headerRow ? cellStyleText(s.headerRow) : undefined)} |`);
    if (x.defaultFont) out.push("", `Default cell font: ${cellStyleText(x.defaultFont)}.`);
    if (x.numberFormats.length) out.push("", "## Number formats", "", ...x.numberFormats.map((f) => `- \`${f}\``));
    if (x.cellStyles.length) out.push("", "## Named cell styles", "", x.cellStyles.join(", "));
    if (x.tables.length) out.push("", "## Table styles", "", ...x.tables.map((t) => `- ${t.name} (sheet ${t.sheet}): ${t.style}`));
    const hf = x.sheets.filter((s) => s.header || s.footer);
    if (hf.length) out.push("", "## Print headers and footers", "", ...hf.map((s) => `- ${s.name}: ${[s.header ? `header "${s.header}"` : "", s.footer ? `footer "${s.footer}"` : ""].filter(Boolean).join(", ")}`));
  }
  if (p.powerpoint) {
    const d = p.powerpoint;
    out.push("", "## Slide setup", "", `- ${d.slideSize.widthIn} x ${d.slideSize.heightIn} in (${d.slideSize.aspect}), ${d.layouts.length} layouts, ${d.slideCount} sample slides${d.background ? `, master background #${d.background}` : ""}${d.masterImages ? `, ${d.masterImages} image(s) on the master (logo or artwork)` : ""}`);
    const ts = [d.textStyles.title, ...d.textStyles.body].filter((s): s is TextStyle => !!s);
    if (ts.length) out.push("", "## Master text styles", "", "| Text | Font | Size | Weight | Colour | Alignment |", "| --- | --- | --- | --- | --- | --- |", ...ts.map((s) => `| ${s.name} | ${cell(s.font)} | ${cell(s.sizePt !== undefined ? `${s.sizePt} pt` : undefined)} | ${s.bold ? "bold" : "regular"} | ${cell(s.color ? `#${s.color}` : undefined)} | ${cell(s.align)} |`));
    out.push("", "## Slide layouts", "", "Use these layouts by name rather than placing text boxes freely.", "", "| Layout | Type | Placeholders | Used by sample slides |", "| --- | --- | --- | --- |");
    for (const l of d.layouts) out.push(`| ${cell(l.name)} | ${l.type} | ${cell(l.placeholders.map((ph) => PLACEHOLDER_LABEL[ph.type] ?? ph.type).join(", "))} | ${l.usedBySlides} |`);
  }
  if (p.warnings.length) out.push("", "## Notes", "", ...p.warnings.map((w) => `- ${w}`));
  return out.join("\n");
}

// ── Entry point ──────────────────────────────────────────────────────────────

const safeFileName = (name: string) =>
  path
    .basename(name.replace(/\\/g, "/"))
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .slice(0, 200) || "template";

export interface ExtractedLogo {
  data: Uint8Array;
  type: "image/png" | "image/jpeg";
  fileName: string;
}

/** Extract the formatting profile of an Office template. Throws TemplateError. */
export function extractTemplate(data: Uint8Array, fileName: string, displayName?: string): TemplateProfile {
  return analyseTemplate(data, fileName, displayName).profile;
}

/** The profile plus the logo image found in the template's header or slide master, if any. */
export function analyseTemplate(data: Uint8Array, fileName: string, displayName?: string): { profile: TemplateProfile; logo?: ExtractedLogo } {
  const name = safeFileName(fileName);
  const ext = path.extname(name).toLowerCase();
  const expected = KIND_BY_EXT[ext];
  if (!expected) throw new TemplateError("unsupported_type", `Upload a Word (.docx, .dotx), Excel (.xlsx, .xltx) or PowerPoint (.pptx, .potx) template. Macro-enabled files are not accepted.`);
  if (data.length > MAX_TEMPLATE_BYTES) throw new TemplateError("too_large", `Templates must be ${MAX_TEMPLATE_BYTES / 1024 / 1024} MB or smaller.`);

  const pkg = new Package(data);
  if (!pkg.has("[Content_Types].xml")) throw new TemplateError("invalid_file", "Not an Office Open XML package.");
  const root = relsOf(pkg, "");
  const main =
    [...root.values()].find((r) => r.type.endsWith("/officeDocument"))?.target ??
    ["word/document.xml", "xl/workbook.xml", "ppt/presentation.xml"].find((p) => pkg.has(p));
  const actual: TemplateKind | undefined = main?.startsWith("word/") ? "word" : main?.startsWith("xl/") ? "excel" : main?.startsWith("ppt/") ? "powerpoint" : undefined;
  if (!main || !actual) throw new TemplateError("invalid_file", "The package has no Word, Excel or PowerPoint content.");
  if (actual !== expected) throw new TemplateError("type_mismatch", `The file is named ${ext} but contains a ${{ word: "Word document", excel: "Excel workbook", powerpoint: "PowerPoint presentation" }[actual]}.`);

  const result = actual === "word" ? extractWord(pkg, main) : actual === "excel" ? extractExcel(pkg, main) : extractPowerPoint(pkg, main);
  const warnings = [...result.warnings];
  if (!result.theme) warnings.unshift("The template has no theme; colours and fonts come from its styles only.");
  if (pkg.names().some((n) => /vbaProject\.bin$/i.test(n))) warnings.push("The package contains macros; they were ignored and never run.");

  let logo: ExtractedLogo | undefined;
  const logoPart = "logoPart" in result ? result.logoPart : undefined;
  if (logoPart) {
    const bytes = pkg.bytes(logoPart);
    const type = bytes && bytes[0] === 0x89 && bytes[1] === 0x50 ? "image/png" : bytes && bytes[0] === 0xff && bytes[1] === 0xd8 ? "image/jpeg" : undefined;
    if (bytes && type) logo = { data: bytes, type, fileName: path.posix.basename(logoPart) };
  }

  const sha256 = crypto.createHash("sha256").update(data).digest("hex");
  const base: Omit<TemplateProfile, "guide"> = {
    id: sha256.slice(0, 16),
    name: (displayName ?? path.parse(name).name).trim().slice(0, 120) || "Template",
    kind: actual,
    fileName: name,
    sizeBytes: data.length,
    sha256,
    uploadedAt: new Date().toISOString(),
    theme: result.theme,
    ...("word" in result ? { word: result.word } : "excel" in result ? { excel: result.excel } : { powerpoint: result.powerpoint }),
    warnings,
    logo: logo ? { fileName: logo.fileName, type: logo.type, sizeBytes: logo.data.length } : undefined,
  };
  return { profile: { ...base, guide: formattingGuide(base) }, logo };
}
