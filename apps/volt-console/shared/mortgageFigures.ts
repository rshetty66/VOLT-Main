/**
 * Residential-mortgage figures the workbench extracts from a bank's financial statements, the
 * arithmetic ties that must hold between them, and exact scaling to currency units. Shared by the
 * server (extraction request and verification) and the UI (review table and derived journals).
 */

export type EvidenceClass = "CLIENT_DOCUMENT" | "PUBLIC_FILING" | "ILLUSTRATIVE_EXAMPLE";
export type Scale = "units" | "thousands" | "millions" | "billions";

export interface Figure {
  id: string;
  label: string;
  /** Plain decimal string in reporting units, e.g. "412345" or "-6". Magnitudes are positive except other_movements. */
  value: string;
  scale: Scale;
  currency: string;
  /** ISO date the figure is stated at (or the period end for a flow). */
  period: string;
  page: number;
  /** Exact text from the page that shows the value. */
  quote: string;
  evidence_class: EvidenceClass;
}

export const MORTGAGE_FIGURES: { id: string; label: string; hint: string }[] = [
  { id: "gross_loans", label: "Residential mortgages, gross", hint: "gross carrying amount at period end" },
  { id: "allowance_total", label: "Allowance for credit losses, residential mortgages", hint: "as a positive magnitude" },
  { id: "net_loans", label: "Residential mortgages, net", hint: "gross less allowance" },
  { id: "allowance_opening", label: "Allowance, beginning of period", hint: "allowance roll-forward table" },
  { id: "provision", label: "Provision for credit losses", hint: "period expense for residential mortgages" },
  { id: "write_offs", label: "Write-offs", hint: "positive magnitude" },
  { id: "recoveries", label: "Recoveries", hint: "positive magnitude" },
  { id: "other_movements", label: "Exchange rate and other", hint: "signed: negative when it reduces the allowance" },
  { id: "allowance_closing", label: "Allowance, end of period", hint: "allowance roll-forward table" },
  { id: "stage1_allowance", label: "Stage 1 allowance", hint: "IFRS 9 stage split" },
  { id: "stage2_allowance", label: "Stage 2 allowance", hint: "IFRS 9 stage split" },
  { id: "stage3_allowance", label: "Stage 3 allowance", hint: "IFRS 9 stage split" },
];
export const FIGURE_IDS = MORTGAGE_FIGURES.map((f) => f.id);

export interface Tie {
  id: string;
  terms: [string, 1 | -1][];
  tolerance: string;
}

const TIE_TEMPLATES: { id: string; terms: [string, 1 | -1][] }[] = [
  { id: "net_carrying_amount", terms: [["gross_loans", 1], ["allowance_total", -1], ["net_loans", -1]] },
  { id: "allowance_rollforward", terms: [["allowance_opening", 1], ["provision", 1], ["write_offs", -1], ["recoveries", 1], ["other_movements", 1], ["allowance_closing", -1]] },
  { id: "stage_split", terms: [["stage1_allowance", 1], ["stage2_allowance", 1], ["stage3_allowance", 1], ["allowance_closing", -1]] },
  { id: "allowance_agrees", terms: [["allowance_total", 1], ["allowance_closing", -1]] },
];

/**
 * Ties whose figures are all present. Statements round each figure to the reporting unit, so a sum of
 * n rounded figures may be off by up to n x 0.5 units; that bound is the tolerance.
 */
export function standardTies(ids: Iterable<string>): Tie[] {
  const have = new Set(ids);
  return TIE_TEMPLATES.filter((t) => t.terms.every(([id]) => have.has(id))).map((t) => ({
    ...t,
    tolerance: String(t.terms.length * 0.5),
  }));
}

const SCALE_DIGITS: Record<Scale, number> = { units: 0, thousands: 3, millions: 6, billions: 9 };

/** Exact decimal shift from reporting units to currency units with two decimals ("412.5" millions -> "412500000.00"). */
export function toCurrencyUnits(value: string, scale: Scale): string {
  const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value);
  if (!m) throw new Error(`invalid amount ${value}`);
  const [, sign, whole, frac = ""] = m;
  const shift = SCALE_DIGITS[scale];
  const digits = whole + frac.padEnd(shift, "0");
  const intPart = digits.slice(0, whole.length + shift).replace(/^0+(?=\d)/, "");
  const rest = digits.slice(whole.length + shift);
  if (rest.replace(/0+$/, "").length > 2) throw new Error(`${value} ${scale} has more precision than cents`);
  return `${sign}${intPart}.${rest.padEnd(2, "0").slice(0, 2)}`;
}
