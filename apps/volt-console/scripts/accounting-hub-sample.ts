/**
 * Builds the sample Accounting Hub page from the synthetic fixture and runs the page checks.
 * Usage: npx tsx scripts/accounting-hub-sample.ts <out.html> [volt|client_light|boardroom]
 */
import fs from "node:fs";
import { checkHub, hubSchema } from "../shared/accountingHub.js";
import { hubPage } from "../shared/accountingHubPage.js";

const raw = JSON.parse(fs.readFileSync(new URL("../tests/fixtures/accounting-hub-sample.json", import.meta.url), "utf8"));
if (process.argv[3]) raw.branding = { ...raw.branding, style: process.argv[3] };
const content = hubSchema.parse(raw);
const html = hubPage(content);
const failures = checkHub(content, html);
fs.writeFileSync(process.argv[2] ?? "accounting-hub-sample.html", html);
console.log(`${(html.length / 1024).toFixed(1)} KB, ${failures.length} check failures`);
for (const f of failures) console.log(`- ${f}`);
process.exit(failures.length ? 1 : 0);
