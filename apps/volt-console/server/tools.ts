/**
 * Tool surface exposed to the VOLT agents.
 *
 * Each tool has a Zod schema (used to validate model-supplied input before it
 * runs) and a JSON schema derived from it for the API. Execution of
 * `consult_agent` lives in the orchestrator because it re-enters the
 * agent loop; everything else is pure and runs here.
 */
import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import { type Catalog, loadSkillBody, rankAgents, rankSkills } from "./catalog.js";
import { BENCHMARKS, appraiseInvestment, buildValueCase, compareToBenchmark, MATURITY_DIMENSIONS, scoreMaturity } from "./analytics.js";
import { templateStore } from "./templates.js";
import { FILE_FORMATS, FILE_LABEL, type FileSpec } from "../shared/files.js";

export const schemas = {
  find_agents: z.object({
    query: z.string().describe("What the engagement needs, in plain language (e.g. 'Oracle FCCS intercompany eliminations')."),
    limit: z.number().int().min(1).max(10).optional().describe("Max agents to return (default 5)."),
  }),
  find_skills: z.object({
    query: z.string().describe("The task or topic to find skill packs for (e.g. 'nostro reconciliation', 'IFRS 17 CSM')."),
    limit: z.number().int().min(1).max(10).optional().describe("Max skills to return (default 5)."),
  }),
  consult_agent: z.object({
    agent_id: z.string().describe("Exact VOLT agent id from the roster, e.g. 'oracle-gl-specialist'."),
    brief: z.string().describe("Self-contained brief: client context, the specific question, constraints, and the deliverable expected back."),
  }),
  load_skill: z.object({
    skill_id: z.string().describe("Skill id from find_skills or the agent's skill list, e.g. 'apqc-benchmarks'."),
    resource: z.string().optional().describe("Optional reference file inside the skill (e.g. 'references/erm-framework.md')."),
  }),
  apqc_benchmark: z.object({
    metric: z.string().describe(`Metric key or name. Keys: ${BENCHMARKS.map((b) => b.key).join(", ")}`),
    client_value: z.number().optional().describe("Client's current value in the metric's unit, to place them in a quartile."),
  }),
  score_maturity: z.object({
    scores: z
      .array(
        z.object({
          dimension: z.string().describe(`One of: ${MATURITY_DIMENSIONS.join("; ")}`),
          current: z.number().min(1).max(5),
          target: z.number().min(1).max(5).optional(),
          evidence: z.string().optional(),
        }),
      )
      .min(1),
  }),
  appraise_investment: z.object({
    initial_investment: z.number().describe("Up-front investment (positive number)."),
    cash_flows: z.array(z.number()).min(1).describe("Net cash flow per year after the investment, year 1 first."),
    discount_rate: z.number().describe("Hurdle rate as a decimal, e.g. 0.08."),
  }),
  build_value_case: z.object({
    finance_ftes: z.number(),
    loaded_cost_per_fte: z.number(),
    automation_pct: z.number().min(0).max(100).describe("Share of finance effort automated/released at steady state, 0-100."),
    one_time_investment: z.number(),
    annual_run_cost: z.number().optional(),
    ramp_years: z.number().optional(),
    horizon_years: z.number().int().min(1).max(10).optional(),
    discount_rate: z.number().optional(),
    close_days_current: z.number().optional(),
    close_days_target: z.number().optional(),
  }),
  list_templates: z.object({}),
  get_template: z.object({
    template_id: z.string().describe("Template id from list_templates."),
  }),
  create_file: z.object({
    format: z.enum(FILE_FORMATS).describe("docx Word report, pptx deck, xlsx workbook, csv data, html interactive page, pdf report, md markdown."),
    title: z.string().trim().min(1).max(160).describe("An action title: the answer in one line, not a topic (e.g. 'Close can fall from 9 to 5 days by Q3')."),
    subtitle: z.string().max(300).optional(),
    markdown: z
      .string()
      .max(200_000)
      .describe("The content as markdown: '##' sections, tables, and ```chart / ```process / ```architecture / ```mermaid blocks, which become native charts and diagrams. For pptx each '##' is a slide."),
    tables: z
      .array(
        z.object({
          name: z.string().min(1).max(80),
          columns: z.array(z.string().max(200)).min(1).max(50),
          rows: z.array(z.array(z.union([z.string().max(5000), z.number(), z.null()])).max(50)).max(5000),
        }),
      )
      .max(20)
      .optional()
      .describe("Data sheets for xlsx (one sheet each) and csv (one file each). A text cell starting with '=' is an Excel formula, e.g. '=SUM(B2:B5)'."),
    template_id: z.string().max(80).optional().describe("Uploaded client template to style the file with (from list_templates)."),
  }),
} as const;

export type ToolName = keyof typeof schemas;

const descriptions: Record<ToolName, string> = {
  find_agents:
    "Search the VOLT registry of 236 agents and return the best matches with layer and remit. Use when unsure which specialist owns a question.",
  find_skills:
    "Skill Finder: rank VOLT's ~390 skill packs (frameworks, methods, reference material) against a task and return the best matches. Use before load_skill when you do not already know the skill id.",
  consult_agent:
    "Delegate a focused workstream question to one VOLT specialist agent. The specialist works independently with its own methodology and returns a written deliverable. Call several in the same turn to run them in parallel when the request spans workstreams.",
  load_skill: "Load a VOLT skill pack (or one of its reference files) into context.",
  apqc_benchmark:
    "Look up an APQC finance benchmark (top quartile / median / bottom quartile) and optionally place a client value in its quartile with gap-to-median and gap-to-top-quartile.",
  score_maturity:
    "Score the 7-dimension finance maturity model (1 Ad Hoc to 5 Leading): returns overall level, per-dimension gaps, top priority gaps and unassessed dimensions.",
  appraise_investment: "Compute NPV, IRR, payback and profitability index for an investment and its yearly cash flows.",
  build_value_case:
    "Build a finance transformation value case from FTEs, loaded cost, automation %, investment and run cost: yearly benefit ramp plus NPV/IRR/payback.",
  list_templates: "List the client Word, Excel and PowerPoint templates uploaded to VOLT, with their ids and brand fonts.",
  create_file:
    "Make a file the user can download from the chat: a Word report, PowerPoint deck, Excel workbook (with formulas), CSV, interactive web page or PDF. Use it whenever the user asks for a file, model, deck, report or export. Write consulting-grade content: an action title, the answer first (situation, complication, resolution), numbered exhibits each with a source line.",
  get_template:
    "Get the formatting guide of an uploaded template: theme colours and fonts, styles, page setup, slide layouts or workbook formats. Use it whenever a deliverable must match a client template.",
};

function jsonSchema(schema: z.ZodType): Anthropic.Tool.InputSchema {
  const { $schema: _ignored, ...rest } = z.toJSONSchema(schema) as Record<string, unknown>;
  return rest as Anthropic.Tool.InputSchema;
}

export function toolDefs(names: ToolName[]): Anthropic.Beta.BetaTool[] {
  return names.map((name) => ({
    name,
    description: descriptions[name],
    input_schema: jsonSchema(schemas[name]) as Anthropic.Beta.BetaTool.InputSchema,
    eager_input_streaming: true,
  }));
}

export const ORCHESTRATOR_TOOLS: ToolName[] = [
  "find_agents",
  "find_skills",
  "consult_agent",
  "load_skill",
  "apqc_benchmark",
  "score_maturity",
  "appraise_investment",
  "build_value_case",
  "list_templates",
  "get_template",
  "create_file",
];

export const SPECIALIST_TOOLS: ToolName[] = ["find_skills", "load_skill", "apqc_benchmark", "score_maturity", "appraise_investment", "build_value_case", "list_templates", "get_template", "create_file"];

/** `reply`, when set, is what the model reads back instead of the data (a made file is not echoed to it). */
export type LocalResult = { ok: true; data: unknown; summary: string; reply?: string } | { ok: false; error: string };

/** Runs every tool except consult_agent. Input must already be validated. */
export function runLocalTool(catalog: Catalog, name: Exclude<ToolName, "consult_agent">, input: unknown): LocalResult {
  switch (name) {
    case "find_agents": {
      const { query, limit } = input as z.infer<typeof schemas.find_agents>;
      const ranked = rankAgents(catalog, query, limit ?? 5).map(({ agent, score }) => ({
        agent_id: agent.id,
        name: agent.name,
        layer: agent.layer,
        remit: agent.description,
        relevance: Math.round(score * 10) / 10,
      }));
      return { ok: true, data: ranked, summary: ranked.map((r) => r.name).join(", ") || "no matches" };
    }
    case "find_skills": {
      const { query, limit } = input as z.infer<typeof schemas.find_skills>;
      const ranked = rankSkills(catalog, query, limit ?? 5).map(({ skill, score }) => ({
        skill_id: skill.id,
        category: skill.category,
        description: skill.description.slice(0, 300),
        resources: skill.resources.slice(0, 8),
        relevance: score,
      }));
      return { ok: true, data: ranked, summary: ranked.map((r) => r.skill_id).join(", ") || "no matches" };
    }
    case "load_skill": {
      const { skill_id, resource } = input as z.infer<typeof schemas.load_skill>;
      const skill = loadSkillBody(skill_id);
      if (!skill) {
        const near = rankSkills(catalog, skill_id.replace(/-/g, " "), 5).map((r) => r.skill.id);
        return { ok: false, error: `Skill '${skill_id}' is not shipped in this VOLT package. Closest: ${near.join(", ") || "none"}` };
      }
      if (resource) {
        const text = skill.resources[resource];
        if (!text) return { ok: false, error: `No resource '${resource}' in ${skill_id}. Available: ${Object.keys(skill.resources).join(", ") || "none"}` };
        return { ok: true, data: text, summary: `${skill_id}/${resource}` };
      }
      const refs = Object.keys(skill.resources);
      const data = skill.body + (refs.length ? `\n\n---\nReference files (load with resource=...): ${refs.join(", ")}` : "");
      return { ok: true, data, summary: `${skill_id} (${Math.round(skill.body.length / 1000)}k chars${skill.truncated ? ", truncated" : ""})` };
    }
    case "apqc_benchmark": {
      const { metric, client_value } = input as z.infer<typeof schemas.apqc_benchmark>;
      const r = compareToBenchmark(metric, client_value);
      if ("error" in r) return { ok: false, error: `${r.error}. Available: ${r.available.join(", ")}` };
      return {
        ok: true,
        data: r,
        summary: `${r.benchmark.metric}: top25 ${r.benchmark.top25} / median ${r.benchmark.median}${r.quartile ? ` → client ${r.clientValue} (${r.quartile})` : ""}`,
      };
    }
    case "score_maturity": {
      const { scores } = input as z.infer<typeof schemas.score_maturity>;
      const r = scoreMaturity(scores);
      return { ok: true, data: r, summary: `Overall ${r.overall} (${r.overallLevel}); priority gaps: ${r.priorityGaps.join(", ")}` };
    }
    case "appraise_investment": {
      const i = input as z.infer<typeof schemas.appraise_investment>;
      const r = appraiseInvestment({ initialInvestment: i.initial_investment, cashFlows: i.cash_flows, discountRate: i.discount_rate });
      return { ok: true, data: r, summary: `NPV ${fmt(r.npv)}, IRR ${r.irrPct ?? "n/a"}%, payback ${r.paybackYears ?? "n/a"} yrs` };
    }
    case "build_value_case": {
      const v = input as z.infer<typeof schemas.build_value_case>;
      const r = buildValueCase({
        financeFtes: v.finance_ftes,
        loadedCostPerFte: v.loaded_cost_per_fte,
        automationPct: v.automation_pct,
        oneTimeInvestment: v.one_time_investment,
        annualRunCost: v.annual_run_cost,
        rampYears: v.ramp_years,
        horizonYears: v.horizon_years,
        discountRate: v.discount_rate,
        closeDaysCurrent: v.close_days_current,
        closeDaysTarget: v.close_days_target,
      });
      return { ok: true, data: r, summary: `Saving ${fmt(r.steadyStateAnnualSaving)}/yr, NPV ${fmt(r.npv)}, payback ${r.paybackYears ?? "n/a"} yrs` };
    }
    case "list_templates": {
      const list = templateStore()
        .list()
        .map((t) => ({ template_id: t.id, name: t.name, kind: t.kind, file: t.fileName, heading_font: t.theme?.fonts.major, body_font: t.theme?.fonts.minor }));
      return { ok: true, data: list, summary: list.length ? list.map((t) => `${t.name} (${t.kind})`).join(", ") : "no templates uploaded" };
    }
    case "get_template": {
      const { template_id } = input as z.infer<typeof schemas.get_template>;
      const t = templateStore().get(template_id);
      if (!t) return { ok: false, error: `No template '${template_id}'. Use list_templates to see the uploaded templates.` };
      return { ok: true, data: t.guide, summary: `${t.name} (${t.kind}) formatting guide` };
    }
    case "create_file": {
      const f = input as z.infer<typeof schemas.create_file>;
      if (f.format === "csv" && !f.tables?.length) return { ok: false, error: "A csv file needs at least one entry in tables." };
      if (f.format !== "csv" && !f.markdown.trim() && !f.tables?.length) return { ok: false, error: "The file has no content: give markdown or tables." };
      if (f.template_id && !templateStore().get(f.template_id)) return { ok: false, error: `No template '${f.template_id}'. Use list_templates to see the uploaded templates.` };
      const spec: FileSpec = { format: f.format, title: f.title, subtitle: f.subtitle, markdown: f.markdown, tables: f.tables, templateId: f.template_id };
      const label = `${FILE_LABEL[f.format]}: ${f.title}`;
      return { ok: true, data: spec, summary: label, reply: `${label} is ready as a download card in the chat. Do not repeat its content; summarise it in two or three lines.` };
    }
  }
}

export function fmt(n: number): string {
  const abs = Math.abs(n);
  const s = abs >= 1e9 ? `${(abs / 1e9).toFixed(2)}B` : abs >= 1e6 ? `${(abs / 1e6).toFixed(2)}M` : abs >= 1e3 ? `${(abs / 1e3).toFixed(1)}K` : abs.toFixed(0);
  return `${n < 0 ? "-" : ""}$${s}`;
}
