/**
 * Deterministic chart-of-accounts core. No AI and no I/O: every figure and verdict the app shows comes from here,
 * and the Claude assistant's proposals are run through the same checks before they are presented.
 */

export type AccountType = "asset" | "liability" | "equity" | "revenue" | "expense";
export const ACCOUNT_TYPES: AccountType[] = ["asset", "liability", "equity", "revenue", "expense"];

export interface Account { code: string; name: string; type: AccountType; parent: string }
export interface LegacyAccount { code: string; name: string }
/** target is a target account code, or RETIRE for a legacy account that carries no balance forward. */
export interface Mapping { legacy: string; target: string }
export interface Check { id: string; ok: boolean; detail: string }

export const RETIRE = "RETIRE";

/** First digit of the natural account code decides the type: 1 asset, 2 liability, 3 equity, 4 revenue, 5-9 expense. */
export function typeForCode(code: string): AccountType | undefined {
  const d = code.trim()[0];
  if (d === "1") return "asset";
  if (d === "2") return "liability";
  if (d === "3") return "equity";
  if (d === "4") return "revenue";
  if (d && d >= "5" && d <= "9") return "expense";
  return undefined;
}

const list = (xs: string[], max = 8) => (xs.length > max ? `${xs.slice(0, max).join(", ")} and ${xs.length - max} more` : xs.join(", "));
const check = (id: string, bad: string[], okText: string, badText: string): Check =>
  bad.length === 0 ? { id, ok: true, detail: okText } : { id, ok: false, detail: `${badText}: ${list(bad)}` };

export function validateCoa(accounts: Account[]): Check[] {
  const byCode = new Map<string, Account>();
  const dup = new Set<string>();
  for (const a of accounts) (byCode.has(a.code) ? dup.add(a.code) : byCode.set(a.code, a));

  const badRange = accounts.filter((a) => typeForCode(a.code) !== a.type).map((a) => `${a.code} (${a.type})`);
  const noParent = accounts.filter((a) => a.parent && !byCode.has(a.parent)).map((a) => `${a.code} -> ${a.parent}`);

  const cyclic: string[] = [];
  for (const a of accounts) {
    const seen = new Set<string>();
    let cur: Account | undefined = a;
    while (cur && cur.parent) {
      if (seen.has(cur.code)) { cyclic.push(a.code); break; }
      seen.add(cur.code);
      cur = byCode.get(cur.parent);
    }
  }

  const badParentType = accounts
    .filter((a) => a.parent && byCode.has(a.parent) && byCode.get(a.parent)!.type !== a.type)
    .map((a) => `${a.code} (${a.type}) under ${a.parent} (${byCode.get(a.parent)!.type})`);

  const naming: string[] = [];
  const siblingNames = new Set<string>();
  for (const a of accounts) {
    if (!a.name.trim()) { naming.push(`${a.code} has a blank name`); continue; }
    const key = `${a.parent}|${a.name.trim().toLowerCase()}`;
    if (siblingNames.has(key)) naming.push(`${a.code} repeats the name "${a.name.trim()}" under ${a.parent || "the root"}`);
    siblingNames.add(key);
  }

  return [
    check("C_UNIQUE_CODES", [...dup], "Every account code is unique", "Duplicate codes"),
    check("C_TYPE_RANGE", badRange, "Every account type matches its code range", "Type disagrees with code range"),
    check("C_PARENT_EXISTS", noParent, "Every parent exists", "Parent not found"),
    check("C_NO_CYCLES", cyclic, "No account is its own ancestor", "Cycle through"),
    check("C_PARENT_TYPE", badParentType, "Every child has the same type as its parent", "Child and parent types differ"),
    check("C_NAMING", naming, "Names are present and unique within each parent", "Naming problems"),
  ];
}

export function validateMapping(target: Account[], legacy: LegacyAccount[], mappings: Mapping[]): Check[] {
  const targetCodes = new Set(target.map((a) => a.code));
  const parents = new Set(target.map((a) => a.parent).filter(Boolean));
  const legacyCodes = new Set(legacy.map((a) => a.code));
  const live = mappings.filter((m) => m.target !== RETIRE);

  const seen = new Set<string>();
  const dupSource = new Set<string>();
  for (const m of mappings) (seen.has(m.legacy) ? dupSource.add(m.legacy) : seen.add(m.legacy));

  return [
    check("M_UNKNOWN_SOURCE", mappings.filter((m) => !legacyCodes.has(m.legacy)).map((m) => m.legacy),
      "Every mapping row refers to a legacy account", "Mapping rows with no legacy account"),
    check("M_NO_DUPLICATE_SOURCE", [...dupSource], "Each legacy account is mapped once", "Legacy accounts mapped more than once"),
    check("M_SOURCE_COVERAGE", legacy.filter((a) => !seen.has(a.code)).map((a) => a.code),
      "Every legacy account is mapped or retired", "Legacy accounts with no mapping"),
    check("M_TARGET_EXISTS", live.filter((m) => !targetCodes.has(m.target)).map((m) => `${m.legacy} -> ${m.target}`),
      "Every target account exists", "Targets not in the new chart"),
    check("M_POSTING_TARGET", live.filter((m) => targetCodes.has(m.target) && parents.has(m.target)).map((m) => `${m.legacy} -> ${m.target}`),
      "Every target is a posting account, not a roll-up parent", "Targets that are roll-up parents"),
  ];
}

// CSV ------------------------------------------------------------------------------------------------------------

/** Minimal RFC 4180 reader: quoted fields, doubled quotes, CRLF or LF, blank lines dropped. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const endField = () => { row.push(field); field = ""; };
  const endRow = () => { endField(); if (row.some((f) => f.trim() !== "")) rows.push(row); row = []; };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") endField();
    else if (c === "\n") endRow();
    else if (c !== "\r") field += c;
  }
  if (field !== "" || row.length) endRow();
  return rows;
}

const esc = (s: string) => (/[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
export const coaToCsv = (accounts: Account[]) =>
  ["code,name,type,parent", ...accounts.map((a) => [a.code, a.name, a.type, a.parent].map(esc).join(","))].join("\n") + "\n";

export function coaFromCsv(text: string): { accounts: Account[]; errors: string[] } {
  const [head, ...rows] = parseCsv(text);
  const errors: string[] = [];
  if (!head || head.map((h) => h.trim().toLowerCase()).join(",") !== "code,name,type,parent")
    return { accounts: [], errors: ["Header must be: code,name,type,parent"] };
  const accounts: Account[] = [];
  rows.forEach((r, i) => {
    const [code = "", name = "", type = "", parent = ""] = r.map((f) => f.trim());
    if (!ACCOUNT_TYPES.includes(type as AccountType)) { errors.push(`Row ${i + 2}: unknown type "${type}"`); return; }
    accounts.push({ code, name, type: type as AccountType, parent });
  });
  return { accounts, errors };
}

export function legacyFromCsv(text: string): { legacy: LegacyAccount[]; mappings: Mapping[]; errors: string[] } {
  const [head, ...rows] = parseCsv(text);
  if (!head || head.map((h) => h.trim().toLowerCase()).join(",") !== "code,name,target")
    return { legacy: [], mappings: [], errors: ["Header must be: code,name,target"] };
  const legacy: LegacyAccount[] = [];
  const mappings: Mapping[] = [];
  for (const r of rows) {
    const [code = "", name = "", target = ""] = r.map((f) => f.trim());
    legacy.push({ code, name });
    if (target) mappings.push({ legacy: code, target });
  }
  return { legacy, mappings, errors: [] };
}

// Samples ----------------------------------------------------------------------------------------------------------

export const SAMPLE_COA_CSV = `code,name,type,parent
1000,Assets,asset,
1100,Cash and equivalents,asset,1000
1110,Operating bank account,asset,1100
1200,Trade receivables,asset,1000
1300,Inventory,asset,1000
1500,Property plant and equipment,asset,1000
2000,Liabilities,liability,
2100,Trade payables,liability,2000
2200,Accrued liabilities,liability,2000
3000,Equity,equity,
3100,Retained earnings,equity,3000
4000,Revenue,revenue,
4100,Product sales,revenue,4000
4200,Service revenue,revenue,4000
5000,Cost of sales,expense,
5100,Materials,expense,5000
5200,Direct labour,expense,5000
6000,Operating expenses,expense,
6100,Salaries and wages,expense,6000
6200,Rent,expense,6000
6300,Depreciation,expense,6000
`;

export const SAMPLE_LEGACY_CSV = `code,name,target
100,Bank - main,1110
110,Accounts receivable,1200
120,Stock,1300
150,Plant and machinery,1500
200,Accounts payable,2100
210,Accruals,2200
300,Retained profits,3100
400,Sales - goods,4100
410,Sales - services,4200
500,Raw materials used,5100
510,Production wages,5200
600,Wages,6100
610,Premises rent,6200
620,Depreciation charge,6300
900,Suspense (obsolete),RETIRE
`;
