/**
 * The look of an export: colours, fonts, logo and the words in headers and footers.
 * Engagements can be assigned a template from the library; without one, exports use
 * STANDARD_BRAND, the application's own look.
 */
export interface Logo {
  data: Buffer;
  type: "image/png" | "image/jpeg";
  width: number;
  height: number;
}

export interface Brand {
  name: string;
  /** Six hex digits, upper case, no '#'. */
  primary: string;
  accent: string;
  headingFont: string;
  bodyFont: string;
  /** Shown in page headers, e.g. the firm's name. */
  organisation: string;
  /** Footer text before the page number; defaults to "Working draft". */
  footer: string;
  /** e.g. "Confidential - prepared for the Board". Shown on the cover and in footers when set. */
  confidentiality: string;
  logo?: Logo;
}

export const STANDARD_BRAND: Brand = {
  name: "VOLT standard",
  primary: "1F3864",
  accent: "2E75B6",
  headingFont: "Calibri",
  bodyFont: "Calibri",
  organisation: "VOLT",
  footer: "Working draft",
  confidentiality: "",
};

export const MAX_LOGO_BYTES = 1024 * 1024;

/** "#1f3864" or "1F3864" -> "1F3864"; null when not a six-digit hex colour. */
export function normaliseColour(value: string): string | null {
  const v = value.trim().replace(/^#/, "").toUpperCase();
  return /^[0-9A-F]{6}$/.test(v) ? v : null;
}

/** Reads type and pixel size from PNG or JPEG bytes; null for anything else. */
export function inspectLogo(data: Buffer): Omit<Logo, "data"> | null {
  if (data.length > 24 && data.readUInt32BE(0) === 0x89504e47 && data.toString("ascii", 12, 16) === "IHDR") {
    return { type: "image/png", width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
  }
  if (data.length > 4 && data[0] === 0xff && data[1] === 0xd8) {
    let i = 2;
    while (i + 9 < data.length) {
      if (data[i] !== 0xff) return null;
      const marker = data[i + 1];
      const len = data.readUInt16BE(i + 2);
      // Start-of-frame markers carry the image size (C4, C8 and CC are not frames).
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { type: "image/jpeg", height: data.readUInt16BE(i + 5), width: data.readUInt16BE(i + 7) };
      }
      i += 2 + len;
    }
  }
  return null;
}

/** Width and height that fit inside a box, keeping the logo's proportions. */
export function fitLogo(logo: Logo, maxW: number, maxH: number): { w: number; h: number } {
  const scale = Math.min(maxW / logo.width, maxH / logo.height);
  return { w: logo.width * scale, h: logo.height * scale };
}

/** Joins labels with a separator, dropping blanks and repeats (an organisation that is also the client). */
export function joinLabels(parts: (string | undefined)[], sep: string): string {
  const seen = new Set<string>();
  return parts
    .map((p) => (p ?? "").trim())
    .filter((p) => p && !seen.has(p.toLowerCase()) && seen.add(p.toLowerCase()))
    .join(sep);
}

/** Text colour that stays readable on a background colour (WCAG relative luminance). */
export function textOn(background: string): string {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = [0, 2, 4].map((i) => lin(parseInt(background.slice(i, i + 2), 16)));
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return l > 0.179 ? "1A1A1A" : "FFFFFF"; // where black and white give equal contrast
}
