import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Workspace, WorkspaceError, workspaceFor } from "./workspace";

describe("Workspace", () => {
  let dir: string;
  let ws: Workspace;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "volt-builder-"));
    ws = new Workspace(dir);
    await ws.ensure();
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("round-trips write/read and lists nested files sorted", async () => {
    await ws.write("a.txt", "alpha");
    await ws.write("sub/b.txt", "beta");
    await ws.write("sub/deep/c.txt", "gamma");
    expect(await ws.read("a.txt")).toBe("alpha");
    expect(await ws.read("sub/b.txt")).toBe("beta");
    expect(await ws.list()).toEqual(["a.txt", "sub/b.txt", "sub/deep/c.txt"]);
  });

  it("refuses to escape the root via ..", async () => {
    await expect(ws.write("../evil.txt", "nope")).rejects.toBeInstanceOf(
      WorkspaceError,
    );
    await expect(ws.read("../etc/passwd")).rejects.toBeInstanceOf(WorkspaceError);
  });

  it("refuses absolute paths outside the root", async () => {
    await expect(ws.write("/tmp/evil.txt", "nope")).rejects.toBeInstanceOf(
      WorkspaceError,
    );
  });

  it("skips node_modules and dotfiles in listings", async () => {
    await ws.write("src/index.ts", "x");
    await ws.write("node_modules/pkg/index.js", "x");
    await ws.write(".git/config", "x");
    expect(await ws.list()).toEqual(["src/index.ts"]);
  });

  it("clear removes everything except the keep list", async () => {
    await ws.write("spec.json", "{}");
    await ws.write("src/old.ts", "x");
    await ws.write("dist/out.js", "x");
    await ws.clear(["spec.json"]);
    expect(await ws.list()).toEqual(["spec.json"]);
    await ws.clear();
    expect(await ws.list()).toEqual([]);
  });

  it("throws on empty session id", () => {
    expect(() => workspaceFor("/data", "")).toThrow(WorkspaceError);
  });

  it("sanitizes session ids to a safe directory name", () => {
    const w = workspaceFor("/data", "../../etc/passwd!");
    expect(w.root.startsWith(path.join("/data", "") + path.sep)).toBe(true);
    expect(w.root).not.toContain("..");
  });
});
