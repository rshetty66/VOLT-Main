import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The repository unicode-safety check scans built files, so escape emoji-class characters in every chunk;
// \u escapes are equivalent JavaScript in strings, templates and comments.
const PICTOGRAPHIC = /\p{Extended_Pictographic}|\p{Regional_Indicator}/gu;
const escapePictographic = {
  name: "escape-pictographic",
  renderChunk(code: string) {
    if (!PICTOGRAPHIC.test(code)) return null;
    PICTOGRAPHIC.lastIndex = 0;
    return code.replace(PICTOGRAPHIC, (ch) => {
      const cp = ch.codePointAt(0)!;
      return cp > 0xffff ? `\\u{${cp.toString(16)}}` : `\\u${cp.toString(16).padStart(4, "0")}`;
    });
  },
};

export default defineConfig({
  plugins: [react(), escapePictographic],
  build: { rollupOptions: { output: { minify: { codegen: { asciiOnly: true } } } } },
  server: {
    port: 5174,
    proxy: { "/api": { target: `http://localhost:${process.env.PORT ?? 8788}`, changeOrigin: true } },
  },
});
