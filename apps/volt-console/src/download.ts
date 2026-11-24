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

export function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "volt";
}

export function datedName(title: string, ext: string) {
  return `volt-${slug(title)}-${new Date().toISOString().slice(0, 10)}.${ext}`;
}
