/**
 * Skill quality checks, distilled from how Uber lints agent skills at scale (Uber Engineering, "How Uber Evals 1 Million
 * Agent Skill Invocations a Month", Nov 2026): numbered steps, a concrete check after steps, an error-recovery table,
 * a short body, a description that tells an agent when to use the skill, and no bundled tool servers.
 * Pure text checks: they find skills worth a look, they do not judge quality.
 */
export const LINT_CHECKS = {
  description: "Has a description of 20 to 1024 characters that says when to use it",
  length: "Body is under 500 lines",
  steps: "Steps are numbered",
  verify: "Steps say how to check the result",
  recovery: "Has an error-recovery section",
  noMcp: "Does not install tool servers (.mcp.json)",
} as const;
export type LintCheck = keyof typeof LINT_CHECKS;

export interface LintResult { failed: LintCheck[] }

export function lintSkill(body: string, description = ""): LintResult {
  const failed: LintCheck[] = [];
  const text = body.replace(/^---[\s\S]*?\n---\s*\n/, "");
  const d = description.trim();
  if (d.length < 20 || d.length > 1024) failed.push("description");
  if (body.split("\n").length > 500) failed.push("length");
  const numbered = (text.match(/^\s*\d+[.)]\s+\S/gm) ?? []).length;
  if (numbered < 3) failed.push("steps");
  if (!/\b(verify|check that|confirm|validate|expected output|should (see|return|show))\b/i.test(text)) failed.push("verify");
  if (!/^#{1,4}\s.*\b(error|recover|troubleshoot|failure|fallback|when .* fails)\b/im.test(text) && !/\|\s*(error|failure|symptom|problem)\s*\|/i.test(text)) failed.push("recovery");
  if (/\.mcp\.json/i.test(text)) failed.push("noMcp");
  return { failed };
}

export interface SkillLintSummary {
  checked: number;
  clean: number;
  byCheck: Record<LintCheck, number>;
  /** The skills failing the most checks, worst first. */
  worst: { id: string; failed: LintCheck[] }[];
}
