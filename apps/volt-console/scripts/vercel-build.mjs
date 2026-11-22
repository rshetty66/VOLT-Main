// Builds the Vercel deployment in the Build Output API format (.vercel/output):
//   static/                      the React app (dist)
//   functions/api/index.func/    one self-contained function: the bundled Express API plus the VOLT plugin folder
// Run by vercel.json's buildCommand from apps/volt-console, after npm ci. Needs ../../plugins/volt next to it.
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { build } from "esbuild";

const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, ".vercel", "output");
const fn = path.join(out, "functions", "api", "index.func");
const plugin = path.resolve(root, "../../plugins/volt");

execSync("npm run build", { cwd: root, stdio: "inherit" });
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(fn, { recursive: true });
fs.cpSync(path.join(root, "dist"), path.join(out, "static"), { recursive: true });

await build({
  entryPoints: [path.join(root, "server", "vercel-entry.ts")],
  outfile: path.join(fn, "index.mjs"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  // CommonJS dependencies call require(); give the ESM bundle one.
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  logLevel: "warning",
});

// CopilotKit's Express adapter loads `express` by name at run time (live mode), which a bundle cannot contain.
// Install the same version next to the bundle so require("express") resolves from /var/task/node_modules.
const expressVersion = JSON.parse(fs.readFileSync(path.join(root, "node_modules", "express", "package.json"), "utf8")).version;
fs.writeFileSync(path.join(fn, "package.json"), JSON.stringify({ name: "volt-console-function", private: true, dependencies: { express: expressVersion } }));
execSync("npm install --omit=dev --ignore-scripts --no-audit --no-fund --no-package-lock", { cwd: fn, stdio: "inherit" });

// The VOLT logo for exports sits in a brand/ folder next to the bundle (server/export/brand.ts looks there).
fs.cpSync(path.join(root, "public", "brand"), path.join(fn, "brand"), { recursive: true });

if (!fs.existsSync(path.join(plugin, "skills"))) throw new Error(`VOLT plugin not found at ${plugin}`);
fs.cpSync(plugin, path.join(fn, "plugin-volt"), { recursive: true });

fs.writeFileSync(
  path.join(fn, ".vc-config.json"),
  JSON.stringify({ runtime: "nodejs22.x", handler: "index.mjs", launcherType: "Nodejs", shouldAddHelpers: false, supportsResponseStreaming: true, maxDuration: 300 }, null, 2),
);
fs.writeFileSync(
  path.join(out, "config.json"),
  JSON.stringify({ version: 3, routes: [{ handle: "filesystem" }, { src: "/api/(.*)", dest: "/api/index" }, { src: "/(.*)", dest: "/index.html" }] }, null, 2),
);
console.log("Vercel output ready:", out);
