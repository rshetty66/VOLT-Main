import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadConsoleEnv } from "../server/env";

describe("console .env loading", () => {
  it("loads apps/volt-console/.env without overriding variables already set", () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "volt-env-")), ".env");
    fs.writeFileSync(file, "VOLT_ENV_TEST_FROM_FILE=file\nVOLT_ENV_TEST_SHELL=file\n");
    process.env.VOLT_ENV_TEST_SHELL = "shell";
    expect(loadConsoleEnv(file)).toBe(true);
    expect(process.env.VOLT_ENV_TEST_FROM_FILE).toBe("file");
    expect(process.env.VOLT_ENV_TEST_SHELL).toBe("shell");
  });

  it("is a no-op when there is no .env file", () => {
    expect(loadConsoleEnv(path.join(os.tmpdir(), "no-such-dir-volt", ".env"))).toBe(false);
  });
});
