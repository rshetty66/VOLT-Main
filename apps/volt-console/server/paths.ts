/**
 * Where the console's files are. Found from the app folder (the one holding package.json),
 * so paths are the same whether the server runs from server/ under tsx or from build/server/.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function findAppRoot(): string {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 5; i++) {
    if (fs.existsSync(path.join(dir, "package.json"))) return dir;
    dir = path.dirname(dir);
  }
  throw new Error("Could not find the VOLT console folder (no package.json above the server).");
}

export const APP_ROOT = findAppRoot();
export const ENV_FILE = path.join(APP_ROOT, ".env");
export const MIGRATIONS_DIR = path.join(APP_ROOT, "server", "migrations");
export const DEFAULT_DATA_DIR = path.join(APP_ROOT, ".volt-data");
export const DIST_DIR = path.join(APP_ROOT, "dist");
export const DEFAULT_PLUGIN_DIR = path.resolve(APP_ROOT, "../../plugins/volt");
