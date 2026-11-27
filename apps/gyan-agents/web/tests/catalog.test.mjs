import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import test from "node:test";

// Integration checks use the production bundle (run `npm run build` first).
test("the read-only index distinguishes populated, empty and unavailable catalogs", async (t) => {
  let body = [];
  let status = 200;
  let agentRequests = 0;
  const api = createServer((req, res) => {
    if (req.method !== "GET" || req.url !== "/agents") {
      res.writeHead(404).end();
      return;
    }
    agentRequests++;
    res.writeHead(status, { "Content-Type": "application/json" }).end(JSON.stringify(body));
  });
  api.listen(0, "127.0.0.1");
  await once(api, "listening");
  t.after(() => { api.closeAllConnections(); api.close(); });

  const app = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", "0"], {
    env: {
      ...process.env,
      GYAN_AGENTS_API_URL: `http://127.0.0.1:${api.address().port}`,
      VOLT_CONSOLE_URL: "https://volt.example.test",
    },
    stdio: ["ignore", "pipe", "inherit"],
  });
  t.after(() => { app.kill(); });
  const address = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Next.js startup timed out")), 15000);
    let output = "";
    app.stdout.on("data", (chunk) => {
      output += chunk;
      const url = output.match(/Local:\s+(http:\/\/(?:localhost|127\.0\.0\.1):\d+)/);
      if (url && output.includes("Ready")) { clearTimeout(timeout); resolve(url[1]); }
    });
    app.once("exit", () => { clearTimeout(timeout); reject(new Error("Next.js exited")); });
  });
  const html = async () => (await fetch(address)).text();

  assert.match(await html(), /No finance profiles registered/);
  body = [{ id: "demo", name: "Ledger reconciliation", description: "Review ledger balances.", domain: "r2r" }];
  const catalog = await html();
  assert.doesNotMatch(catalog, /Ledger reconciliation|Review ledger balances/);
  assert.match(catalog, /Open VOLT console/);
  assert.match(catalog, /href="https:\/\/volt\.example\.test\/"/);
  assert.match(catalog.replaceAll("<!-- -->", ""), />1 profile<\/dd>/);
  assert.match(catalog, /Record to report/);
  body = [{ id: "bad" }];
  assert.match(await html(), /Registry unavailable/);
  status = 503;
  const unavailable = await html();
  assert.match(unavailable, /Registry unavailable/);
  assert.doesNotMatch(unavailable, /No finance profiles registered|Ledger reconciliation|Domain coverage|Record to report/);
  assert.equal(agentRequests, 4);
});
