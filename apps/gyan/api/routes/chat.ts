/**
 * routes/chat.ts — VOLT live chat endpoint (plain REST, NDJSON stream).
 *
 * Protocol — one JSON object per line:
 *   {"t":"run","agents":[{id,name,lineLabel,role,model}]}   agents engaged
 *   {"t":"delta","d":"..."}                            text delta
 *   {"t":"done","model":"...","usage":{...}}           stream finished cleanly
 *   {"t":"error","kind":"...","message":"..."}         typed AI failure
 *
 * NDJSON instead of the AI SDK data-stream protocol so the client stays a
 * single dependency-free fetch() reader.
 */
import { Hono } from "hono";
import { streamText, type ModelMessage } from "ai";
import { kimiGw, defaultModel } from "../ai/provider";
import { classifyAiError } from "../ai/ai-client";
import { matchAgents, systemPrompt, modelFor } from "../ai/volt";
import { selectDepthPacks } from "../ai/depth";
import { log } from "../lib/logger";

interface IncomingMessage {
  role: "user" | "assistant";
  content: string;
}

export const chatRoutes = new Hono();

const enc = new TextEncoder();

function classifyKind(err: unknown): string {
  const name = (err as { name?: string })?.name ?? "";
  switch (name) {
    case "AiUnavailable":
      return "unavailable";
    case "ContentRejected":
      return "rejected";
    case "AiMisconfigured":
      return "misconfigured";
    case "AiInvalidRequest":
      return "invalid";
    default:
      return "transient";
  }
}

chatRoutes.post("/", async (c) => {
  let body: { messages?: IncomingMessage[]; visualMode?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  const messages = (body.messages ?? []).filter(
    (m) =>
      (m.role === "user" || m.role === "assistant") &&
      typeof m.content === "string" &&
      m.content.trim().length > 0,
  );
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUser) return c.json({ error: "No user message" }, 400);

  const agents = matchAgents(lastUser.content);
  const packs = selectDepthPacks(lastUser.content);

  const modelMessages: ModelMessage[] = [
    {
      role: "system",
      content: systemPrompt({
        architecture: body.visualMode === "architecture",
        agents,
        packs,
      }),
    },
    ...messages.slice(-20).map((m) => ({ role: m.role, content: m.content }) as ModelMessage),
  ];

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(enc.encode(JSON.stringify(obj) + "\n"));
      try {
        if (agents.length > 0) {
          send({
            t: "run",
            agents: agents.map((a) => {
              const m = modelFor(a.id);
              return {
                id: a.id,
                name: a.name,
                lineLabel: a.lineLabel,
                role: a.role,
                model: { id: m.id, name: m.name, kind: m.kind },
              };
            }),
          });
        }
        const modelId = await defaultModel();
        const result = streamText({
          model: kimiGw(modelId),
          messages: modelMessages,
          onError: ({ error }) => {
            const err = classifyAiError(error);
            log.error("chat stream error", {
              error: err.message,
              kind: classifyKind(err),
            });
            send({ t: "error", kind: classifyKind(err), message: err.message });
            try {
              controller.close();
            } catch {
              /* already closed */
            }
          },
        });
        for await (const delta of result.textStream) {
          send({ t: "delta", d: delta });
        }
        const usage = await result.usage;
        send({
          t: "done",
          model: modelId,
          usage: usage
            ? {
                inputTokens: usage.inputTokens,
                outputTokens: usage.outputTokens,
              }
            : undefined,
        });
        controller.close();
      } catch (err) {
        const classified = classifyAiError(err);
        log.error("chat request failed", {
          error: classified.message,
          kind: classifyKind(classified),
        });
        send({
          t: "error",
          kind: classifyKind(classified),
          message: classified.message,
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
});
