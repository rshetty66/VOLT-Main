# VOLT Console: API + built React app in one image.
# Build from the repository root (the console reads plugins/volt at run time):
#   docker build -f apps/volt-console/Dockerfile -t volt-console .
FROM node:22-slim

WORKDIR /app
COPY plugins/volt ./plugins/volt
COPY apps/volt-console ./apps/volt-console

WORKDIR /app/apps/volt-console
RUN npm ci --ignore-scripts && npm run build && npm prune --omit=dev --ignore-scripts

ENV NODE_ENV=production \
    PORT=8787 \
    VOLT_HOST=0.0.0.0

# Uploaded templates and source documents live here; mount a volume to keep them across restarts.
RUN mkdir -p data
VOLUME ["/app/apps/volt-console/data"]

EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/api/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Runs as root so a mounted disk (Render, Fly) is writable. VOLT_ACCESS_TOKEN is required: the server refuses to
# listen on 0.0.0.0 without it.
CMD ["node_modules/.bin/tsx", "server/index.ts"]
