import { GIFEncoder, applyPalette, quantize } from "gifenc";
import { svgToCanvas } from "../download";

/**
 * An animated GIF of a chart's entrance: `frame(t)` draws the chart at progress t (0 to 1), and the last frame holds.
 * It plays once, so a slide or an email settles on the finished chart.
 */
export async function chartGif(frame: (t: number) => string, { frames = 24, fps = 30, hold = 4000, scale = 1.5 } = {}): Promise<Blob> {
  const gif = GIFEncoder();
  for (let i = 0; i <= frames; i++) {
    const canvas = await svgToCanvas(frame(i / frames), scale);
    const { data, width, height } = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height);
    const palette = quantize(data, 256);
    gif.writeFrame(applyPalette(data, palette), width, height, { palette, delay: i === frames ? hold : Math.round(1000 / fps), repeat: -1 });
  }
  gif.finish();
  return new Blob([gif.bytes()], { type: "image/gif" });
}
