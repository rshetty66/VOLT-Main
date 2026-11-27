from copy import deepcopy

import pytest
from pydantic import ValidationError

from gyan_agents.schemas import AgentManifest, ExecutionTrace, MCPResource, WorkflowDAG


def flow():
    return {
        "id": "my_close", "name": "Quarterly custom close", "version": 1,
        "origin": "manual",
        "nodes": [
            {"id": "bank", "kind": "source", "resource_id": "bank_rows"},
            {"id": "match", "kind": "agent", "agent_id": "r2r_reconciler", "agent_version": 1},
            {"id": "approve", "kind": "approval", "required_role": "controller"},
        ],
        "edges": [
            {"source": "bank", "target": "match", "source_port": "rows", "target_port": "bank"},
            {"source": "match", "target": "approve", "source_port": "exceptions", "target_port": "proposal"},
        ],
    }


def test_custom_flow_roundtrip():
    dag = WorkflowDAG.model_validate(flow())
    assert WorkflowDAG.model_validate_json(dag.model_dump_json()) == dag


@pytest.mark.parametrize("defect", ["cycle", "missing", "duplicate", "duplicate_port", "no_confirmation", "wrong_node"])
def test_reject_invalid_flow(defect):
    doc = flow()
    if defect == "cycle":
        doc["edges"].append({"source": "approve", "target": "match", "source_port": "decision", "target_port": "other"})
    elif defect == "missing":
        doc["edges"][0]["target"] = "unknown"
    elif defect == "duplicate":
        doc["nodes"].append(deepcopy(doc["nodes"][0]))
    elif defect == "duplicate_port":
        doc["edges"].append(deepcopy(doc["edges"][0]))
    elif defect == "no_confirmation":
        doc["origin"] = "confirmed_chat"
    else:
        doc["nodes"][0]["shell"] = "not an allowed node property"
    with pytest.raises(ValidationError):
        WorkflowDAG.model_validate(doc)


def test_foreign_uri_and_invalid_schema():
    with pytest.raises(ValidationError):
        MCPResource(id="bank", server_id="upload", uri="https://outside.invalid", name="Bank",
                    data_schema={"type": "table"}, snapshot_id="v1")


def test_contracts_export_as_json_schema():
    for model in (AgentManifest, WorkflowDAG, MCPResource, ExecutionTrace):
        assert model.model_json_schema()["type"] == "object"
