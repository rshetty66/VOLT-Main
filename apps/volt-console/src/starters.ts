/** The four starter cards on the home screen: a category, an icon (components/Icon.tsx) and a prompt to edit. */
export interface Starter {
  category: string;
  phoneTitle: string;
  icon: string;
  title: string;
  prompt: string;
}

export const STARTERS: Starter[] = [
  { category: "Close", phoneTitle: "Close", icon: "workflows", title: "Plan a faster close", prompt: "Our month-end close takes 11 days and the board wants 5. Build a plan to get there, with the quick wins first." },
  { category: "Research", phoneTitle: "Market", icon: "search", title: "Scan a market", prompt: "Map the finance transformation consulting market in Canada: the main players, what they sell to banks and insurers, and recent deals." },
  { category: "Accounting", phoneTitle: "IFRS 17", icon: "ledger", title: "Answer a treatment question", prompt: "How should a Canadian insurer present the IFRS 17 risk adjustment, and how does it differ under US GAAP LDTI?" },
  { category: "Board", phoneTitle: "Board", icon: "analytics", title: "Draft a board paper", prompt: "Draft a one-page board paper recommending whether to replace our EPM tool, with options, costs in CAD and risks." },
];
