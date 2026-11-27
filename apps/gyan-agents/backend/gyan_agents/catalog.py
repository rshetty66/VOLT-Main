"""Project finance execution profiles onto existing VOLT identities; never register new ones."""
import json
import os
from pathlib import Path

from .schemas import AgentManifest


def load_seeds() -> list[AgentManifest]:
    here = Path(__file__).resolve()
    plugin = Path(os.getenv("VOLT_PLUGIN_DIR", str(here.parents[4] / "plugins/volt")))
    agents = {a["id"] for a in json.loads((plugin / "data/agents.json").read_text())}
    bindings = json.loads((plugin / "data/finance-workflow-bindings.json").read_text())
    profiles = json.loads((here.parent / "seeds/catalog.json").read_text())
    ids = [p["id"] for p in profiles]
    if len(ids) != len(set(ids)) or set(ids) != set(bindings):
        raise ValueError("finance profile IDs must match the binding map exactly once")
    if set(bindings.values()) - agents:
        raise ValueError("finance profile bound to missing VOLT identity")
    return [AgentManifest.model_validate({**p, "volt_agent_id": bindings[p["id"]]}) for p in profiles]
