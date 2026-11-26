// Sample prompt ideas shown under the chat examples. Written in VOLT's own words; the methods were picked from the
// CC0 prompts in f/prompts.chat (see project-files volt-prompts/relevant-prompts.md). Clicking one fills the message box.
export interface PromptIdeaGroup {
  group: string;
  ideas: string[];
}

export const PROMPT_IDEAS: PromptIdeaGroup[] = [
  {
    group: "Check and challenge",
    ideas: [
      "Fact-check this claim against its source. Quote the exact lines that support it and rate it supported, contradicted or not enough information: ",
      "Red-team our 5-day close plan: list the weakest assumptions, the failure points and what breaks first.",
      "Stress-test this business case with base, best and worst cases, and rank the risks by impact and likelihood.",
    ],
  },
  {
    group: "Data, SQL and reconciliation",
    ideas: [
      "Reconcile the trial balance against the GL by account, ignore formatting differences, and bridge the control totals to the cent.",
      "Review this table design for flaws: money in float columns, missing keys, timestamps without time zone. Return corrected DDL.",
      "Explain this SQL to a CFO in plain words: the business question it answers, its filters and date ranges, and any risks.",
    ],
  },
  {
    group: "Treasury, regulation and AI",
    ideas: [
      "Build a 13-week cash forecast for a credit union with a base and a stress case. Show the low point and the week we breach the liquidity buffer.",
      "Scan the regulations that affect an IFRS 17 programme at a Canadian insurer, with key requirements and timelines, and cite each source.",
      "Interview me about our intercompany reconciliation process, then tell me whether AI can support it fully, partly or not at all.",
    ],
  },
];
