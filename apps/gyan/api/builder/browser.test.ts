import { describe, expect, it } from "vitest";
import { chromiumPath } from "./browser";

describe("chromiumPath", () => {
  it("honours the BUILDER_CHROME_PATH env override", () => {
    expect(
      chromiumPath({ BUILDER_CHROME_PATH: "/opt/chrome" } as NodeJS.ProcessEnv),
    ).toBe("/opt/chrome");
  });
}
