const acronyms = new Set("AI API CFO ERP FX GAAP IFRS KPI SQL UK US".split(" "));

/** Presentation only. A row always reopens its original, unmodified run. */
export function recentChatLabel(prompt: string): string {
  const plain = prompt
    .replace(/^\s*(?:#{1,6}\s*|>\s*)/gm, "")
    .replace(/[*`]/g, "")
    .replace(/^\s*(?:\d+[.)]\s*)?context\s*(?:&|and)\s*business ask\b\s*[:\-–—]?\s*/i, "")
    .trim();
  let label = plain.split(/\r?\n|[.!?](?:\s|$)/, 1)[0].trim();
  if (/^rerun the deliverable produced earlier in this conversation\b/i.test(label))
    return "Rerun the previous deliverable";
  label = label.replace(/^(?:please\s+)?(?:(?:i\s+)?need|prepare|create|write|build|draft)\s+(?:a|an)\s+/i, "");
  const letters = label.replace(/[^a-z]/gi, "");
  if (letters.length > 4 && letters.replace(/[^A-Z]/g, "").length / letters.length > 0.85)
    label = label.replace(/[A-Za-z]+/g, word => acronyms.has(word.toUpperCase()) ? word.toUpperCase() : word.toLowerCase());
  label = label.charAt(0).toUpperCase() + label.slice(1);
  if (label.length <= 64) return label || "Untitled chat";
  const head = label.slice(0, 64);
  return (/\s/.test(label[64]) ? head : head.replace(/\s+\S*$/, "")).trimEnd() + "…";
}
