"""Owner-operated local commands. Nothing executes a finance workflow."""
import argparse
import json
from pathlib import Path

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from . import db
from .api import studio_engine, verify_pins
from .catalog import load_seeds
from .schemas import WorkflowDAG


def main():
    parser = argparse.ArgumentParser(description="Gyan Agents local development")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("init", help="create missing Studio tables and seed absent versions only")
    commands.add_parser("save-draft").add_argument("path", type=Path)
    read = commands.add_parser("get-draft")
    read.add_argument("id")
    read.add_argument("version", type=int)
    args = parser.parse_args()
    store = studio_engine()
    try:
        if args.command == "init":
            profiles = [m.model_dump(mode="json") for m in load_seeds()]
            db.initialize(store, profiles)
            print(f"Gyan Agents ready: {len(profiles)} finance profiles checked.")
        elif args.command == "save-draft":
            dag = WorkflowDAG.model_validate_json(args.path.read_bytes())
            with Session(store) as session, session.begin():
                verify_pins(session, dag)
                db.insert_workflow_version(session, dag.model_dump(mode="json"))
                session.add(db.AuditEvent(actor="local-cli", action="draft_saved",
                                          detail={"workflow": dag.id, "version": dag.version}))
            print(f"Saved {dag.id}@{dag.version}; no execution or write-back.")
        else:
            with Session(store) as session:
                doc = db.read_workflow_version(session, args.id, args.version)
                if doc is None:
                    parser.exit(1, "No such workflow version.\n")
                print(json.dumps(doc, indent=2))
    except IntegrityError:
        parser.exit(1, "Could not save this version. Choose a new version; existing drafts are not overwritten.\n")
    except ValueError as exc:
        parser.exit(1, f"{exc}\n")
    finally:
        store.dispose()


if __name__ == "__main__":
    main()
