import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { loadCatalog, loadSkillBody } from "../server/catalog";
import { runLocalTool } from "../server/tools";
import { lintSkill } from "../shared/skillLint";

const catalog = loadCatalog();

describe("instaAggent skill", () => {
  it("is shipped, loadable from chat and passes the skill checks", async () => {
    const skill = loadSkillBody("insta-aggent");
    expect(skill).not.toBeNull();
    for (let n = 1; n <= 6; n++) expect(skill!.body).toContain(`### Stage ${n}:`);
    const description = skill!.body.match(/^description: (.*)$/m)?.[1] ?? "";
    expect(lintSkill(skill!.body, description).failed).toEqual([]);
    const r = await runLocalTool(catalog, "load_skill", { skill_id: "insta-aggent" });
    expect(r.ok).toBe(true);
  });

  it("is routed from the VOLT chat lead prompt and kept by the importer", () => {
    const orchestrator = fs.readFileSync(path.join(__dirname, "../server/orchestrator.ts"), "utf8");
    expect(orchestrator).toContain("load_skill insta-aggent");
    const importer = fs.readFileSync(path.join(__dirname, "../../../plugins/volt/tools/import_volt.py"), "utf8");
    expect(importer).toMatch(/HAND_WRITTEN_SKILLS = \{[^}]*"insta-aggent"/);
  });
});
