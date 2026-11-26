// The "Get started" checklist: what a new project still needs before VOLT gives its best answers.
export interface SetupInput { uploads: number; memory: number; templates: number; chats: number }
export interface SetupStep {
  id: "account" | "knowledge" | "memory" | "template" | "ask";
  title: string;
  hint: string;
  cta: string;
  /** The screen that completes the step; the last step has none and focuses the message box instead. */
  view?: "uploads" | "projects" | "templates";
  done: boolean;
}

export function setupSteps(i: SetupInput): SetupStep[] {
  return [
    { id: "account", title: "Sign in to VOLT", hint: "You are signed in.", cta: "", done: true },
    { id: "knowledge", title: "Add client documents", hint: "Upload a trial balance, policy or board pack so answers cite your client's own files.", cta: "Open knowledge base", view: "uploads", done: i.uploads > 0 },
    { id: "memory", title: "Save project memory", hint: "Record the facts every chat should know, such as the primary ledger or fiscal year end.", cta: "Open project memory", view: "projects", done: i.memory > 0 },
    { id: "template", title: "Load a client template", hint: "Upload the client's Word, Excel or PowerPoint file so deliverables match their format.", cta: "Open templates", view: "templates", done: i.templates > 0 },
    { id: "ask", title: "Ask your first question", hint: "Describe a client situation and let VOLT put the right specialists on it.", cta: "Write a question", done: i.chats > 0 },
  ];
}

export function setupProgress(steps: SetupStep[]): { done: number; total: number; next?: SetupStep } {
  const done = steps.filter((s) => s.done).length;
  return { done, total: steps.length, next: steps.find((s) => !s.done) };
}
