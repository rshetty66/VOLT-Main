import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Escape non-ASCII characters in the bundle: the repository's unicode-safety check scans built files too.
  build: { rollupOptions: { output: { minify: { codegen: { asciiOnly: true } } } } },
  server: {
    port: 5173,
    proxy: { "/api": { target: `http://localhost:${process.env.PORT ?? 8787}`, changeOrigin: true } },
  },
});
