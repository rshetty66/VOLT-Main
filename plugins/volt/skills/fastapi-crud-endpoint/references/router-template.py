"""<Domain> API — <one line on what this surface does>.

<Any non-obvious contract callers must know. Example: "All endpoints accept an
optional project_id query param to scope to a project's store; omitting it uses
the global store.">

Copy this file to api/routes/<domain>.py, replace every <domain>/<Thing>, then
register it in api/main.py:

    from api.routes.<domain> import router as <domain>_router
    app.include_router(<domain>_router)
"""
from __future__ import annotations

import json
import logging
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from paths import DATA_ROOT

logger = logging.getLogger("routes.<domain>")

router = APIRouter(prefix="/api/<domain>", tags=["<domain>"])

# ponytail: one JSON file per record under DATA_ROOT. Ceiling is a few thousand
# records and a single writer; move to SQLite if listing gets slow or concurrent
# writes start colliding.
_STORE = DATA_ROOT / "<domain>"


def _store() -> Path:
    _STORE.mkdir(parents=True, exist_ok=True)
    return _STORE


def _path_for(thing_id: str) -> Path:
    # Reject anything that is not a plain id so a caller cannot escape the store.
    if not thing_id or "/" in thing_id or "\\" in thing_id or thing_id.startswith("."):
        raise HTTPException(400, "Invalid id")
    return _store() / f"{thing_id}.json"


# ── Models — the API contract ────────────────────────────────────────────────

class CreateThingRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    notes: str | None = Field(None, max_length=10_000)
    project_id: str | None = None


class UpdateThingRequest(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    notes: str | None = Field(None, max_length=10_000)


class ThingResponse(BaseModel):
    id: str
    name: str
    notes: str | None = None
    project_id: str | None = None
    created_at: str
    updated_at: str


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/things", response_model=ThingResponse, status_code=201)
def create_thing(req: CreateThingRequest) -> ThingResponse:
    """Create a thing."""
    now = datetime.now(timezone.utc).isoformat()
    record = {
        "id": uuid.uuid4().hex[:12],
        "name": req.name,
        "notes": req.notes,
        "project_id": req.project_id,
        "created_at": now,
        "updated_at": now,
    }
    _path_for(record["id"]).write_text(json.dumps(record, indent=2), encoding="utf-8")
    return ThingResponse(**record)


@router.get("/things", response_model=list[ThingResponse])
def list_things(
    project_id: str | None = Query(None, description="Scope to one project."),
    limit: int = Query(100, ge=1, le=1000),
) -> list[ThingResponse]:
    """List things, newest first."""
    records = []
    for p in _store().glob("*.json"):
        try:
            records.append(json.loads(p.read_text(encoding="utf-8")))
        except (OSError, json.JSONDecodeError) as e:
            # One corrupt file must not 500 the whole listing.
            logger.warning("Skipping unreadable record %s: %s", p.name, e)
    if project_id:
        records = [r for r in records if r.get("project_id") == project_id]
    records.sort(key=lambda r: r.get("created_at", ""), reverse=True)
    return [ThingResponse(**r) for r in records[:limit]]


@router.get("/things/{thing_id}", response_model=ThingResponse)
def get_thing(thing_id: str) -> ThingResponse:
    """Fetch one thing."""
    p = _path_for(thing_id)
    if not p.exists():
        raise HTTPException(404, f"Thing {thing_id} not found")
    return ThingResponse(**json.loads(p.read_text(encoding="utf-8")))


@router.patch("/things/{thing_id}", response_model=ThingResponse)
def update_thing(thing_id: str, req: UpdateThingRequest) -> ThingResponse:
    """Partially update a thing. Unset fields are left unchanged."""
    p = _path_for(thing_id)
    if not p.exists():
        raise HTTPException(404, f"Thing {thing_id} not found")
    record = json.loads(p.read_text(encoding="utf-8"))
    record.update({k: v for k, v in req.model_dump(exclude_unset=True).items()})
    record["updated_at"] = datetime.now(timezone.utc).isoformat()
    p.write_text(json.dumps(record, indent=2), encoding="utf-8")
    return ThingResponse(**record)


@router.delete("/things/{thing_id}", status_code=204)
def delete_thing(thing_id: str) -> None:
    """Delete a thing. 404 if it never existed, so the caller is not misled."""
    p = _path_for(thing_id)
    if not p.exists():
        raise HTTPException(404, f"Thing {thing_id} not found")
    p.unlink()
