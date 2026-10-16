# SuperTutor

**A tutor in Superhuman Go, connected to the student's actual work.**

Students save an assignment and their current code, math steps, or draft in a companion workspace. They open the **SuperTutor agent in Superhuman Go**, which reads that context, asks diagnostic questions, explains concepts, and offers one next-step hint. Go saves attempts and feedback back to the workspace so the next session has context.

**Go does the tutoring. This repository does not call Claude or another model API.** The backend supplies data and actions; the MCP connector makes those capabilities available to Go.

## The experience

1. Create an assignment in the workspace and save your current work.
2. Open Go and choose your configured SuperTutor agent.
3. Ask for help. Go retrieves the relevant context through the connector.
4. Go guides you through the mistake and waits for your next attempt.
5. Go records your actual attempt and its feedback. The workspace refreshes the learning log.

The agent should preserve student authorship, accept valid alternative approaches, and change its explanation when a student is stuck. It should not give the finished homework solution. See [the tutor instructions](agents/supertutor.md).

## What works in this baseline

- Coding/math/writing assignment records and student work as text.
- Optional course excerpts with source links, including accessible lecture transcripts.
- Persistent API state shared by the workspace and MCP tools.
- Six MCP tools, with bearer authentication and read/write annotations.
- Workspace feedback/progress refresh, without fake AI responses.
- Local API and MCP integration tests, web build, and Electron wrapper compilation.

**Account setup is separate:** the Go connector must be created/installed and the agent configured before Go can call these tools. Local tests do not establish a live Go connection. Follow [Go setup](docs/GO_SETUP.md).

Not implemented: automatic Canvas/bCourses or video ingestion, handwritten-image analysis, a VS Code connection, code execution, symbolic math verification, official grading/submission, multi-user accounts, or a packaged desktop installer. A source URL is a reference, not proof its content was imported. These are later integrations, not claims of the demo.

## Run locally

Use **Node 22+**.

```bash
npm install
cp .env.example .env
npm run dev
```

Open [the workspace](http://localhost:5173). The API listens on loopback at port 8787. No model API key is needed. Try the sample assignment; its lecture excerpt is clearly labeled sample content. No sample tutor feedback is fabricated.

To connect Go, generate a random token locally, place it in `MCP_BEARER_TOKEN` in `.env`, then use `npm run dev:connected`. Follow [the complete connector and tunnel instructions](docs/GO_SETUP.md). Expose only the authenticated MCP port 8788, not the local API.

With the development servers running, `npm run dev:desktop` opens the optional Electron companion. Go remains a separate application. The desktop wrapper does not embed Go.

## Who owns what

The coordinated Go-led migration establishes this baseline across lanes. After it lands, return to these boundaries:

| Person | Responsibility | Owned files | Assignment |
|---|---|---|---|
| **Albert** | Backend context, attempts, feedback, validation, API tests | `apps/api/**` | [ALBERT.md](docs/ALBERT.md) |
| **Ainesh** | Shared contracts/state, MCP connection, Go setup, integration and demo | `packages/**`, `scripts/**`, `agents/**`, `.github/**`, `apps/desktop/**`, root config, `docs/**`, `README.md` | [AINESH.md](docs/AINESH.md) |
| **Ian** | Companion workspace, work capture, saved feedback and progress UI | `apps/web/**` | [IAN.md](docs/IAN.md) |

Everyone may read everything. Edit your lane; ask the owner for a change elsewhere. Ainesh owns shared type/dependency changes and announces them before others pull. Nobody independently reinvents an API shape or introduces a second state store.

Albert also helps design and test teaching behavior; Ainesh applies those instructions to the Go agent. Four backend model personas are no longer part of the plan.

## Repository map

```text
agents/                    Go tutor instructions + Pack Studio connector template
apps/api/src/app.ts        Validated tools API; never calls a model
apps/api/src/index.ts      Local API startup and persistent store
apps/api/test/              API, state, and error-path tests
apps/web/src/              Student workspace (React)
apps/desktop/src/          Optional Electron wrapper
packages/types.ts          Shared request/response contracts
packages/schemas.ts        Runtime validation used by API and MCP
packages/tutor-state.ts    API-owned authoritative persistence
packages/config.ts         Explicit environment loading
packages/fixtures.ts       Sample student input, not model output
scripts/mcp-server.ts      Authenticated bridge startup
scripts/mcp/server.ts      MCP tools forwarding to API over HTTP
scripts/test/             Real SDK-client-to-server integration tests
scripts/verify-workflow.yml.example  CI template (installation needs workflow permission)
docs/                     Architecture, contracts, setup, assignments, demo
```

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Local API + workspace |
| `npm run dev:connected` | API + workspace + token-protected MCP bridge |
| `npm run dev:mcp` | MCP bridge only; API must already run |
| `npm run dev:desktop` | Electron wrapper against the running workspace |
| `npm run typecheck` | Shared/API/UI/MCP types |
| `npm test` | API and MCP integration tests, no Go account needed |
| `npm run build` | Web build + desktop compilation |
| `npm run verify` | Type checking, tests, and build |

Authoritative state is saved in ignored `.data/tutor-state.json`. The renderer uses localStorage only to recover unsaved editor text; Go cannot read that recovery copy until the student saves it to the API. Restarting the API should preserve assignments and attempts. This is a **single-student demo installation**: all authorized clients see the same workspace. Do not connect multiple students to a shared deployment without authentication and per-user storage.

## Hackathon target

Track: **Productivity**. Demonstrate a meaningful tutoring interaction **in Go** and the corresponding saved progress in the workspace. A standalone workspace demonstration alone does not prove the sponsor integration.

The [event page](https://mtc-x-grammarly.devpost.com/) lists submission at **October 16, 2026, 8 PM Pacific**, a short demo video, integration explanation, accessible source/setup links, credits, and disclosure of pre-existing work. The [rules](https://mtc-x-grammarly.devpost.com/rules) list a 2:30–8 PM hacking period. Build one complete loop first, not a 24-hour feature plan. Arrange judge access if the repository is private.

See [architecture](docs/ARCHITECTURE.md), [API/tool contract](docs/API.md), [demo checklist](docs/DEMO.md), and [product plan](supertutor-product-plan.md).

## Migration from the earlier prototype

The earlier direct-Claude lesson/grading implementation has been replaced by Go-facing context and progress tools. Old `/api/lesson` and `/api/grade` requests return a readable **410** response. The old localStorage session format is not imported automatically; historical code remains recoverable in Git. Shared contracts and all callers migrate together in this change.
