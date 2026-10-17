# Ainesh — Integration, contracts, auth, and Go setup

**Own:** `packages/**`, `apps/server/**`, `scripts/**`, `agents/**`, `.github/**`, root config, `docs/**`, `README.md`. **Branch:** `feat/glue` after the baseline lands.

## Baseline supplied

Shared TypeScript contracts and runtime schemas, accounts with scrypt password hashing and session cookies, per-student connector tokens, the owner-scoped `TutorStore` with version 2 migration, one server hosting the workspace plus `/api` plus `/mcp`, six owner-bound MCP tools, connector and agent pack templates, Go tutor instructions, SDK and tenancy integration tests, the CI workflow, and root scripts.

## Code work remaining

1. Replace the single JSON state file before more than a handful of students use one instance. The store API is the seam; `apps/api` and the MCP router should not change. Until then the app is single-instance, and that limit is documented in [deployment](DEPLOY.md).
2. Add password reset and some form of sign-up gate (invite code or email verification). Today a deployed instance is open to anyone with the URL and a forgotten password is unrecoverable.
3. Decide whether connector tokens should be OAuth rather than a pasted secret, once Superhuman's supported flows are confirmed.

## Account and demo work order

1. Confirm event-provided Go/Docs account access. Follow `docs/GO_SETUP.md`; make a real tool call in Go immediately.
2. Deploy the app over HTTPS, or expose it through a deliberate tunnel, then generate a connector token in the workspace. Set `SECURE_COOKIES` and `TRUST_PROXY` behind a proxy. There is no shared bridge token to configure any more.
3. Install the connector pack, note its pack ID, and create the SuperTutor agent with `agents/supertutor.md`. Add the while-writing trigger only if you will demonstrate it in a Superhuman Doc, since it cannot fire in the web app.
4. Verify the actual Go → tools → store flow with Albert and the workspace refresh with Ian.
5. Own changes to shared contracts. Announce and commit them separately; all lanes pull before relying on new shapes.
6. Rehearse a plausible wrong attempt, one useful hint, a revision, a saved result, and an independent question. Capture Go tool activity as evidence.
7. Prepare Devpost submission, video, credits, setup steps, and judge access to the private repo.

## Done when

- A real configured Go agent lists the workspace assignment and reads its saved work.
- Write tools save attempts and feedback with valid IDs and honest labels.
- Both surfaces observe one authoritative owner-scoped store.
- A second account cannot see the first account's work, from the browser or from a connector token.
- Missing, revoked, or wrong credentials fail cleanly, and no token is committed or shown in the demo.
- The video clearly shows the sponsor agent contributing to tutoring.
- Submission is accessible and completed by the event deadline.

## CI

`.github/workflows/verify.yml` runs `npm run verify` on pushes to main and on pull requests. If the publishing credential lacks workflow permission, an authorized maintainer has to push that file; local `npm run verify` passes either way.

## Scope decisions

One useful Go tutor is enough for the first demo; four backend AI agents are not required. Prioritize the real Go integration over extra connectors. Canvas/Kaltura ingestion and a VS Code extension are later work unless access and implementation are already verified. The workspace has a real editor but no code execution, so do not describe output as having been run. Do not describe sample excerpts as live school imports.
