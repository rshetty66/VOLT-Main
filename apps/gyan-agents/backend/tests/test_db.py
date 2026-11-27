"""Persistence tests. No network or database credentials required."""

import pytest
from sqlalchemy import create_mock_engine, inspect, select, text
from sqlalchemy.exc import DBAPIError, IntegrityError
from sqlalchemy.orm import Session

from gyan_agents.db import (
    AgentManifest,
    AuditEvent,
    Base,
    ExecutionRun,
    ExecutionTrace,
    WorkflowVersion,
    initialize,
    insert_workflow_version,
    make_engine,
    read_agents,
    read_workflow_version,
)


@pytest.fixture
def engine():
    engine = make_engine("sqlite+pysqlite:///:memory:")
    yield engine
    engine.dispose()


def test_schema_and_seed_history(engine):
    original = {"id": "alpha", "version": 1, "config": {"tier": "A"}}
    newer = {**original, "version": 10}
    beta = {"id": "beta", "version": 1}
    initialize(engine, [beta, original])
    initialize(engine, [{**original, "config": {}}, newer])
    initialize(engine, [])
    assert {
        "gyan_agents_agent_manifests", "gyan_agents_workflow_versions", "gyan_agents_mcp_resources",
        "gyan_agents_execution_runs", "gyan_agents_execution_traces", "gyan_agents_audit_events",
    } <= set(inspect(engine).get_table_names())
    with Session(engine) as session:
        history = session.scalars(select(AgentManifest)).all()
        assert len(history) == 3
        assert original in [entry.document for entry in history]
        assert read_agents(session) == [newer, beta]


def test_run_pins_a_real_workflow_version(engine):
    initialize(engine, [])
    with Session(engine) as session:
        session.add(WorkflowVersion(workflow_id="flow", version=1, dag={"nodes": []}))
        session.commit()
        session.add(ExecutionRun(id="run", workflow_id="flow", workflow_version=1,
                                 status="queued"))
        session.commit()
        session.add(ExecutionTrace(run_id="run", sequence=0, kind="queued", detail={}))
        session.commit()
        session.add(ExecutionRun(id="bad", workflow_id="flow", workflow_version=2,
                                 status="queued"))
        with pytest.raises(IntegrityError):
            session.commit()


@pytest.mark.parametrize("statement", [
    "UPDATE gyan_agents_audit_events SET action = 'changed' WHERE id = 'evt'",
    "DELETE FROM gyan_agents_audit_events WHERE id = 'evt'",
    """INSERT OR REPLACE INTO gyan_agents_audit_events (id, actor, action, detail)
       VALUES ('evt', 'other', 'changed', '{}')""",
])
def test_database_rejects_audit_mutation(engine, statement):
    initialize(engine, [])
    with Session(engine) as session:
        session.add(AuditEvent(id="evt", actor="tester", action="created", detail={}))
        session.commit()
        with pytest.raises(DBAPIError, match="append-only"):
            session.execute(text(statement))
        session.rollback()
        assert session.get(AuditEvent, "evt").action == "created"


def test_postgresql_ddl_compiles_without_connecting():
    sql = []

    def record(stmt, *_, **__):
        sql.append(str(stmt.compile(dialect=engine.dialect)))

    engine = create_mock_engine("postgresql+psycopg://", record)
    Base.metadata.create_all(engine, checkfirst=False)
    ddl = "\n".join(sql)
    assert "BEFORE UPDATE OR DELETE OR TRUNCATE" in ddl
    assert "FOR EACH STATEMENT" in ddl
    assert "CREATE TABLE gyan_agents_agent_manifests" in ddl


def test_custom_dag_round_trip(engine):
    initialize(engine, [])
    doc = {"id": "flow", "version": 1, "nodes": [], "edges": []}
    with Session(engine) as session:
        insert_workflow_version(session, doc)
        session.commit()
        assert read_workflow_version(session, "flow", 1) == doc
        assert read_workflow_version(session, "flow", 2) is None
        with pytest.raises(IntegrityError):
            insert_workflow_version(session, {**doc, "nodes": ["changed"]})
        session.rollback()
        assert read_workflow_version(session, "flow", 1) == doc


def test_default_version_and_invalid_seed(engine):
    first = {"id": "alpha"}
    initialize(engine, [first])
    with pytest.raises(ValueError, match="version"):
        initialize(engine, [{"id": "beta"}, {"id": "bad", "version": True}])
    with Session(engine) as session:
        assert read_agents(session) == [{**first, "version": 1}]
    assert first == {"id": "alpha"}
