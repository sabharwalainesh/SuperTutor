# Deploying SuperTutor

Owner: **Ainesh**. The workspace, `/api`, and `/mcp` share one public origin, which is also the origin a Superhuman connector points at. Vercel uses a PostgreSQL-backed function; a standalone Node deployment can still use its persistent JSON file.

## Vercel

Import the repository with **Root Directory = repository root**, **Framework = Vite**, **Build Command = `npm run build:web`**, and **Output Directory = `apps/web/dist`**. The committed `vercel.json` sets the build command and output path. The Vite output path is relative to `apps/web`, so a root-level `dist` setting causes the screenshot's `STATIC_BUILD_NO_OUT_DIR` error. Build only the website; the desktop app is not part of this deployment.

1. In this project's Storage tab, add a PostgreSQL integration such as Neon on its free plan, or connect an existing PostgreSQL database. Accept the provider's terms yourself or explicitly authorize that step. Do not choose a paid plan without approval.
2. Connect it to Production (and Preview if you need previews). The function reads `DATABASE_URL` or `POSTGRES_URL`. Never expose that value through a `VITE_` variable.
3. Set `SUPERTUTOR_PUBLIC_ORIGIN` to the stable production origin, for example `https://super-tutor-mauve.vercel.app`.
4. Deploy the current source, including `api/handler.ts`, `apps/server/src/service.ts`, `apps/server/src/serverless.ts`, `packages/postgres-state.ts`, and `vercel.json`. Redeploying the old `e0ec3fc` commit will omit the current website and cloud backend.
5. Confirm `/healthz` reports `ok: true`, sign in to the website, save work and reload it, then test a connector token against `/mcp`. Preview deployments protected by Vercel sign-in cannot be reached by Go; use the stable public production domain.
6. Follow [Go setup](GO_SETUP.md) to create/install the connector using `https://YOUR_PRODUCTION_DOMAIN/mcp`.

The function opens a transaction, locks the shared state row, validates and loads a fresh store, processes the request, and commits changes before sending its response or session cookie. A failed commit sends 503 instead of claiming success. Canvas sign-in flows and authentication attempt limits are shared in the database, so new instances do not lose them. Local disk and `/tmp` are never used for cloud persistence.

This keeps the existing small-deployment state contract in one PostgreSQL JSONB row. It prevents lost updates, but serializes requests and is not intended for high traffic; normalization into account/assignment tables is the next scaling step. Local data is not automatically uploaded into a cloud database. Use separate databases for untrusted preview branches; a preview connected to production storage can change production records.

## Requirements

- Node 22 or newer.
- HTTPS, because Go calls the endpoint from Superhuman's cloud and the session cookie must be Secure.
- A writable disk path for the state file that survives restarts and deploys.

## Build and run

```bash
npm ci --ignore-scripts
npm run build          # builds apps/web into apps/web/dist
npm start              # NODE_ENV=production, serves everything on PORT
```

If `apps/web/dist` is missing, the server still starts and every page returns a 503 telling you to build. The API and `/mcp` keep working, which keeps a build mistake from looking like an outage of the Go connection.

## Environment

| Variable | Default | Notes |
|---|---|---|
| `PORT` | 8787 | The single public port. |
| `HOST` | 127.0.0.1 | Set `0.0.0.0` only when a proxy or platform fronts it. |
| `NODE_ENV` | — | `production` enables Secure cookies, caching, and disables dev CORS origins. |
| `SECURE_COOKIES` | follows NODE_ENV | Force `true` whenever TLS terminates in front of this server. |
| `TRUST_PROXY` | unset | `true` (or a hop count) behind a proxy, so sign-in rate limiting sees real client IPs. |
| `TUTOR_STATE_FILE` | `.data/tutor-state.json` | Point at persistent storage. Contains password hashes, student work, and any Canvas tokens. |
| `CONNECTOR_LISTING_URL` | unset | The published connector's store listing. Until it is set, the setup screen shows students the publishing step instead of an install link. |
| `AGENT_DIRECTORY_URL` | `https://go.superhuman.com/agent-directory` | Where students search for the published tutor agents. |

## State

For standalone Node hosting, storage is one JSON file, written atomically with mode 0600, holding accounts, sessions, connector token hashes, and all student work. That has three consequences worth stating plainly:

- **Back it up.** Losing it loses every account and every assignment. There is no password reset, so a lost account cannot be recovered.
- **Do not run more than one instance.** Two processes writing one file will clobber each other. The app is single-instance until the store is replaced with a database.
- **Treat it as sensitive.** Keep it off shared volumes and out of logs and images. It holds live Canvas access tokens for any student who connected Canvas, which is a stronger reason than the password hashes alone.

## Before exposing it to students

- Serve over HTTPS and confirm the session cookie arrives with `Secure` and `HttpOnly`.
- Confirm `GET /api/assignments` returns 401 when signed out.
- Confirm a second account cannot read the first account's assignment by ID (expect 404).
- Confirm `POST /mcp` without a token returns 401.
- Decide who you are willing to let sign up. There is no email verification or invite gate yet, so an open instance is open to anyone who finds the URL.

## Publish the packs once

Students should never paste pack source. Publish the connector and the tutor agents yourself, set `CONNECTOR_LISTING_URL`, and the workspace turns step two of setup into a single install. See [Go setup](GO_SETUP.md).

## Known gaps

No password reset, no email verification, no audit log, and no automated application backups. PostgreSQL supports multiple function instances through serialized transactions; the standalone JSON-file deployment must remain a single process.
