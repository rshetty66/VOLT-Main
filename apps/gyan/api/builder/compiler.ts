/**
 * compiler.ts — Builder spec compiler (D6).
 *
 * Turns a user's build prompt (plus an optional client file that seeds the
 * data model) into a structured BuildSpec via the platform gateway's
 * structured-output mode. The same zod schema then runs as gate G0, so the
 * compiler cannot emit a spec the gate would accept silently drifted from.
 *
 * The compiler's job is completeness and honesty, not code: every genuine
 * either/or decision the user didn't settle becomes an unknown — guessing is
 * how demo-ware gets built.
 */
import { generateObject, zodSchema, type ModelMessage } from "ai";
import { kimiGw, defaultModel } from "../ai/provider";
import { classifyAiError } from "../ai/ai-client";
import { buildSpecSchema, checkSpec, type BuildSpec, type SpecCheckResult } from "./spec";

export interface ClientFile {
  name: string;
  content: string;
}

export interface CompileInput {
  prompt: string;
  /** Optional client-supplied file (CSV header, JSON sample) seeding entities. */
  clientFile?: ClientFile;
}

export interface CompileResult {
  spec: BuildSpec;
  /** G0 policy verdict on the compiled spec — a spec can parse and still fail. */
  g0: SpecCheckResult;
}

export function compilerSystemPrompt(): string {
  return `You are the VOLT Builder spec compiler. You turn a request for a custom web application into one precise build specification (JSON). You never write code.

Contract:
- appName: short, human-readable (max 120 chars).
- userStories: 3 to 7. Each has an id (US1, US2, ...), a story in the user's own language, and a concrete, testable acceptance condition.
- entities: at least one, each with typed fields (string, number, money, date, boolean). An entity that comes from the client's uploaded file gets provenance "client-file"; one you design gets "proposed". Name relationships in plain words.
- screens: 1 to 8. Each has a name (PascalCase), a purpose, exactly one primaryAction (the action the smoke test will exercise), and which entities it reads and writes — only entities you declared.
- primaryFlow: the end-to-end flow as a single sentence that MUST name its starting screen, e.g. "From the InvoiceList screen, create an invoice and see it appear."
- authModel: "none" unless the prompt clearly needs login ("kimi-oauth") or role separation ("roles-lite").
- unknowns: every genuine decision you cannot make from the prompt alone. For each: the decision, what input from the user would resolve it, and blocking (true ONLY when the choice changes the data model or primary flow; false for cosmetic or easily reversed choices). Do not pad unknowns — ask only what a real consultant would ask before billing a build.
- Never invent secrets, credentials, or integrations that need them. Never guess brand or client names not present in the prompt.

You prefer a smaller, complete spec over an ambitious, vague one.`;
}

/** Assemble the model messages; pure so the contract is unit-testable. */
export function buildCompilerMessages(input: CompileInput): ModelMessage[] {
  const user = [`Build request:\n${input.prompt}`];
  if (input.clientFile) {
    user.push(
      `Client file "${input.clientFile.name}" — derive entities from it, mark them provenance "client-file":\n${input.clientFile.content}`,
    );
  }
  return [
    { role: "system", content: compilerSystemPrompt() },
    { role: "user", content: user.join("\n\n") },
  ];
}

export interface CompilerDeps {
  /** Injected in tests; defaults to the platform gateway structured call. */
  generate?: (args: {
    model: unknown;
    schema: unknown;
    messages: ModelMessage[];
  }) => Promise<{ object: unknown }>;
  modelId?: () => Promise<string>;
}

/** Compile a prompt into a spec and immediately run the G0 policy gate. */
export async function compileSpec(
  input: CompileInput,
  deps: CompilerDeps = {},
): Promise<CompileResult> {
  const messages = buildCompilerMessages(input);
  let object: unknown;
  try {
    if (deps.generate) {
      const modelId = deps.modelId ? await deps.modelId() : "test-model";
      object = (
        await deps.generate({
          model: modelId,
          schema: buildSpecSchema,
          messages,
        })
      ).object;
    } else {
      const modelId = await defaultModel();
      object = (
        await generateObject({
          model: kimiGw(modelId),
          schema: zodSchema(buildSpecSchema),
          messages,
        })
      ).object;
    }
  } catch (err) {
    throw classifyAiError(err);
  }
  const g0 = checkSpec(object);
  if (!g0.spec) {
    throw new Error(
      `spec compiler produced an invalid spec: ${g0.issues.join("; ")}`,
    );
  }
  return { spec: g0.spec, g0 };
}
