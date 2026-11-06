import { describe, expect, it } from "vitest";
import { commandPrompt, commandStatus, loadRudraCommands, matchCommand, parseCommandTable } from "../server/commands";

const commands = loadRudraCommands();

describe("Rudra command table", () => {
  it("loads all 100 commands from the rudra-commands skill", () => {
    expect(commands).toHaveLength(100);
    expect(new Set(commands.map((c) => c.name)).size).toBe(100);
    expect(new Set(commands.map((c) => c.group)).size).toBe(12);
  });

  it("marks every outward-facing command as draft-only", () => {
    for (const name of ["automate", "api", "integrate", "schedule", "trigger", "share", "email", "publish"]) {
      expect(commands.find((c) => c.name === name)?.action, name).toMatch(/Approval:/);
    }
  });

  it("ignores lines that are not command rows", () => {
    expect(parseCommandTable("# Title\n| Command | Group | What |\n|---|---|---|\n| `/x` | G | Do x. |")).toEqual([
      { name: "x", group: "G", action: "Do x." },
    ]);
  });
});

describe("matchCommand", () => {
  it("returns null for an ordinary request", () => {
    expect(matchCommand("Our close takes 12 days on SAP", commands)).toBeNull();
    expect(matchCommand("Compare /compare in the middle", commands)).toBeNull();
  });

  it("recognises a command and its argument, case-insensitively", () => {
    const m = matchCommand("  /Compare FCCS vs OneStream for a 40-entity insurer", commands);
    expect(m).toMatchObject({ kind: "command", command: { name: "compare" }, argument: "FCCS vs OneStream for a 40-entity insurer" });
  });

  it("handles a command with no argument and hyphenated names", () => {
    expect(matchCommand("/exec-summary", commands)).toMatchObject({ kind: "command", command: { name: "exec-summary" }, argument: "" });
  });

  it("treats /help and /commands as the command list", () => {
    expect(matchCommand("/help", commands)).toEqual({ kind: "help" });
    expect(matchCommand("/commands", commands)).toEqual({ kind: "help" });
  });

  it("reports an unknown command with suggestions", () => {
    const m = matchCommand("/summarise this", commands);
    expect(m).toMatchObject({ kind: "unknown", name: "summarise" });
    expect(m && m.kind === "unknown" && m.suggestions).toContain("/summarize");
  });
});

describe("prompts and status", () => {
  it("adds the command instruction and guardrails to the live prompt", () => {
    const m = matchCommand("/email the steering committee", commands)!;
    const p = commandPrompt("/email the steering committee", m, commands);
    expect(p).toMatch(/Rudra command \/email/);
    expect(p).toMatch(/draft only, never sent/);
    expect(p).toMatch(/drafts only for anything that would send/);
  });

  it("lists every group for /help", () => {
    const p = commandPrompt("/help", { kind: "help" }, commands);
    for (const g of new Set(commands.map((c) => c.group))) expect(p).toContain(`- ${g}:`);
  });

  it("writes a one-line status for the activity feed", () => {
    expect(commandStatus(matchCommand("/tldr IFRS 17", commands)!)).toMatch(/^Rudra command \/tldr: /);
    expect(commandStatus({ kind: "unknown", name: "zz", suggestions: [] })).toBe("/zz is not a Rudra command.");
  });
});
