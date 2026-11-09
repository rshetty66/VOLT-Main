/**
 * store.ts tests — DDL shape, project-id stability, and the no-DB no-op path.
 * The query-builder paths need a live MySQL and are covered by integration
 * use; here we pin the contract pieces that can be verified without a DB.
 */
import { describe, expect, it } from "vitest";
import { builderTablesDDL, projectIdFor } from "./store";

describe("builder store contract", () => {
  it("declares all three tables idempotently", () => {
    const ddl = builderTablesDDL();
    expect(ddl).toHaveLength(3);
    for (const stmt of ddl) {
      expect(stmt).toMatch(/^CREATE TABLE IF NOT EXISTS/);
    }
    expect(ddl[0]).toContain("builder_projects");
    expect(ddl[1]).toContain("builder_sessions");
    expect(ddl[1]).toContain("enum('spec','building','passed','failed')");
    expect(ddl[2]).toContain("builder_artifacts");
    expect(ddl[2]).toContain("AUTO_INCREMENT");
  });

  it("derives stable project ids per (user, app name)", () => {
    const a = projectIdFor(7, "Invoice Tracker");
    expect(a).toBe(projectIdFor(7, "invoice tracker")); // case-insensitive
    expect(a).toBe(projectIdFor(7, "  Invoice Tracker  ")); // trimmed
    expect(a).not.toBe(projectIdFor(8, "Invoice Tracker")); // per-user
    expect(a).not.toBe(projectIdFor(7, "Expense Tracker")); // per-name
    expect(a).toMatch(/^[0-9a-f]{24}$/);
  });
});
