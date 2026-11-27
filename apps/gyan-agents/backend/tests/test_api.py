from collections import Counter

from fastapi.testclient import TestClient

from gyan_agents import db
from gyan_agents.api import create_app
from gyan_agents.catalog import load_seeds


def test_seeded_http_contracts(tmp_path):
    store = db.make_engine(f"sqlite:///{tmp_path / 'gyan.db'}")
    with TestClient(create_app(store)) as client:
        assert client.get("/health").status_code == 503
        docs = [a.model_dump(mode="json") for a in load_seeds()]
        for _ in range(2):
            db.initialize(store, docs)
        assert client.get("/health").is_success
        manifests = client.get("/agents").json()
        assert len({a["id"] for a in manifests}) == len(manifests) == 20
        assert Counter(a["domain"] for a in manifests) == {
            "r2r": 5, "fpa": 5, "p2p_o2c": 4, "controls": 4, "executive": 2,
        }
        assert set(client.get("/contracts").json()) == {
            "AgentManifest", "MCPResource", "WorkflowDAG", "ExecutionTrace",
        }
        draft = {"id": "my_flow", "name": "My own pilot", "version": 1, "origin": "manual",
                 "nodes": [{"id": "step", "kind": "agent", "agent_id": "r2r_reconciler", "agent_version": 1}],
                 "edges": []}
        assert client.post("/workflows/validate", json=draft).json()["executed"] is False
        draft["nodes"][0]["agent_version"] = 999
        assert client.post("/workflows/validate", json=draft).status_code == 422
        assert client.post("/runs", json=draft).status_code == 404
    store.dispose()
