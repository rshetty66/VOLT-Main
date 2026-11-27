"""Local, read-only Phase 1 API. No execution or write-back endpoint."""
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from sqlalchemy import Engine, inspect
from sqlalchemy.orm import Session

from . import db
from .schemas import AgentManifest, AgentNode, ExecutionTrace, MCPResource, WorkflowDAG


def studio_engine() -> Engine:
    return db.make_engine(os.getenv("GYAN_DATABASE_URL", "sqlite:///./gyan-studio.db"))


def verify_pins(session: Session, dag: WorkflowDAG) -> None:
    profiles = {}
    for node in dag.nodes:
        if isinstance(node, AgentNode):
            profile = session.get(db.AgentManifest, (node.agent_id, node.agent_version))
            if profile is None:
                raise ValueError(f"{node.id}: unknown finance profile {node.agent_id}@{node.agent_version}")
            profiles[node.id] = profile.document
    for edge in dag.edges:
        for node_id, port, schema in ((edge.source, edge.source_port, "output_schema"),
                                      (edge.target, edge.target_port, "input_schema")):
            if node_id in profiles and port not in profiles[node_id][schema]["properties"]:
                raise ValueError(f"{node_id}: {port} is not a declared {schema} port")


def create_app(engine: Engine | None = None) -> FastAPI:
    store = engine if engine is not None else studio_engine()

    @asynccontextmanager
    async def lifespan(_app):
        yield
        if engine is None:
            store.dispose()

    app = FastAPI(title="Gyan Agents", version="0.1.0", lifespan=lifespan)

    @app.get("/health")
    def health():
        initialized = inspect(store).has_table(db.AgentManifest.__tablename__)
        if not initialized:
            raise HTTPException(503, "Database not initialized. Run python -m gyan_agents init.")
        return {"status": "ready"}

    @app.get("/agents", response_model=list[AgentManifest])
    def agents():
        health()
        with Session(store) as session:
            return db.read_agents(session)

    @app.get("/contracts")
    def contracts():
        return {m.__name__: m.model_json_schema() for m in (AgentManifest, WorkflowDAG, MCPResource, ExecutionTrace)}

    @app.post("/workflows/validate")
    def validate(dag: WorkflowDAG):
        health()
        with Session(store) as session:
            try:
                verify_pins(session, dag)
            except ValueError as exc:
                raise HTTPException(422, str(exc)) from exc
        return {"valid": True, "id": dag.id, "version": dag.version, "executed": False}

    return app
