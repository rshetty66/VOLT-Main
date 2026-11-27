"""Gyan Agents persistence. Schema creation is additive, not a migration.

Audit threat model: SQL triggers reject UPDATE/DELETE (and PostgreSQL TRUNCATE)
by ordinary DML users. SQLite also rejects conflicting REPLACE inserts. These
controls do not authenticate writers, prevent fabricated inserts, detect missing
events, or survive a malicious database owner, file owner, or privileged DBA.
Use a separate PostgreSQL schema owner for provisioning, restrict runtime
privileges and secure backups independently. This is not a compliance guarantee.
"""

from datetime import datetime
from uuid import uuid4

from sqlalchemy import (
    JSON, CheckConstraint, DDL, DateTime, Engine, ForeignKey, ForeignKeyConstraint,
    Integer, String, UniqueConstraint, create_engine, event, func, select,
)
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.engine import make_url
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column
from sqlalchemy.pool import StaticPool


class Base(DeclarativeBase):
    pass


def _id() -> str:
    return str(uuid4())


class AgentManifest(Base):
    __tablename__ = "gyan_agents_agent_manifests"
    __table_args__ = (CheckConstraint("version >= 1"),)
    agent_id: Mapped[str] = mapped_column(String, primary_key=True)
    version: Mapped[int] = mapped_column(Integer, primary_key=True)
    document: Mapped[dict] = mapped_column(JSON)


class WorkflowVersion(Base):
    __tablename__ = "gyan_agents_workflow_versions"
    __table_args__ = (CheckConstraint("version >= 1"),)
    workflow_id: Mapped[str] = mapped_column(String, primary_key=True)
    version: Mapped[int] = mapped_column(Integer, primary_key=True)
    dag: Mapped[dict] = mapped_column(JSON)


class MCPResource(Base):
    __tablename__ = "gyan_agents_mcp_resources"
    __table_args__ = (UniqueConstraint("server", "uri"),)
    id: Mapped[str] = mapped_column(String, primary_key=True, default=_id)
    server: Mapped[str] = mapped_column(String)
    uri: Mapped[str] = mapped_column(String)
    document: Mapped[dict] = mapped_column(JSON)


class ExecutionRun(Base):
    __tablename__ = "gyan_agents_execution_runs"
    __table_args__ = (
        ForeignKeyConstraint(
            ["workflow_id", "workflow_version"],
            [f"{WorkflowVersion.__tablename__}.workflow_id",
             f"{WorkflowVersion.__tablename__}.version"],
        ),
    )
    id: Mapped[str] = mapped_column(String, primary_key=True, default=_id)
    workflow_id: Mapped[str] = mapped_column(String)
    workflow_version: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ExecutionTrace(Base):
    __tablename__ = "gyan_agents_execution_traces"
    __table_args__ = (CheckConstraint("sequence >= 0"),)
    run_id: Mapped[str] = mapped_column(ForeignKey(f"{ExecutionRun.__tablename__}.id"),
                                        primary_key=True)
    sequence: Mapped[int] = mapped_column(Integer, primary_key=True)
    kind: Mapped[str] = mapped_column(String)
    detail: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AuditEvent(Base):
    __tablename__ = "gyan_agents_audit_events"
    # Ensures SQLite has no second (rowid) conflict target for REPLACE.
    __table_args__ = {"sqlite_with_rowid": False}
    id: Mapped[str] = mapped_column(String, primary_key=True, default=_id)
    run_id: Mapped[str | None] = mapped_column(ForeignKey(f"{ExecutionRun.__tablename__}.id"))
    actor: Mapped[str] = mapped_column(String)
    action: Mapped[str] = mapped_column(String)
    detail: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


def _audit_ddl(dialect: str, statement: str) -> None:
    event.listen(AuditEvent.__table__, "after_create", DDL(statement).execute_if(dialect=dialect))


for _verb in ("UPDATE", "DELETE"):
    _audit_ddl("sqlite", f"""
        CREATE TRIGGER gyan_agents_audit_no_{_verb.lower()} BEFORE {_verb} ON gyan_agents_audit_events
        BEGIN SELECT RAISE(ABORT, 'audit events are append-only'); END
    """)

# Conflicting REPLACE can delete without running row-delete triggers when a
# caller's SQLite connection uses the default recursive_triggers=OFF.
_audit_ddl("sqlite", """
    CREATE TRIGGER gyan_agents_audit_no_replace BEFORE INSERT ON gyan_agents_audit_events
    WHEN EXISTS (SELECT 1 FROM gyan_agents_audit_events WHERE id = NEW.id)
    BEGIN SELECT RAISE(ABORT, 'audit events are append-only'); END
""")
_audit_ddl("postgresql", """
    CREATE OR REPLACE FUNCTION gyan_agents_reject_audit_change() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'audit events are append-only'; END; $$
""")
_audit_ddl("postgresql", """
    CREATE TRIGGER gyan_agents_audit_append_only BEFORE UPDATE OR DELETE OR TRUNCATE
    ON gyan_agents_audit_events FOR EACH STATEMENT EXECUTE FUNCTION gyan_agents_reject_audit_change()
""")


def make_engine(url: str) -> Engine:
    """Construct, but do not connect to, a supported database."""
    parsed = make_url(url)
    if parsed.drivername == "postgresql":
        parsed = parsed.set(drivername="postgresql+psycopg")
    if parsed.get_backend_name() == "postgresql":
        return create_engine(parsed, pool_pre_ping=True)
    if parsed.get_backend_name() != "sqlite":
        raise ValueError("Gyan Agents supports SQLite and PostgreSQL only")

    # Share an in-memory SQLite database across request/test threads.
    options = {"poolclass": StaticPool} if parsed.database in (None, "", ":memory:") else {}
    engine = create_engine(parsed, connect_args={"check_same_thread": False}, **options)

    @event.listens_for(engine, "connect")
    def _foreign_keys(connection, _record):
        cursor = connection.cursor()
        try:
            cursor.execute("PRAGMA foreign_keys=ON")
        finally:
            cursor.close()

    return engine


def initialize(engine: Engine, manifests: list[dict]) -> None:
    """Create missing tables and insert only absent manifest ID/version pairs.

    Existing tables and rows are never migrated, truncated or reseeded in place.
    Bootstrap once before multi-worker startup: concurrent DDL is not coordinated.
    """
    inserts = {"sqlite": sqlite_insert, "postgresql": pg_insert}
    if engine.dialect.name not in inserts:
        raise ValueError("Gyan Agents supports SQLite and PostgreSQL only")
    values = []
    for manifest in manifests:
        agent_id = manifest.get("id")
        version = manifest.get("version", 1)
        if not isinstance(agent_id, str) or not agent_id.strip():
            raise ValueError("manifest id must be a nonempty string")
        if type(version) is not int or version < 1:
            raise ValueError("manifest version must be a positive integer")
        values.append({"agent_id": agent_id, "version": version,
                       "document": {**manifest, "version": version}})
    with engine.begin() as connection:
        Base.metadata.create_all(connection)
        if values:
            statement = inserts[engine.dialect.name](AgentManifest.__table__)
            connection.execute(statement.on_conflict_do_nothing(index_elements=["agent_id", "version"]),
                               values)


def read_agents(session: Session) -> list[dict]:
    """Return the latest persisted document per agent, ordered by agent ID."""
    latest = select(
        AgentManifest.agent_id, func.max(AgentManifest.version).label("version"),
    ).group_by(AgentManifest.agent_id).subquery()
    query = select(AgentManifest.document).join(
        latest, (AgentManifest.agent_id == latest.c.agent_id) & (AgentManifest.version == latest.c.version),
    ).order_by(AgentManifest.agent_id)
    return list(session.scalars(query))


def insert_workflow_version(session: Session, dag: dict) -> None:
    """Insert a validated DAG without overwriting history. Caller owns commit.

    Duplicate ID/version raises IntegrityError; roll back the transaction before
    reusing the session. Semantic DAG/catalog checks belong to the caller.
    """
    workflow_id = dag.get("id")
    version = dag.get("version")
    if not isinstance(workflow_id, str) or not workflow_id.strip():
        raise ValueError("workflow id must be a nonempty string")
    if type(version) is not int or version < 1:
        raise ValueError("workflow version must be a positive integer")
    session.add(WorkflowVersion(workflow_id=workflow_id, version=version, dag=dag))
    session.flush()


def read_workflow_version(session: Session, id: str, version: int) -> dict | None:
    """Return exactly the pinned workflow version, or None if absent."""
    row = session.get(WorkflowVersion, (id, version))
    return None if row is None else row.dag
