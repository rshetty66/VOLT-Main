import { defineConfig } from "vitest/config";

// Server logs are useful when running the console, noise in test output: warnings and errors only.
export default defineConfig({ test: { env: { VOLT_LOG_LEVEL: "warn" } } });
