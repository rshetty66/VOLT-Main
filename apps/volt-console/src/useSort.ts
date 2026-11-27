import { useMemo, useState } from "react";

export type SortDir = "asc" | "desc";

/** Sorts rows by a column key; numbers and strings compare naturally, missing values go last. */
export function sortRows<T>(rows: T[], get: (row: T) => number | string | undefined, dir: SortDir): T[] {
  return [...rows].sort((a, b) => {
    const x = get(a);
    const y = get(b);
    if (x === undefined || y === undefined) return x === y ? 0 : x === undefined ? 1 : -1;
    const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
    return dir === "asc" ? c : -c;
  });
}

/**
 * Sortable tables: `rows` in the chosen order, and `header(key, label)` props for a column button
 * (click to sort, click again to reverse; aria-sort tells screen readers).
 */
export function useSort<T, K extends string>(rows: T[], columns: Record<K, (row: T) => number | string | undefined>, initial: { key: K; dir: SortDir }) {
  const [sort, setSort] = useState(initial);
  const sorted = useMemo(() => sortRows(rows, columns[sort.key], sort.dir), [rows, columns, sort]);
  const header = (key: K) => ({
    "aria-sort": (sort.key === key ? (sort.dir === "asc" ? "ascending" : "descending") : "none") as "ascending" | "descending" | "none",
    onClick: () => setSort((s) => ({ key, dir: s.key === key && s.dir === "desc" ? "asc" : "desc" })),
    marker: sort.key === key ? (sort.dir === "asc" ? " ↑" : " ↓") : "",
  });
  return { rows: sorted, header };
}
