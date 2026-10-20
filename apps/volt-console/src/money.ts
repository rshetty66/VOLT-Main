/** Formats an estimated cost in US dollars: cents normally, a tenth of a cent for tiny amounts. */
export function usd(n: number | null | undefined): string {
  if (n == null) return "-";
  if (n === 0) return "$0.00";
  if (n < 0.01) return `$${n.toFixed(3)}`;
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Thousands of tokens, e.g. 213k. */
export const ktok = (n: number) => (n >= 10_000 ? `${Math.round(n / 1000)}k` : n.toLocaleString());
