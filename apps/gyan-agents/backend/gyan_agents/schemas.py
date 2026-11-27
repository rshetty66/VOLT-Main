"""Versioned contracts. None of these types grant permission to call a tool."""
from __future__ import annotations

from decimal import Decimal
from graphlib import CycleError, TopologicalSorter
from typing import Annotated, Literal, Self
from uuid import UUID

from jsonschema import Draft202012Validator
from jsonschema.exceptions import SchemaError
from pydantic import (
    AfterValidator, AwareDatetime, BaseModel, ConfigDict, Field, JsonValue, model_validator,
)

Id = Annotated[str, Field(pattern=r"^[a-z][a-z0-9_]{0,79}$")]
Capability = Annotated[str, Field(pattern=r"^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$", max_length=160)]
Version = Annotated[int, Field(strict=True, ge=1)]
Label = Annotated[str, Field(min_length=1, max_length=180)]
Domain = Literal["r2r", "fpa", "p2p_o2c", "controls", "executive"]
RunStatus = Literal["pending", "running", "awaiting_hitl", "completed", "failed", "rejected", "cancelled"]
TraceStatus = Literal["pending", "querying_mcp", "running_deterministic_tool", "verifying",
                      "awaiting_hitl", "completed", "failed", "rejected", "skipped", "cancelled"]


class Contract(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True, allow_inf_nan=False)


def safe_schema(schema: dict) -> dict:
    """Only local references: validating a manifest must never fetch an external URL."""
    def walk(value):
        if isinstance(value, dict):
            for key, item in value.items():
                if key in {"$ref", "$dynamicRef"} and not (isinstance(item, str) and item.startswith("#")):
                    raise ValueError("only local JSON Schema references are supported")
                if key == "$id":
                    raise ValueError("nested or external schema identifiers are not supported")
                walk(item)
        elif isinstance(value, list):
            for item in value:
                walk(item)

    walk(schema)
    if schema.get("type") != "object":
        raise ValueError("a top-level object schema is required")
    if schema.get("$schema", "https://json-schema.org/draft/2020-12/schema") != "https://json-schema.org/draft/2020-12/schema":
        raise ValueError("expected JSON Schema draft 2020-12")
    try:
        Draft202012Validator.check_schema(schema)
    except SchemaError as exc:
        raise ValueError(f"invalid JSON Schema: {exc.message}") from exc
    return schema


ObjectSchema = Annotated[dict[str, JsonValue], AfterValidator(safe_schema)]


class Materiality(Contract):
    amount: Decimal = Field(gt=0, max_digits=38, decimal_places=8)
    currency: str = Field(pattern=r"^[A-Z]{3}$")


class AgentManifest(Contract):
    id: Id
    volt_agent_id: Annotated[str, Field(pattern=r"^[a-z][a-z0-9-]*$")]
    version: Version = 1
    name: Label
    domain: Domain
    description: str = Field(min_length=10, max_length=2000)
    system_prompt: str = Field(min_length=30, max_length=24000)
    required_mcp_capabilities: list[Capability] = Field(min_length=1, max_length=80)
    input_schema: ObjectSchema
    output_schema: ObjectSchema
    requires_hitl_approval: bool
    materiality_threshold: Materiality | None


class MCPResource(Contract):
    id: Id
    server_id: Id
    uri: str = Field(pattern=r"^(file://[a-z][a-z0-9_]*|mcp://[a-z][a-z0-9_]*/[a-zA-Z0-9_/-]+)$")
    name: Label
    snapshot_id: Label
    data_schema: ObjectSchema
    mime_type: str = "application/json"
    row_count: int | None = Field(default=None, ge=0)
    captured_at: AwareDatetime | None = None


class CanvasPoint(Contract):
    x: float
    y: float


class NodeBase(Contract):
    id: Id
    label: Label | None = None
    position: CanvasPoint | None = None


class SourceNode(NodeBase):
    kind: Literal["source"]
    resource_id: Id
    snapshot_id: Label | None = None


class AgentNode(NodeBase):
    kind: Literal["agent"]
    agent_id: Id
    agent_version: Version
    definition_ref: Label | None = None
    skill_refs: list[Label] = Field(default_factory=list, max_length=12)


class RouterNode(NodeBase):
    kind: Literal["router"]
    field: Id
    operator: Literal["gt", "gte", "lt", "lte", "eq"]
    threshold: Decimal
    currency: str | None = Field(default=None, pattern=r"^[A-Z]{3}$")


class ApprovalNode(NodeBase):
    kind: Literal["approval"]
    required_role: Id
    action: Literal["review", "journal_post", "payment_release", "publish_report"] = "review"


Node = Annotated[SourceNode | AgentNode | RouterNode | ApprovalNode, Field(discriminator="kind")]


class Edge(Contract):
    source: Id
    target: Id
    source_port: Id
    target_port: Id


class ConfirmedBrief(Contract):
    """Provenance supplied by the trusted chat adapter, not an execution approval."""
    message_id: Label
    prompt: str = Field(min_length=1, max_length=20000)
    confirmed_at: AwareDatetime
    choice: Literal["optimized", "edited", "original"]


class WorkflowDAG(Contract):
    id: Id
    version: Version
    name: Label
    origin: Literal["manual", "template", "confirmed_chat"]
    brief: ConfirmedBrief | None = None
    nodes: list[Node] = Field(min_length=1, max_length=250)
    edges: list[Edge] = Field(max_length=1000)

    @model_validator(mode="after")
    def validate_graph(self) -> Self:
        if (self.origin == "confirmed_chat") != (self.brief is not None):
            raise ValueError("confirmed chat workflows must carry a confirmed brief; other origins must not")
        nodes = {node.id: node for node in self.nodes}
        if len(nodes) != len(self.nodes):
            raise ValueError("duplicate node id")
        graph = TopologicalSorter()
        used_inputs: set[tuple[str, str]] = set()
        for key in nodes:
            graph.add(key)
        for edge in self.edges:
            if edge.source not in nodes or edge.target not in nodes:
                raise ValueError("edge references unknown node")
            if nodes[edge.target].kind == "source":
                raise ValueError("source nodes cannot have incoming edges")
            if nodes[edge.source].kind == "router" and edge.source_port not in {"true", "false"}:
                raise ValueError("router outputs are true and false")
            inlet = (edge.target, edge.target_port)
            if inlet in used_inputs:
                raise ValueError("target port is already connected")
            used_inputs.add(inlet)
            graph.add(edge.target, edge.source)
        try:
            tuple(graph.static_order())
        except CycleError as exc:
            raise ValueError("workflow contains a cycle") from exc
        return self


class ToolInvocation(Contract):
    server_id: Id
    capability: Capability
    query: dict[str, JsonValue]
    snapshot_ids: list[Label] = Field(default_factory=list)


class ExecutionTrace(Contract):
    run_id: UUID
    node_id: Id
    sequence: int = Field(ge=1)
    status: TraceStatus
    timestamp: AwareDatetime
    invocation: ToolInvocation | None = None
    output: dict[str, JsonValue] | None = None
    latency_ms: int | None = Field(default=None, ge=0)
    input_tokens: int | None = Field(default=None, ge=0)
    output_tokens: int | None = Field(default=None, ge=0)
    error: str | None = None

    @model_validator(mode="after")
    def validate_error(self) -> Self:
        if (self.status == "failed") != bool(self.error):
            raise ValueError("failed traces require an error; other statuses must not carry one")
        return self
