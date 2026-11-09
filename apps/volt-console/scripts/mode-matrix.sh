#!/usr/bin/env bash
# Mode matrix — fails if the CopilotKit layer leaks into demo mode or goes
# missing in live mode. Run before any release that touches the workbench
# copilot. Requires: npm install already run (tsx is a devDependency).
set -euo pipefail
cd "$(dirname "$0")/.."

echo "== build =="
npm run build >/dev/null

echo "== copilot must be a separate lazy chunk, never in the entry =="
ENTRY=$(ls dist/assets/index-*.js | head -1)
if grep -q "CopilotKitProvider" "$ENTRY"; then
  echo "FAIL: copilot statically bundled into entry chunk"; exit 1
fi
ls dist/assets/WorkbenchCopilot-*.js >/dev/null || { echo "FAIL: copilot chunk missing (code-split regressed)"; exit 1; }
echo "ok: copilot is a lazy chunk"

echo "== demo server must not mount /api/copilotkit =="
env -u ANTHROPIC_API_KEY -u ANTHROPIC_AUTH_TOKEN -u ANTHROPIC_PROFILE \
  -u ANTHROPIC_FEDERATION_RULE_ID VOLT_MODE=demo PORT=8811 \
  node --import tsx server/index.ts & DEMO_PID=$!
trap 'kill $DEMO_PID $LIVE_PID 2>/dev/null || true' EXIT
sleep 3
curl -sf http://localhost:8811/api/healthz | grep -q '"copilotkit":null' \
  || { echo "FAIL: healthz reports a copilot path in demo mode"; exit 1; }
code=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8811/api/copilotkit/info)
[ "$code" = "404" ] || { echo "FAIL: /api/copilotkit answered $code in demo mode"; exit 1; }
echo "ok: demo exposes no copilot endpoint"

echo "== live server must mount it =="
kill $DEMO_PID 2>/dev/null || true; sleep 1
ANTHROPIC_API_KEY=test-boot-only VOLT_MODE=live PORT=8812 \
  node --import tsx server/index.ts & LIVE_PID=$!
sleep 3
curl -sf http://localhost:8812/api/healthz | grep -q '"copilotkit":"/api/copilotkit"' \
  || { echo "FAIL: healthz missing copilot path in live mode"; exit 1; }
curl -sf http://localhost:8812/api/copilotkit/info >/dev/null \
  || { echo "FAIL: /info not served in live mode"; exit 1; }
echo "ok: live mode mounts the runtime"
echo "MODE MATRIX PASS"
