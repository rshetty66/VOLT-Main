import { useMemo, useRef, type RefObject } from "react";
import {
  AssistantRuntimeProvider,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useLocalRuntime,
  type ChatModelAdapter,
  type ChatModelRunResult,
  type ToolCallMessagePartProps,
} from "@assistant-ui/react";
import { streamRun } from "../../api";
import { intentOf, type Report, type UsageEvent } from "../../workbench/logic";
import { Markdown } from "../Markdown";
import { ReportView } from "./ReportView";

/** What the chat may read from, and trigger in, the workbench. Kept in a ref so the adapter always sees current state. */
export interface WorkbenchBridge {
  validate: (kind: "journal" | "mapping") => Promise<Report>;
  evidence: () => string;
  context: () => string;
  onUsage: (u: UsageEvent) => void;
  demo: boolean;
}

/** VOLT agent that answers drafting questions; it loads the design-finance-architecture skill on demand. */
const AGENT_ID = "accounting-hub-architect";

type Part = Exclude<ChatModelRunResult["content"], undefined>[number];
const done = (content: Part[]): ChatModelRunResult => ({ content, status: { type: "complete", reason: "stop" } });
const toolPart = (toolName: string, args: Record<string, string | number>, result: unknown): Part => ({
  type: "tool-call",
  toolCallId: `${toolName}-${crypto.randomUUID()}`,
  toolName,
  args,
  argsText: JSON.stringify(args),
  result,
});

function makeAdapter(bridge: RefObject<WorkbenchBridge | null>, session: RefObject<string | undefined>): ChatModelAdapter {
  return {
    async *run({ messages, abortSignal }) {
      const b = bridge.current!;
      const last = messages[messages.length - 1];
      const text = last.content.map((p) => (p.type === "text" ? p.text : "")).join("\n").trim();
      const intent = intentOf(text);

      if (intent === "validate_journal" || intent === "validate_mapping") {
        const kind = intent === "validate_journal" ? "journal" : "mapping";
        const report = await b.validate(kind);
        const failed = report.checks.filter((c) => c.status === "FAIL").map((c) => c.check_id);
        const summary = failed.length
          ? `The ${kind} proof is BLOCKED by ${failed.join(", ")}. Fix those lines on the ${kind === "journal" ? "Journal simulator" : "Mapping prover"} screen and ask me again.`
          : `The ${kind} proof passed every executed check. Checks marked NOT_RUN still need people: policy review, golden-case comparison and platform testing.`;
        yield done([toolPart(`validate_${kind}`, { runs: "validate_" + (kind === "journal" ? "journals" : "mapping") + ".py", model_tokens: 0 }, report), { type: "text", text: summary }]);
        return;
      }
      if (intent === "evidence_pack") {
        yield done([toolPart("evidence_pack", { model_tokens: 0 }, { markdown: b.evidence() }), { type: "text", text: "Here is the current evidence pack. Copy it from the Evidence pack screen; sign-off stays with your maker and checker." }]);
        return;
      }

      // The offline simulator has no model to instruct, so demo mode sends only the question.
      const prompt = b.demo ? text : [
        "Load the VOLT skill design-finance-architecture with load_skill and read only the reference files this question needs.",
        "Answer as a finance architecture adviser. Do not invent EIR, ECL, FX or regulatory cell identifiers; mark unsupported cases BLOCKED or READY_FOR_REVIEW.",
        "",
        `Workbench state: ${b.context()}`,
        "",
        `Question: ${text}`,
      ].join("\n");
      let out = "";
      const calls = new Map<string, { name: string; input: unknown; summary?: string }>();
      const content = (): Part[] => [
        ...[...calls.entries()].map(([id, c]) => ({ ...toolPart(c.name, {}, c.summary === undefined ? undefined : { summary: c.summary }), toolCallId: id, argsText: JSON.stringify(c.input ?? {}) }) as Part),
        { type: "text", text: out },
      ];
      for await (const e of streamRun({ prompt, agentId: AGENT_ID, sessionId: session.current, demo: b.demo || undefined }, abortSignal)) {
        if (e.type === "text_delta") out += e.text;
        else if (e.type === "tool_call") calls.set(e.callId, { name: e.name, input: e.input });
        else if (e.type === "tool_result") calls.set(e.callId, { ...(calls.get(e.callId) ?? { name: e.name, input: {} }), summary: e.summary });
        else if (e.type === "usage") b.onUsage(e);
        else if (e.type === "error") out += `\n\n**Error:** ${e.message}`;
        else if (e.type === "done") session.current = e.sessionId;
        else continue;
        yield { content: content() };
      }
      yield done(content());
    },
  };
}

function ToolCard({ toolName, result, args }: ToolCallMessagePartProps) {
  const r = result as (Report & { markdown?: string; summary?: string }) | undefined;
  const zero = (args as { model_tokens?: number })?.model_tokens === 0;
  return (
    <div className="aui-tool">
      <div className="row">
        <code>{toolName}</code>
        {zero && <span className="badge full">0 tokens</span>}
        {!r && <span className="spinner" />}
      </div>
      {r?.checks && <ReportView title="Result" report={r} compact />}
      {r?.markdown && (
        <details>
          <summary className="micro">Evidence pack</summary>
          <Markdown text={r.markdown} />
        </details>
      )}
      {r?.summary && <div className="body" style={{ fontSize: 12 }}>{r.summary}</div>}
    </div>
  );
}

const Text = ({ text }: { text: string }) => <Markdown text={text} />;

function UserMessage() {
  return (
    <MessagePrimitive.Root className="aui-msg user">
      <MessagePrimitive.Parts />
    </MessagePrimitive.Root>
  );
}
function AssistantMessage() {
  return (
    <MessagePrimitive.Root className="aui-msg assistant">
      <MessagePrimitive.Parts components={{ Text, tools: { Fallback: ToolCard } }} />
    </MessagePrimitive.Root>
  );
}

const SUGGESTIONS = [
  "Validate the journal",
  "Prove the mapping",
  "Build the evidence pack",
  "Should a mortgage renewal be treated as a derecognition?",
];

export function ChatPanel({ bridge, live }: { bridge: RefObject<WorkbenchBridge | null>; live: boolean }) {
  const session = useRef<string | undefined>(undefined);
  const adapter = useMemo(() => makeAdapter(bridge, session), [bridge]);
  const runtime = useLocalRuntime(adapter);
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ThreadPrimitive.Root className="aui-root">
        <div className="aui-head">
          <div className="micro">Workbench assistant</div>
          <span className={`badge ${live ? "live" : ""}`}>{live ? "Claude" : "Demo replies"}</span>
        </div>
        <ThreadPrimitive.Viewport className="aui-viewport">
          <ThreadPrimitive.Empty>
            <div className="stack" style={{ gap: 8 }}>
              <p className="body" style={{ fontSize: 13, margin: 0 }}>
                Validation and the evidence pack run here at 0 model tokens. Other questions go to the {AGENT_ID} agent, which loads only the skill files it needs.
              </p>
              {SUGGESTIONS.map((s) => (
                <ThreadPrimitive.Suggestion key={s} prompt={s} send className="btn sm aui-suggestion">
                  {s}
                </ThreadPrimitive.Suggestion>
              ))}
            </div>
          </ThreadPrimitive.Empty>
          <ThreadPrimitive.Messages components={{ UserMessage, AssistantMessage }} />
        </ThreadPrimitive.Viewport>
        <ComposerPrimitive.Root className="aui-composer">
          <ComposerPrimitive.Input className="input" placeholder="Ask, or say “validate the journal”" aria-label="Message the workbench assistant" />
          <ComposerPrimitive.Send className="btn sm primary">Send</ComposerPrimitive.Send>
        </ComposerPrimitive.Root>
      </ThreadPrimitive.Root>
    </AssistantRuntimeProvider>
  );
}
