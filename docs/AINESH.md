# Ainesh — Integration, contracts, and Go setup

**Own:** `packages/**`, `scripts/**`, `agents/**`, `.github/**`, `apps/desktop/**`, root config, `docs/**`, `README.md`. **Branch:** `feat/glue` after the baseline lands.

## Baseline supplied

Shared TypeScript contracts, runtime schemas, persistent TutorStore, six authenticated MCP tools, a Pack Studio template, Go tutor instructions, SDK integration tests, root scripts, and the optional Electron wrapper.

## Work order

1. Confirm event-provided Go/Docs account access. Follow `docs/GO_SETUP.md`; make a real tool call in Go immediately.
2. Configure the bridge token and deliberate HTTPS tunnel. Expose only 8788, keep 8787 local. Install the connector and create the SuperTutor Go agent with `agents/supertutor.md`.
3. Verify the actual Go → tools → API flow with Albert and the workspace refresh with Ian.
4. Own changes to shared contracts. Announce and commit them separately; all lanes pull before relying on new shapes.
5. Rehearse a plausible wrong attempt, one useful hint, a revision, a saved result, and an independent question. Capture Go tool activity as evidence.
6. Prepare Devpost submission, video, credits, setup steps, and judge access to the private repo.

## Done when

- A real configured Go agent lists the workspace assignment and reads its saved work.
- Write tools save attempts/feedback with valid IDs and honest labels.
- Both surfaces observe one authoritative API state store.
- Missing/wrong credentials fail cleanly, and no token is committed or shown in the demo.
- The video clearly shows the sponsor agent contributing to tutoring.
- Submission is accessible and completed by the event deadline.

## CI template

The publishing GitHub credential lacks workflow permission, so the CI definition is supplied as `scripts/verify-workflow.yml.example`. An authorized maintainer can copy it to `.github/workflows/verify.yml` to enable PR checks. Local `npm run verify` already passes.

## Scope decisions

One useful Go tutor is enough for the first demo; four backend AI agents are not required. Prioritize Go integration over desktop packaging or extra connectors. Canvas/Kaltura/VS Code integration is later unless access and implementation are already verified. Do not describe sample excerpts as live school imports.
