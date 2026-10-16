# Architecture — Superhuman Go pivot

**Decided:** 2026-10-16. Supersedes the single-surface design in `supertutor-product-plan.md` §3.

## The shape

One brain, two surfaces.

```
Superhuman Go agent ──MCP──> scripts/mcp-server.ts ──┐
                                                      ├──HTTP──> apps/api ──> LLM
Electron app (apps/web) ───────────────HTTP──────────┘           tutor agents
                                                                      │
                                      packages/tutor-state.ts <───────┘
                                      (lesson, answers, weak spots)
```

`apps/api` is the only thing that talks to a model. Both surfaces call the same
routes, so a fix lands in both at once and neither can drift.

## Why this way

Superhuman Go cannot be embedded, and its agents cannot be invoked from outside.
Verified 2026-10-16:

- Go is an **MCP client** (since 2026-01-22) — it consumes tools, it does not expose agents.
- The only MCP servers Superhuman publishes are Mail and Docs, both of which serve
  data, not agents.
- Code-defined agents do not exist yet. The Packs SDK changelog (2026-08-19) says
  "We still want to enable developers to define agents via code... over the coming months."
- The Agents SDK is private beta, partner-gated by application.
- Embedding is Superhuman Docs only; Go chat cannot render an iframe.

So the arrow only points one way: **Go hosts, we are the tool.** That is why we keep
our own agents in `apps/api` instead of borrowing Go's — otherwise the demo depends on
a surface we do not control, and nothing of ours is on screen.

## The four agents

| Role | Job | Where it runs |
|---|---|---|
| `explainer` | Teach one concept, conversationally | `apps/api` |
| `quizzer` | Pick and ask the next question, adapt difficulty | `apps/api` |
| `grader` | Score one answer, name what was missed | `apps/api` (already `/api/grade`) |
| `coach` | Read weak spots, say what to do next | `apps/api` |

Contract lives in `packages/types.ts`: `AgentRole`, `AgentRequest`, `AgentReply`,
`TutorTurn`, `WeakSpot`, `TutorState`, `ProgressSummary`.

## Superhuman Go setup (demo only)

Go agents are config in Superhuman's cloud, not artifacts in this repo. They cannot be
cloned. Treat them as demo setup, and screenshot them for the submission.

Each Go agent is built in the Go agent builder, pointed at our MCP server, with
instructions matching one role above. The MCP server needs a public URL — `localhost`
will not reach Go, so tunnel it (`cloudflared`/`ngrok`) and set a bearer token.

## Lane impact

- **Ainesh** — `packages/types.ts` contract, `packages/tutor-state.ts`, `scripts/mcp-server.ts`, tunnel, Go agent setup.
- **Albert** — the four agents in `apps/api`. `/api/grade` already covers `grader`.
- **Ian** — the app keeps its tutoring UI, plus a weak-spot/progress panel reading `ProgressSummary`.

Nothing already built is thrown away.
