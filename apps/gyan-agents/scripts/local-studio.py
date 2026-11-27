"""Launch a private, persistent local VOLT/Gyan demo. No Render or model keys."""
import getpass
import json
import os
from pathlib import Path
import secrets
import socket
import subprocess
import time
from contextlib import ExitStack
from urllib.request import urlopen

root = Path(__file__).resolve().parents[3]
web = root / "apps/volt-console"
backend = root / "apps/gyan-agents/backend"
runtime = backend / ".venv/bin/uvicorn"
tsx = web / "node_modules/.bin/tsx"
if not all(x.exists() for x in (runtime, tsx, web / "dist/index.html")):
    raise SystemExit("Install and build the dependencies first. See apps/gyan-agents/RUNTIME.md.")
for port in (8941, 8942):
    with socket.socket() as check:
        check.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            check.bind(("127.0.0.1", port))
        except OSError:
            raise SystemExit(f"Port {port} is in use. Stop the other local demo before launching.")
os.umask(0o077)
state = Path.home() / ".volt-gyan-local"
state.mkdir(exist_ok=True)
env = {k: os.environ[k] for k in ("HOME", "PATH", "LANG", "TMPDIR") if k in os.environ}
env.update(VOLT_HOST="127.0.0.1", PORT="8941", VOLT_MODE="demo", NODE_ENV="production",
           VOLT_DATA_DIR=str(state / "volt"), VOLT_AUTH_MODE="password",
           VOLT_SESSION_SECRET=secrets.token_hex(32), GYAN_INTERNAL_TOKEN=secrets.token_hex(32),
           GYAN_INTERNAL_URL="http://127.0.0.1:8942", GYAN_STUDIO_DIR=str(state / "workspaces"),
           GYAN_DATABASE_URL="sqlite:///" + str(state / "foundation.sqlite"),
           GYAN_PROJECT_ROLES=json.dumps({"general": {"designer": "designer"}}))
if not (state / "volt/users.json").exists():
    password = getpass.getpass("Choose a local designer password (10+ characters): ")
    subprocess.run([tsx, "scripts/add-user.ts", "designer"], cwd=web, env=env,
                   input=password + "\n", text=True, check=True)
    del password
subprocess.run([backend / ".venv/bin/python", "-m", "gyan_agents", "init"], cwd=backend, env=env, check=True)
with ExitStack() as stack:
    try:
        for cwd, args, health in (
            (backend, [runtime, "gyan_agents.api:create_app", "--factory", "--host", "127.0.0.1", "--port", "8942"], "http://127.0.0.1:8942/health"),
            (web, [tsx, "server/index.ts"], "http://127.0.0.1:8941/"),
        ):
            proc = subprocess.Popen(args, cwd=cwd, env=env)
            stack.callback(proc.wait)
            stack.callback(proc.terminate)
            for _ in range(100):
                if proc.poll() is not None:
                    raise SystemExit("Service failed to start; inspect the local log.")
                try:
                    with urlopen(health, timeout=1):
                        break
                except OSError:
                    time.sleep(.15)
            else:
                raise SystemExit("Local service did not become ready.")
        print("Open http://127.0.0.1:8941 and sign in as designer. Ctrl+C stops both services.", flush=True)
        proc.wait()
    except KeyboardInterrupt:
        pass
