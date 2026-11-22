/**
 * spec.ts — Builder spec schema and the G0 completeness gate.
 *
 * The spec is the anti-demo-ware control: codegen never starts on a spec
 * that lacks entities or a primary flow. The schema doubles as the contract
 * for the spec compiler's structured output, so the prompt and the gate
 * cannot drift — one zod schema is both.
 */
import { z } from "zod";

export const userStorySchema = z.object({
  id: z.string().min(1),
  story: z.string().min(1),
  acceptance: z.string().min(1),
});

export const entitySchema = z.object({
  name: z.string().min(1),
  fields: z
    .array(
      z.object({
        name: z.string().min(1),
        type: z.string().min(1),
      }),
    )
    .min(1),
  relationships: z.array(z.string()).default([]),
  provenance: z.enum(["client-file", "proposed"]).default("proposed"),
});

export const screenSchema = z.object({
  name: z.string().min(1),
  purpose: z.string().min(1),
  /** The one action the smoke test will exercise on this screen. */
  primaryAction: z.string().min(1),
  reads: z.array(z.string()).default([]),
  writes: z.array(z.string()).default([]),
});

export const unknownSchema = z.object({
  /** The decision that cannot be made without this input. */
  decision: z.string().min(1),
  /** What the user must provide to resolve it. */
  resolvingInput: z.string().min(1),
  /** Blocking unknowns stop codegen; non-blocking ones ride along. */
  blocking: z.boolean().default(true),
});

export const buildSpecSchema = z.object({
  appName: z.string().min(1).max(120),
  userStories: z.array(userStorySchema).min(3).max(7),
  entities: z.array(entitySchema).min(1),
  screens: z.array(screenSchema).min(1),
  /** The end-to-end flow G4 asserts. Must name its entry screen. */
  primaryFlow: z.string().min(1),
  authModel: z.enum(["none", "kimi-oauth", "roles-lite"]).default("none"),
  gates: z
    .array(z.enum(["G0", "G1", "G2", "G3", "G4"]))
    .default(["G0", "G1", "G2", "G3", "G4"]),
  unknowns: z.array(unknownSchema).default([]),
});

export type UserStory = z.infer<typeof userStorySchema>;
export type Entity = z.infer<typeof entitySchema>;
export type Screen = z.infer<typeof screenSchema>;
export type SpecUnknown = z.infer<typeof unknownSchema>;
export type BuildSpec = z.infer<typeof buildSpecSchema>;

export interface SpecCheckResult {
  ok: boolean;
  /** Human-readable issues, empty when ok. */
  issues: string[];
  spec?: BuildSpec;
  /** Blocking unknowns — codegen must not start while any exist. */
  blockingUnknowns: SpecUnknown[];
}

/**
 * G0 — spec completeness. Zod enforces shape; this adds the policy rules
 * the schema cannot express: primary flow must reference a real screen, and
 * blocking unknowns halt the build.
 */
export function checkSpec(raw: unknown): SpecCheckResult {
  const parsed = buildSpecSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map(
        (i) => `${i.path.join(".") || "spec"}: ${i.message}`,
      ),
      blockingUnknowns: [],
    };
  }
  const spec = parsed.data;
  const issues: string[] = [];

  const screenNames = new Set(spec.screens.map((s) => s.name.toLowerCase()));
  const flowHead = spec.primaryFlow.split(/\s+/)[0]?.toLowerCase() ?? "";
  const flowNamesScreen = spec.screens.some(
    (s) =>
      spec.primaryFlow.toLowerCase().includes(s.name.toLowerCase()) ||
      (flowHead.length > 2 && s.name.toLowerCase().includes(flowHead)),
  );
  if (!flowNamesScreen) {
    issues.push(
      `primaryFlow must reference one of the declared screens (${[...screenNames].join(", ")})`,
    );
  }

  const entityNames = new Set(spec.entities.map((e) => e.name.toLowerCase()));
  for (const screen of spec.screens) {
    for (const ref of [...screen.reads, ...screen.writes]) {
      if (!entityNames.has(ref.toLowerCase())) {
        issues.push(
          `screen "${screen.name}" references undeclared entity "${ref}"`,
        );
      }
    }
  }

  const blockingUnknowns = spec.unknowns.filter((u) => u.blocking);
  if (blockingUnknowns.length > 0) {
    issues.push(
      `${blockingUnknowns.length} blocking unknown(s) must be resolved before codegen`,
    );
  }

  return { ok: issues.length === 0, issues, spec, blockingUnknowns };
}
