/**
 * Builds the sample Accounting Hub page from the synthetic fixture and runs the page checks.
 * Usage: npx tsx scripts/accounting-hub-sample.ts <out.html>
 */
import fs from "node:fs";
import { checkHub, hubSchema } from "../shared/accountingHub.js";
import { hubPage } from "../shared/accountingHubPage.js";

const content = hubSchema.parse(JSON.parse(fs.readFileSync(new URL("../tests/fixtures/accounting-hub-sample.json", import.meta.url), "utf8")));
const html = hubPage(content);
const failures = checkHub(content, html);
fs.writeFileSync(process.argv[2] ?? "accounting-hub-sample.html", html);
console.log(`${(html.length / 1024).toFixed(1)} KB, ${failures.length} check failures`);
for (const f of failures) console.log(`- ${f}`);
process.exit(failures.length ? 1 : 0);
