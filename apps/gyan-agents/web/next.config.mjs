import { fileURLToPath } from "node:url";

/** @type {import("next").NextConfig} */
const config = {
  outputFileTracingRoot: fileURLToPath(new URL(".", import.meta.url)),
  poweredByHeader: false,
};

export default config;
