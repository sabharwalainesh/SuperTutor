# Albert — API and tutoring tools

**Own:** `apps/api/**`. **Branch:** `feat/api` after the coordinated baseline lands.

Read everything; edit your lane. The current goal is **Go does the tutoring**. Do not recreate Claude-backed lesson generation, four backend personas, or a second AI conversation.

## Baseline supplied

`src/app.ts` exposes validated assignment, context, draft, attempt, feedback, material, and progress routes, mounted by the server in `apps/server/**` (Ainesh's lane) alongside the auth router and `/mcp`. There is no separate API entrypoint any more. `test/api.test.ts` exercises the contract, including that one student cannot read another's work. Shared schemas, accounts, and the persistent store live in `packages/` and are owned by Ainesh.

## Work order

1. Run `npm run verify`; learn the exact contract in `docs/API.md`.
2. Work with Ainesh to prove a real Go → MCP → API → saved state round trip. Confirm failures are readable in Go and the workspace.
3. Test actual coding, math, and writing attempts. Ensure context reflects the saved work and real sources, without inventing imports.
4. Check feedback references an actual attempt in the right assignment, repeated tool calls don't inflate counts, and ambiguous feedback is not stored as a definite misconception.
5. Help tune `agents/supertutor.md` with Ainesh using correct, half-right, ambiguous, and alternative answers. Ainesh applies file/Go configuration changes; you own API fixes.
6. Test persistence and failure behavior, then freeze the contract for the demo.

## Done when

- The API starts with no model key and reports `mode: go-tools`, `schemaVersion: 3`.
- Every assignment route requires a session and acts only on the caller's own records; another student's ID reads as 404, never 403.
- Go reads the same saved draft and materials shown in the workspace.
- Student attempts and Go feedback persist across API restarts.
- Progress is derived from actual records and labeled as tutor feedback.
- Empty/invalid/oversized requests return non-2xx readable JSON errors.
- The live Go demo has a targeted hint and an honest saved result.

## Coordination

Ask Ainesh before changing shared types, schemas, state, auth, root dependencies, or MCP tool names. Ask Ian for screen changes. Routes read the owner from `res.locals.ownerId`; never accept an owner or account ID from the request body.

Future code execution or math verification needs a separately reviewed tool contract and execution boundary. There is no verifier in the baseline, so do not claim a model assessment is a test result.
