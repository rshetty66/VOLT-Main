# Gyan Agents web

This Phase 1 status page summarizes finance domain coverage using the registered manifests returned by FastAPI `GET /agents`. It does not display individual agents or duplicate skill discovery. The Next.js server reads the API at request time; the browser does not contact FastAPI or require CORS configuration.

## Local development

Use Node.js 20.9+ and run the following from this directory, independently of the root package. Start the accompanying FastAPI service before opening the status page.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Open [the local status page](http://127.0.0.1:3000). Set `GYAN_AGENTS_API_URL` in `.env.local` if the API is not at `http://127.0.0.1:8000`, and `VOLT_CONSOLE_URL` if the existing VOLT console is not at `http://localhost:5173`. Reload the page to refresh the counts. An API failure shows no counts.

## Verification

```sh
npm run typecheck
npm run lint
npm run build
npm test
```

The test starts a local fixture API and the production bundle on ephemeral loopback ports. It verifies success, empty, invalid-response and service-error rendering. Neither the build nor the test needs live credentials or the finance API.
