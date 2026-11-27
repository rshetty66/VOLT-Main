import type { Run, RunVersion } from "./runState";
import { deliverableTitle } from "./exports";
import { directAsk } from "../shared/asks";

/**
 * The version a new message gets in a chat. A chat holds one deliverable: the first answer is v1, and each rerun after
 * feedback (a follow-up or Regenerate in the same chat) is the next version, under v1's name, so its downloads sort
 * together as VOLT_<Client>_<Deliverable>_<date>_v2. A lookup ("list the documents ...") is not a version. A new
 * deliverable starts in a new chat. Kept on the run, so it survives reloads and is the same on every device.
 */
export function nextVersion(chat: Run[], prompt: string): RunVersion | undefined {
  if (directAsk(prompt)) return undefined;
  const prev = [...chat].reverse().find((r) => r.version);
  if (!prev?.version) return { n: 1 };
  return { n: prev.version.n + 1, name: versionName(prev), feedback: prompt.replace(/\s+/g, " ").trim().slice(0, 160) };
}

/** The deliverable's name across its versions: v1's title, kept by every later version. */
export function versionName(run: Run): string {
  return run.version?.name ?? deliverableTitle(run.text, run.prompt);
}

/** The versions of a chat's deliverable, oldest first. */
export const chatVersions = (chat: Run[]): Run[] => chat.filter((r) => r.version);
