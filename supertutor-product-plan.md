# SuperTutor — Go-led product plan

## Product

SuperTutor is a student learning coach selected inside Superhuman Go. Connected tools give it the student's assignment, latest saved work, available course context, attempts, and learning log. Go teaches; the service provides data and actions. The companion workspace captures work and displays the result.

Pitch: **“Bring your attempt. SuperTutor helps you understand the next step, using your actual work.”**

## Student journey

Create/select an assignment → save work and relevant source excerpts → open SuperTutor in Go → Go retrieves context → diagnostic question or targeted hint → student retries → Go records the attempt and feedback → workspace displays progress → independent transfer question.

Coding, math, and writing share this loop but require different explanations. The first version accepts text/code/typed steps. It does not execute code, interpret handwritten images, ingest lecture videos, or submit assignments.

## Teaching behavior

Ask before assuming a misconception. Explain the first unsupported step or behavior. Give progressively stronger support: question, concept, analogous example, immediate next action, prerequisite mini-lesson. Wait for the student. Accept supported alternatives and express uncertainty. Repeated hint requests do not unlock a full target solution, and hints alone are not success.

Go judgments are labeled as tutor feedback. Independent code/math verification is a future capability and must return real evidence. Preserve source references and do not invent transcript contents, timestamps, diagnoses, or progress.

## Architecture

Go tutor ↔ per-student connector token ↔ `/mcp` ↔ one owner-scoped store ↔ `/api` ↔ the student's browser session.

One Node server hosts the web workspace, the API, and the MCP endpoint on a single origin. No backend model API, duplicated state owner, or embedded Go conversation is assumed. See [architecture](docs/ARCHITECTURE.md) and [contract](docs/API.md).

## Team

| Person | Deliverable | Lane |
|---|---|---|
| Albert | Reliable context/attempt/feedback API and tests; teaching-quality testing with Ainesh | `apps/api/**` |
| Ainesh | Contracts/state, accounts and auth, the server and MCP endpoint, connector/Go setup, integration, demo | `packages/**`, `apps/server/**`, scripts/agents, root/docs |
| Ian | Work capture, saved feedback/progress UI, clear Go handoff, error/loading states | `apps/web/**` |

See [role assignments](docs/ROLES.md). After the coordinated baseline lands, return to lane ownership. Shared changes go through Ainesh and land together with affected callers.

## Hackathon scope

The baseline implements student accounts with owner-scoped persistent state, validated API routes, per-student authenticated MCP tools, a hosted web workspace with a real code editor, Go configuration instructions, and local integration and tenancy tests. **Real Go account setup and live tutoring verification remain required.**

Build one useful end-to-end tutoring interaction first. The event page lists a 5.5-hour hacking period and 8 PM Pacific submission on October 16, 2026; the earlier approximately 24-hour assumption is superseded. Do not spend the remaining time on provider swaps, multiple backend personas, broad course integrations, or packaging.

## Later phases

1. Real student pilot with better attempt/context management and feedback correction.
2. Authorized Canvas/bCourses and lecture-transcript ingestion; retain source provenance and permissions. A portal connection alone may not grant video-provider access.
3. Code test runner and mathematical verification with a clear execution boundary.
4. Handwriting/images, a VS Code companion, richer learning history, multi-user authentication and isolated storage.
5. Evidence-based evaluation of independent learning; do not claim efficacy from demo completion alone.

## Acceptance

- Go reads the actual saved work and uses a relevant source when available.
- Feedback targets the student's attempt and offers a next learning action.
- Attempts persist; feedback references the right attempt and repeated writes don't inflate counts.
- Uncertainty is preserved and alternate valid reasoning is accepted.
- API/MCP errors are readable, the bridge requires credentials, and the local API is not exposed.
- A real Go interaction and corresponding workspace update appear in the demo.

Sources: [event requirements](https://mtc-x-grammarly.devpost.com/), [event rules](https://mtc-x-grammarly.devpost.com/rules), [Superhuman MCP connector tutorial](https://coda.io/packs/build/latest/tutorials/build/mcp/). Account features and actual connector behavior must be verified in the event environment.
