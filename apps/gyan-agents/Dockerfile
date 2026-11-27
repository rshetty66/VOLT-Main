FROM ghcr.io/astral-sh/uv:0.13.4 AS uv
FROM python:3.13-slim
COPY --from=uv /uv /usr/local/bin/uv
WORKDIR /app/apps/gyan-agents/backend
COPY apps/gyan-agents/backend/pyproject.toml apps/gyan-agents/backend/uv.lock ./
RUN uv sync --locked --no-dev --no-install-project
COPY apps/gyan-agents/backend/gyan_agents ./gyan_agents
COPY plugins/volt /app/plugins/volt
RUN useradd --system --uid 11080 --create-home studio && mkdir /state && chown studio /state
ENV VOLT_PLUGIN_DIR=/app/plugins/volt GYAN_STUDIO_DIR=/state/workspaces GYAN_DATABASE_URL=sqlite:////state/foundation.sqlite PYTHONDONTWRITEBYTECODE=1
USER studio
EXPOSE 8000
CMD ["/bin/sh","-c",".venv/bin/python -m gyan_agents init && exec .venv/bin/uvicorn gyan_agents.api:create_app --factory --host 0.0.0.0 --port 8000"]
