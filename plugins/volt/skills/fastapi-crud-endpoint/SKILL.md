---
name: fastapi-crud-endpoint
description: Add a FastAPI route or router to this app following its existing conventions - APIRouter prefix, Pydantic request/response models, DATA_ROOT persistence, graceful degradation, and registration in api/main.py. Use when adding or changing an HTTP endpoint.
category: Engineering Practice
disable-model-invocation: true
---

# Adding a FastAPI endpoint

Routes live in `api/routes/<domain>.py`, one module per domain, each exporting a `router`
that `api/main.py` includes. Match the surrounding code — this app has settled conventions
and a new route that ignores them is the one that breaks in the cluster.

## Decide first: new router or existing one?

**Add to an existing router** when the endpoint belongs to a domain that already has a
module (`knowledge`, `finance`, `reconciliation`, `chat`, …). This is the common case.

**Create a new router** only for a genuinely new domain with its own prefix. A new module
costs a registration line in `api/main.py` and a new import — do not pay it for one endpoint
that belongs somewhere else.

## Module skeleton

```python
"""<Domain> API — <one line on what this surface does>.

<Why it exists / any non-obvious contract, e.g. "All endpoints accept an optional
project_id to scope to a project; omitted means the global store.">
"""
from __future__ import annotations

import logging
import sys
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from paths import DATA_ROOT

logger = logging.getLogger("routes.<domain>")

router = APIRouter(prefix="/api/<domain>", tags=["<domain>"])
```

The `sys.path.insert` is how every route module in this app reaches top-level modules
(`paths`, `agents`, `recon_engine`). Keep it above the first-party imports, and keep the
`from __future__ import annotations` line first.

Full example: [`references/router-template.py`](references/router-template.py)

## Conventions that are not optional

### Prefix and tags
`prefix="/api/<domain>"`, `tags=["<domain>"]`. The frontend calls `/api/...`; a route
without the prefix will 404 behind the ingress.

### Pydantic models for every body
Request and response bodies are `BaseModel` subclasses declared in the same module.
No bare `dict` in a signature — the model *is* the API contract, and it is what generates
the schema the frontend reads.

```python
class CreateThingRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    project_id: str | None = None

class ThingResponse(BaseModel):
    id: str
    name: str
    created_at: str
```

Declare `response_model=` on the decorator. Validate at the boundary — this is a trust
boundary and validation here is never the thing to simplify away.

### Status codes
- `201` on create (`status_code=201`)
- `404` via `HTTPException(404, "Thing <id> not found")` — never return `None` for missing
- `400` for a bad request the caller can fix; `422` is FastAPI's own validation response
- `204` on delete with no body

### Persistence
Anything on disk goes under `DATA_ROOT` from `paths`. Never hardcode a path, never write
next to the source files — the container's writable volume is `DATA_ROOT` and nothing else
is guaranteed to survive a restart.

```python
_STORE = DATA_ROOT / "<domain>"
_STORE.mkdir(parents=True, exist_ok=True)   # at module import or first use
```

### Graceful degradation
This app's rule is that an optional dependency being down degrades the response; it does
not 500 the app. Wrap optional integrations (Oracle MCP, SharePoint, an LLM call), log a
warning, and return a usable answer.

```python
try:
    data = fetch_from_optional_source(...)
except Exception as e:  # noqa: BLE001 - report and degrade, never break the route
    logger.warning("<source> unavailable: %s", e)
    data = []
```

A genuinely required dependency failing *should* raise — do not swallow errors that mean
the response is wrong. The test is: would the caller be misled by the degraded answer?

### Async or sync
Use `async def` when the handler awaits something. Use plain `def` when the work is
synchronous — FastAPI runs it in a threadpool, which is correct for CPU or blocking I/O.
Never call blocking code inside `async def`; that stalls the event loop and kills SSE
streaming for every other session.

## Registering the router

Two lines in `api/main.py`, following the existing pattern:

```python
from api.routes.<domain> import router as <domain>_router
...
app.include_router(<domain>_router)
```

Forgetting this is the single most common mistake: every endpoint returns 404 and the code
looks perfect.

## Checklist

- [ ] `prefix="/api/<domain>"` and `tags=[...]` set
- [ ] Pydantic models for request body and response; `response_model=` on the decorator
- [ ] Input validated at the boundary (lengths, enums, ranges)
- [ ] `404` for missing resources, `201` for create, `204` for delete
- [ ] Disk writes under `DATA_ROOT`
- [ ] Optional dependencies wrapped and degrading with a logged warning
- [ ] No blocking call inside an `async def`
- [ ] Router imported and `include_router`-ed in `api/main.py`
- [ ] One test in `tests/` that fails if the endpoint breaks (see below)

## Test

One test per endpoint, in `tests/test_<domain>.py`, using the app's existing test style.
The smallest thing that fails if the logic breaks:

```python
from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app)

def test_create_and_get_thing():
    r = client.post("/api/<domain>/things", json={"name": "x"})
    assert r.status_code == 201, r.text
    thing_id = r.json()["id"]
    assert client.get(f"/api/<domain>/things/{thing_id}").status_code == 200
    assert client.get("/api/<domain>/things/nope").status_code == 404
```

Cover the 404 and one validation rejection. Do not write a test per field.
