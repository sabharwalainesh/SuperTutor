# API and MCP contract

Version 0.2.0. The API returns information and stores Go's assessments. It never generates tutoring responses.

## HTTP routes

Base: `http://127.0.0.1:8787`. All failures return a non-2xx status and `{ "error": "readable message" }`.

| Method | Path | Input | Response |
|---|---|---|---|
| GET | `/api/health` | — | `{ ok, mode: "go-tools", schemaVersion: 2, modelCalls: false }` |
| GET | `/api/assignments` | — | `{ assignments: Assignment[] }` |
| POST | `/api/assignments` | `AssignmentInput` | `Assignment` (201) |
| GET | `/api/assignments/:id/context` | — | `AssignmentContext` |
| GET | `/api/assignments/:id/progress` | — | `ProgressSummary` |
| PUT | `/api/assignments/:id/draft` | `WorkInput` | `Draft` |
| POST | `/api/assignments/:id/attempts` | `AttemptInput` | `Attempt` |
| POST | `/api/assignments/:id/feedback` | `FeedbackInput` | `Feedback` |
| POST | `/api/assignments/:id/materials` | `MaterialInput` | `Material` (201) |
| POST | `/api/lesson`, `/api/grade` | legacy | 410 migration message |

`AssignmentInput` contains title, subject (`coding`, `math`, `writing`), prompt, and optional materials. A material contains title, actual text, and an optional HTTP(S) source URL. A work input contains work plus optional question/errorOutput. An attempt adds an optional UUID clientRequestId for safe submission retries.

`FeedbackInput` contains attemptId, assessment (`developing`, `demonstrated`, `uncertain`), explanation, nextStep, missedConcepts, and hintLevel (0–4). Only developing may include missed concepts. Server-generated records have stable IDs/timestamps and author `go-agent`. Feedback must reference an attempt in the same assignment. Repeated feedback for one attempt replaces its assessment rather than incrementing counts.

No numerical score or improved/full target answer is part of this contract. A hint level describes support offered, not proof of mastery. Completion evidence is the student's attempt plus a clearly labeled Go assessment.

Limits: titles 160 characters; prompt/work 16,000; course excerpt 32,000; question 2,000; error output 8,000; up to ten materials per assignment; request body 512 KB. Whitespace-only required fields are rejected. See `packages/schemas.ts` for exact limits.

## MCP tools

Streamable HTTP endpoint: `/mcp`, token required on every request. The bridge uses the API above.

| Tool | Input | Effect |
|---|---|---|
| `list_assignments` | `{}` | Read available IDs/titles |
| `get_assignment_context` | `{ assignmentId }` | Read materials, draft, attempts, feedback |
| `get_progress` | `{ assignmentId }` | Read derived counts and historical practice topics |
| `record_attempt` | `{ assignmentId, work, question?, errorOutput?, clientRequestId? }` | Save actual student work |
| `record_feedback` | `{ assignmentId, feedback: FeedbackInput }` | Save/update Go's feedback for an attempt |
| `add_material` | `{ assignmentId, title, text, sourceUrl? }` | Save an actual source excerpt |

Read tools have `readOnlyHint: true`. Write tools are marked as writes and may trigger Go confirmation. Never mislabel a write to suppress confirmation.

Creating assignments and saving drafts currently happen in the companion workspace. Go records attempts separately; draft saves alone do not count as attempts.

## Progress definitions

- attemptsTotal: distinct saved attempts, including retries with new IDs.
- reviewedAttempts: attempts with saved feedback, one review record per attempt.
- demonstratedAttempts: those reviews Go currently labels demonstrated, including assisted work.
- practiceTopics: historical mentions across stored developing feedback, deduplicated within a review. A later success does not erase past mentions, so the UI must not label these counts current mastery.
- latestNextStep: the most recently updated feedback's next action.

## Persistent state

Only the API process owns `TutorStore`. Default file `.data/tutor-state.json` is ignored and excluded from source control. Restart preserves state; incompatible/corrupt state fails startup rather than silently resetting it. Test stores use isolated temporary paths or memory.

This is single-student demo storage. An assignment ID is not an authorization credential. Do not deploy this API directly or reuse one bridge token across students.
