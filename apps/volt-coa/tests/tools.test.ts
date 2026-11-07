import { describe, expect, it } from "vitest";
import { runTool } from "../server/tools";
import { SAMPLE_COA_CSV, SAMPLE_LEGACY_CSV } from "../shared/coa";

describe("runTool", () => {
  it("rejects an unknown tool and invalid input", () => {
    expect(runTool("nope", {}).ok).toBe(false);
    expect(runTool("check_coa", { accounts_csv: 5 }).ok).toBe(false);
  });
  it("reports a CSV with the wrong header as an error", () => {
    expect(runTool("check_coa", { accounts_csv: "a,b\n1,2\n" }).ok).toBe(false);
  });
  it("check_mapping proposes the legacy table only when every check passes", () => {
    const good = runTool("check_mapping", { accounts_csv: SAMPLE_COA_CSV, legacy_csv: SAMPLE_LEGACY_CSV });
    expect(good.proposal).toEqual({ kind: "legacy", csv: SAMPLE_LEGACY_CSV });
    const bad = runTool("check_mapping", { accounts_csv: SAMPLE_COA_CSV, legacy_csv: "code,name,target\n100,Bank,9999\n" });
    expect(bad.proposal).toBeUndefined();
    expect(bad.content).toContain("FAIL M_TARGET_EXISTS");
  });
});
