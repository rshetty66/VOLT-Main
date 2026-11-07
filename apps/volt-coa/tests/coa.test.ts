import { describe, expect, it } from "vitest";
import {
  coaFromCsv, coaToCsv, legacyFromCsv, parseCsv, validateCoa, validateMapping,
  SAMPLE_COA_CSV, SAMPLE_LEGACY_CSV, type Account,
} from "../shared/coa";

const base: Account[] = [
  { code: "1000", name: "Assets", type: "asset", parent: "" },
  { code: "1100", name: "Cash", type: "asset", parent: "1000" },
  { code: "4000", name: "Revenue", type: "revenue", parent: "" },
  { code: "4100", name: "Product sales", type: "revenue", parent: "4000" },
];
const ok = (cs: ReturnType<typeof validateCoa>, id: string) => cs.find((c) => c.id === id)!.ok;

describe("parseCsv", () => {
  it("handles quotes, embedded commas and CRLF", () => {
    expect(parseCsv('a,b\r\n"x, y","say ""hi"""\r\n')).toEqual([["a", "b"], ["x, y", 'say "hi"']]);
  });
  it("drops blank lines", () => {
    expect(parseCsv("a\n\n\nb\n")).toEqual([["a"], ["b"]]);
  });
});

describe("validateCoa", () => {
  it("passes a clean chart", () => {
    expect(validateCoa(base).every((c) => c.ok)).toBe(true);
  });
  it("flags duplicate codes", () => {
    expect(ok(validateCoa([...base, { ...base[1] }]), "C_UNIQUE_CODES")).toBe(false);
  });
  it("flags a type that disagrees with the code range", () => {
    const bad = base.map((a) => (a.code === "1100" ? { ...a, type: "expense" as const } : a));
    const cs = validateCoa(bad);
    expect(ok(cs, "C_TYPE_RANGE")).toBe(false);
    expect(cs.find((c) => c.id === "C_TYPE_RANGE")!.detail).toContain("1100");
  });
  it("flags a missing parent", () => {
    expect(ok(validateCoa([...base, { code: "1200", name: "AR", type: "asset", parent: "1999" }]), "C_PARENT_EXISTS")).toBe(false);
  });
  it("flags a cycle", () => {
    const cyc: Account[] = [
      { code: "1000", name: "A", type: "asset", parent: "1100" },
      { code: "1100", name: "B", type: "asset", parent: "1000" },
    ];
    expect(ok(validateCoa(cyc), "C_NO_CYCLES")).toBe(false);
  });
  it("flags a child whose type differs from its parent", () => {
    const bad = base.map((a) => (a.code === "4100" ? { ...a, parent: "1000" } : a));
    expect(ok(validateCoa(bad), "C_PARENT_TYPE")).toBe(false);
  });
  it("flags blank and sibling-duplicate names", () => {
    expect(ok(validateCoa([...base, { code: "1200", name: " ", type: "asset", parent: "1000" }]), "C_NAMING")).toBe(false);
    expect(ok(validateCoa([...base, { code: "1200", name: "cash", type: "asset", parent: "1000" }]), "C_NAMING")).toBe(false);
  });
  it("does not crash on a cycle when checking other rules", () => {
    const cyc: Account[] = [{ code: "1000", name: "A", type: "asset", parent: "1000" }];
    expect(() => validateCoa(cyc)).not.toThrow();
  });
});

describe("validateMapping", () => {
  const legacy = [{ code: "100", name: "Bank" }, { code: "200", name: "Sales" }, { code: "900", name: "Old" }];
  const good = [
    { legacy: "100", target: "1100" },
    { legacy: "200", target: "4100" },
    { legacy: "900", target: "RETIRE" },
  ];
  it("passes a complete mapping", () => {
    expect(validateMapping(base, legacy, good).every((c) => c.ok)).toBe(true);
  });
  it("flags unmapped legacy accounts", () => {
    const cs = validateMapping(base, legacy, good.slice(0, 2));
    const c = cs.find((x) => x.id === "M_SOURCE_COVERAGE")!;
    expect(c.ok).toBe(false);
    expect(c.detail).toContain("900");
  });
  it("flags a target that does not exist", () => {
    expect(validateMapping(base, legacy, [{ legacy: "100", target: "1999" }, ...good.slice(1)]).find((c) => c.id === "M_TARGET_EXISTS")!.ok).toBe(false);
  });
  it("flags a target that is a roll-up parent, not a posting account", () => {
    expect(validateMapping(base, legacy, [{ legacy: "100", target: "1000" }, ...good.slice(1)]).find((c) => c.id === "M_POSTING_TARGET")!.ok).toBe(false);
  });
  it("flags a legacy account mapped twice and one not in the legacy chart", () => {
    const cs = validateMapping(base, legacy, [...good, { legacy: "100", target: "1100" }, { legacy: "777", target: "1100" }]);
    expect(cs.find((c) => c.id === "M_NO_DUPLICATE_SOURCE")!.ok).toBe(false);
    expect(cs.find((c) => c.id === "M_UNKNOWN_SOURCE")!.ok).toBe(false);
  });
});

describe("CSV round trip and samples", () => {
  it("round-trips the COA", () => {
    const { accounts, errors } = coaFromCsv(coaToCsv(base));
    expect(errors).toEqual([]);
    expect(accounts).toEqual(base);
  });
  it("reports rows with an unknown type", () => {
    const { errors } = coaFromCsv("code,name,type,parent\n1000,Assets,bogus,\n");
    expect(errors[0]).toContain("bogus");
  });
  it("splits a legacy CSV into accounts and mappings, blank target means unmapped", () => {
    const { legacy, mappings } = legacyFromCsv("code,name,target\n100,Bank,1100\n200,Sales,\n");
    expect(legacy).toHaveLength(2);
    expect(mappings).toEqual([{ legacy: "100", target: "1100" }]);
  });
  it("ships samples that pass every check", () => {
    const { accounts } = coaFromCsv(SAMPLE_COA_CSV);
    const { legacy, mappings } = legacyFromCsv(SAMPLE_LEGACY_CSV);
    expect(validateCoa(accounts).filter((c) => !c.ok)).toEqual([]);
    expect(validateMapping(accounts, legacy, mappings).filter((c) => !c.ok)).toEqual([]);
  });
});
