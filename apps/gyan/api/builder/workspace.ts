/**
 * workspace.ts — isolated per-project file workspace for Builder.
 *
 * Every generated app lives under its own directory. All operations resolve
 * paths against the workspace root and refuse to escape it — generated code
 * must never be able to read or write outside its own project.
 */
import { mkdir, readFile, readdir, writeFile } from "fs/promises";
import path from "path";

export class WorkspaceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkspaceError";
  }
}

export class Workspace {
  constructor(readonly root: string) {}

  /** Resolve a relative path inside the workspace, or throw. */
  private resolve(rel: string): string {
    const abs = path.resolve(this.root, rel);
    if (abs !== this.root && !abs.startsWith(this.root + path.sep)) {
      throw new WorkspaceError(`path escapes workspace: ${rel}`);
    }
    return abs;
  }

  async ensure(): Promise<void> {
    await mkdir(this.root, { recursive: true });
  }

  async write(rel: string, content: string): Promise<void> {
    const abs = this.resolve(rel);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, content, "utf8");
  }

  async read(rel: string): Promise<string> {
    return readFile(this.resolve(rel), "utf8");
  }

  /** Recursive file listing, paths relative to the root. */
  async list(): Promise<string[]> {
    const out: string[] = [];
    const walk = async (dir: string): Promise<void> => {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const e of entries) {
        if (e.name === "node_modules" || e.name.startsWith(".")) continue;
        const abs = path.join(dir, e.name);
        if (e.isDirectory()) await walk(abs);
        else out.push(path.relative(this.root, abs));
      }
    };
    await walk(this.root);
    return out.sort();
  }
}

/** Workspace root for a builder session, nested under a base data dir. */
export function workspaceFor(baseDir: string, sessionId: string): Workspace {
  const safe = sessionId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
  if (!safe) throw new WorkspaceError("empty session id");
  return new Workspace(path.join(baseDir, safe));
}
