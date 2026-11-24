/**
 * VOLT branding for exports. The logo lives in public/brand/ (the app serves the same files), and is found next to the
 * app in development and Docker, or in a brand/ folder beside the bundle on Vercel. A missing logo is not an error:
 * the file is simply built without it.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

export interface BrandLogo {
  png: Buffer;
  width: number;
  height: number;
}

export { BRAND } from "../../shared/brand.js";

let cached: BrandLogo | null | undefined;

function readLogo(): BrandLogo | null {
  const dirs = [process.env.VOLT_BRAND_DIR, path.resolve(here, "../../public/brand"), path.join(here, "brand")].filter((d): d is string => !!d);
  for (const dir of dirs) {
    try {
      const png = fs.readFileSync(path.join(dir, "volt-logo.png"));
      // PNG header: 8-byte signature, then IHDR with width and height as big-endian 32-bit integers.
      if (png.length > 24 && png.subarray(1, 4).toString("latin1") === "PNG") return { png, width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
    } catch {
      /* try the next folder */
    }
  }
  return null;
}

/** The small ink-wash accent (black ink on transparent). Optional, like the logo. */
export function brandAccent(): BrandLogo | null {
  for (const dir of [process.env.VOLT_BRAND_DIR, path.resolve(here, "../../public/brand"), path.join(here, "brand")].filter((d): d is string => !!d)) {
    try {
      const png = fs.readFileSync(path.join(dir, "ink-accent.png"));
      if (png.length > 24) return { png, width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
    } catch {
      /* next */
    }
  }
  return null;
}

export function brandLogo(): BrandLogo | null {
  if (cached === undefined) cached = readLogo();
  return cached;
}

/** For tests: forget the cached lookup. */
export function resetBrandLogo() {
  cached = undefined;
}
