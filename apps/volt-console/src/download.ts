import { fileBase, localDate } from "../shared/export";
/** Browser downloads: a Blob through a temporary object URL, the same pattern as the Templates view. */
export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadText(filename: string, text: string, type = "text/plain") {
  downloadBlob(filename, new Blob([text], { type: `${type};charset=utf-8` }));
}

/** Width and height in px from an SVG string's width/height or viewBox. */
export function svgSize(svg: string): { width: number; height: number } {
  const num = (name: string) => Number(new RegExp(`<svg[^>]*\\s${name}="([\\d.]+)"`).exec(svg)?.[1]);
  const vb = /<svg[^>]*viewBox="[\d.\s-]*?([\d.]+)\s+([\d.]+)"/.exec(svg);
  const width = num("width") || Number(vb?.[1]) || 800;
  const height = num("height") || Number(vb?.[2]) || 450;
  return { width, height };
}

/** Rasterise an SVG string to PNG at `scale` (2 = retina). */
export async function svgToPng(svg: string, scale = 2): Promise<Blob> {
  const canvas = await svgToCanvas(svg, scale);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG export failed"))), "image/png"));
}

/** Draw an SVG string onto a new canvas at `scale`, on white. */
export async function svgToCanvas(svg: string, scale = 2): Promise<HTMLCanvasElement> {
  const { width, height } = svgSize(svg);
  // Pin the root size in px: diagrams use width="100%", which an <img> cannot resolve.
  const sized = svg.replace(/<svg\b([^>]*)>/, (_m, attrs: string) => `<svg${attrs.replace(/\s(width|height)="[^"]*"/g, "")} width="${width}" height="${height}">`);
  const img = new Image();
  img.decoding = "sync";
  const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sized)}`;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Could not draw the image"));
    img.src = src;
  });
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** A chunk that no longer exists on the server: the page was opened before VOLT was redeployed. */
export const STALE_PAGE = "VOLT was updated since this page was opened. Reload the page and try again; your chats stay in History.";
export function isStaleChunk(e: unknown): boolean {
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported|Unable to preload CSS/i.test(String((e as Error)?.message ?? e));
}
export function errorText(e: unknown): string {
  return isStaleChunk(e) ? STALE_PAGE : String((e as Error)?.message ?? e);
}

/** The client in download names: the open project's name, set by the app when the project changes. */
let fileClient = "";
export function setFileClient(name: string) {
  fileClient = name;
}

const VERSIONS = "volt.fileVersions";
const hash = (s: string) => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36);
};

/**
 * The file name for a download, after the convention in shared/export.ts. The version is per content: the same
 * deliverable saved again (or in another format) keeps its number, a changed one on the same day gets the next.
 * Counted in this browser only, and v1 when storage is unavailable. `fixed` (a chat answer's version) skips the count.
 */
export function voltFileName(title: string, ext: string, content = "", date = new Date(), fixed?: number): string {
  const base = fileBase(title, fileClient, date);
  // A chat answer carries its own version (src/versions.ts), the same in every format and on every device.
  if (fixed) return `${base}_v${fixed}.${ext}`;
  let version = 1;
  try {
    const all = JSON.parse(localStorage.getItem(VERSIONS) ?? "{}") as Record<string, string[]>;
    for (const k of Object.keys(all)) if (!k.endsWith(localDate(date))) delete all[k];
    const seen = (all[base] ??= []);
    const h = hash(content);
    if (!seen.includes(h)) seen.push(h);
    version = seen.indexOf(h) + 1;
    localStorage.setItem(VERSIONS, JSON.stringify(all));
  } catch {
    /* private window or blocked storage: v1 */
  }
  return `${base}_v${version}.${ext}`;
}
