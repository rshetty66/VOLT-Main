/**
 * Rudra commands: a request to Rudra that starts with "/<command>" runs one of
 * the 100 commands defined in plugins/volt/skills/rudra-commands. The command
 * table is read from that skill's references/commands.md, the same file Claude
 * Code uses, so the console and the plugin stay in step.
 */
import { loadSkillBody } from "./catalog.js";

export interface RudraCommand {
  name: string;
  group: string;
  action: string;
}

export type CommandMatch =
  | { kind: "command"; command: RudraCommand; argument: string }
  | { kind: "help" }
  | { kind: "unknown"; name: string; suggestions: string[] };

const ROW = /^\| `\/([a-z][a-z-]*)` \| ([^|]+?) \| (.+?) \|$/;
const INVOCATION = /^\s*\/([a-z][a-z-]*)\b\s*([\s\S]*)$/i;
const HELP = new Set(["help", "commands"]);

/** Parses the command table in references/commands.md. */
export function parseCommandTable(markdown: string): RudraCommand[] {
  return markdown
    .split("\n")
    .map((line) => ROW.exec(line.trim()))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => ({ name: m[1], group: m[2].trim(), action: m[3].trim() }));
}

let cached: RudraCommand[] | null = null;

export function loadRudraCommands(pluginDir?: string): RudraCommand[] {
  if (cached && !pluginDir) return cached;
  const skill = loadSkillBody("rudra-commands", pluginDir);
  const table = skill?.resources["references/commands.md"] ?? "";
  const commands = parseCommandTable(table);
  if (!pluginDir) cached = commands;
  return commands;
}

function suggest(name: string, commands: RudraCommand[]): string[] {
  const n = name.toLowerCase();
  return commands
    .map((c) => ({ c, score: (c.name.startsWith(n.slice(0, 3)) ? 2 : 0) + (c.name.includes(n) || n.includes(c.name) ? 3 : 0) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((x) => `/${x.c.name}`);
}

/** Recognises "/<command> argument" at the start of a prompt. Returns null for an ordinary request. */
export function matchCommand(prompt: string, commands: RudraCommand[]): CommandMatch | null {
  const m = INVOCATION.exec(prompt);
  if (!m) return null;
  const name = m[1].toLowerCase();
  if (HELP.has(name)) return { kind: "help" };
  const command = commands.find((c) => c.name === name);
  if (!command) return { kind: "unknown", name, suggestions: suggest(name, commands) };
  return { kind: "command", command, argument: m[2].trim() };
}

/** A one-line status message for the run's activity feed. */
export function commandStatus(match: CommandMatch): string {
  if (match.kind === "command") return `Rudra command /${match.command.name}: ${match.command.action}`;
  if (match.kind === "help") return "Rudra commands: 100 shortcuts in 12 groups. Rudra will list them.";
  const hint = match.suggestions.length ? ` Did you mean ${match.suggestions.join(", ")}?` : "";
  return `/${match.name} is not a Rudra command.${hint}`;
}

/** The prompt Rudra receives in live mode: the user's text plus the command's instruction. */
export function commandPrompt(prompt: string, match: CommandMatch, commands: RudraCommand[]): string {
  if (match.kind === "command") {
    return `${prompt}

---
Rudra command /${match.command.name} (${match.command.group}). Do exactly this, applied to the argument and the client context so far: ${match.command.action}
Argument: ${match.argument || "(none: apply it to the conversation so far)"}
Keep the rudra-commands guardrails: drafts only for anything that would send, publish, schedule or connect, and no invented facts or figures.`;
  }
  if (match.kind === "help") {
    const groups = new Map<string, string[]>();
    for (const c of commands) groups.set(c.group, [...(groups.get(c.group) ?? []), `/${c.name}`]);
    const list = [...groups].map(([g, names]) => `- ${g}: ${names.join(" ")}`).join("\n");
    return `${prompt}

---
The user asked for the list of Rudra commands. List the groups below with one line on what each group is for, and three useful examples per group. Do not do any other work.
${list}`;
  }
  return `${prompt}

---
"/${match.name}" is not a Rudra command. Say so in one line, suggest ${match.suggestions.length ? match.suggestions.join(", ") : "/help"}, and do nothing else.`;
}
