import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import appShell from "../src/App.tsx?raw";
import { Icon } from "../src/components/Icon";
import { ReferenceNav, isReferenceView, referenceDefault } from "../src/components/ReferenceNav";

describe("Reference navigation", () => {
  it("does not expose a separate directory shortcut in the top bar", () => {
    const topBar = appShell.match(/<header className="topbar">[\s\S]*?<\/header>/)?.[0];
    expect(topBar).toBeDefined();
    expect(topBar).not.toMatch(/setView\(["'](?:agents|skills)["']\)|Find a skill|Skill Finder|Agent Registry/i);
  });
  it("groups exactly the two directory screens and opens the registry by default", () => {
    expect(["console", "agents", "skills", "workflows", "uploads"].filter(isReferenceView)).toEqual(["agents", "skills"]);
    expect(referenceDefault).toBe("agents");
  });
  it.each([["agents", "Agent Registry"], ["skills", "Skill Finder"]] as const)("marks only the selected destination for %s", (view, label) => {
    const html = renderToStaticMarkup(<ReferenceNav view={view} onSelect={() => {}} />);
    expect(html).toContain('aria-label="Reference sections"');
    expect(html).toContain("Agent Registry");
    expect(html).toContain("Skill Finder");
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html).toMatch(new RegExp(`aria-current="page"[^>]*>${label}</button>`));
  });
  it("has a distinct Reference rail icon", () => {
    expect(renderToStaticMarkup(<Icon name="reference" />)).not.toBe(renderToStaticMarkup(<Icon name="console" />));
  });
});
