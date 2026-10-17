# API and MCP contract

Version 0.3.0. The API returns information and stores Go's assessments. It never generates tutoring responses.

One server hosts three surfaces on one origin: the workspace, `/api` for the browser, and `/mcp` for Superhuman Go. Both authenticated surfaces resolve to one student account, and every record is scoped to its owner.

## Authentication

| Surface | Credential | Notes |
|---|---|---|
| `/api` | `supertutor_session` cookie | HttpOnly, SameSite=Lax, Secure in production, 30-day lifetime. SameSite is the CSRF defense. |
| `/mcp` | `Authorization: Bearer st_…` | A per-student connector token issued in the workspace, stored only as a SHA-256 hash, 180-day lifetime, revocable. |

Passwords are hashed with scrypt (N=32768, r=8, p=1) and a per-account salt. Sign-in runs the same work for unknown emails so the response time does not reveal whether an account exists, and sign-up/sign-in are rate limited per IP and email. Hashed rate-limit keys and short-lived Canvas OAuth state are persisted alongside account data, including across serverless instances.

A record owned by another student is reported as **404, not 403**, so assignment IDs cannot be probed. An assignment ID is not a credential.

| Method | Path | Input | Response |
|---|---|---|---|
| GET | `/healthz` | — | `{ ok, service, surfaces, modelCalls: false }` |
| GET | `/api/health` | — | `{ ok, mode: "go-tools", schemaVersion: 3, modelCalls: false }` |
| POST | `/api/auth/signup` | `Credentials` | `Account` (201) + session cookie |
| POST | `/api/auth/signin` | `Credentials` | `Account` + session cookie |
| POST | `/api/auth/signout` | — | `{ ok: true }`, invalidates that session only |
| GET | `/api/auth/me` | — | `Account`, or 401 |
| PUT | `/api/workspace/active` | `{ assignmentId }` | Owner-scoped recent question selection; expires after 15 minutes without refresh |
| GET | `/api/auth/canvas/start` | `institution`, optional `intent=connect` | Redirects to a configured school's OAuth login; connect requires an existing session |
| GET | `/api/auth/canvas/callback` | OAuth `state`, `code` or `error` | Validates the browser-bound flow, sets a session and Canvas connection, redirects to the workspace |
| POST | `/api/auth/connectors` | `{ label? }` | `ConnectorTokenIssued` (201) — the only response containing the secret |
| DELETE | `/api/auth/connectors/:id` | — | `Account` |

All assignment routes require a session and operate only on the caller's own records.

| Method | Path | Input | Response |
|---|---|---|---|
| GET | `/api/config` | — | `DeploymentConfig` — the MCP endpoint, the published connector listing if one is configured, and the agent directory link. Links only; `connectorPublished` says whether a listing URL is set, never whether Go is connected. |
| GET | `/api/courses/sources` | — | `{ sources: CourseSource[], canvas }` — each source's real status: `connected`, `available`, `manual-only`, or `not-implemented` |
| PUT | `/api/courses/canvas` | `CanvasConnectionInput` | `CanvasConnection` — verifies the token against Canvas before storing it |
| DELETE | `/api/courses/canvas` | — | `{ ok: true }`, deletes the stored token outright |
| GET | `/api/courses/canvas/courses` | — | `{ courses: CanvasCourse[] }` |
| GET | `/api/courses/canvas/courses/:courseId/assignments` | — | `{ assignments: CanvasAssignment[] }` |
| POST | `/api/courses/canvas/import` | `CanvasImportInput` | `Assignment` (201) |
| GET | `/api/assignments` | — | `{ assignments: Assignment[] }` |
| POST | `/api/assignments` | `AssignmentInput` | `Assignment` (201) |
| GET | `/api/assignments/:id/context` | — | `AssignmentContext` |
| GET | `/api/assignments/:id/progress` | — | `ProgressSummary` |
| PUT | `/api/assignments/:id/draft` | `WorkInput` | `Draft` |
| POST | `/api/assignments/:id/attempts` | `AttemptInput` | `Attempt` |
| POST | `/api/assignments/:id/feedback` | `FeedbackInput` | `Feedback` |
| POST | `/api/assignments/:id/materials` | `MaterialInput` | `Material` (201) |
| GET | `/api/study` | — | `{ study: StudySession \| null }` |
| POST | `/api/lesson` | `{ text, count?, sample? }` | Saved study source awaiting Go (202); explicit samples include an example lesson |
| POST | `/api/grade` | `{ sessionId, questionId, answer }` | Saved answer awaiting Go review (202) |
| DELETE | `/api/study` | — | Clears the caller’s current study session |

All failures return a non-2xx status and `{ "error": "readable message" }`, never a stack trace.

`Credentials` is an email plus a password of 10–200 characters. `Account` contains id, email, createdAt, and connector token summaries; it never contains a password hash or a token secret. `AssignmentInput` contains title, subject (`coding`, `math`, `writing`), prompt, and optional materials. A material contains title, actual text, and an optional HTTP(S) source URL. A work input contains work plus optional question/errorOutput. An attempt adds an optional UUID clientRequestId for safe submission retries.

`FeedbackInput` contains attemptId, assessment (`developing`, `demonstrated`, `uncertain`), explanation, nextStep, missedConcepts, and hintLevel (0–4). Only developing may include missed concepts. Server-generated records have stable IDs/timestamps and author `go-agent`. Feedback must reference an attempt in the same assignment. Repeated feedback for one attempt replaces its assessment rather than incrementing counts.

The assignment feedback contract has no numerical score or finished target answer. Generated practice questions have a separate scored-review contract below. A hint level describes support offered, not proof of mastery. Completion evidence is the student's attempt plus a clearly labeled Go assessment.

Limits: titles 160 characters; prompt/work 16,000; course excerpt 32,000; question 2,000; error output 8,000; up to ten materials per assignment; 200 assignments and 5 connector tokens per account; request body 512 KB. Whitespace-only required fields are rejected. See `packages/schemas.ts` for exact limits.

## Course sources

Canvas accepts institution-approved OAuth sign-in or the **student's own Canvas access token**, generated in Canvas under Account → Settings and revocable there. OAuth school configuration and scopes are documented in [Canvas sign-in](CANVAS_SIGN_IN.md). `/api/config` exposes only school IDs, names, origins, and enabled status, never client secrets. Import copies an assignment's title, instructions, due date, and `html_url`; instructor HTML is reduced to text before storage, so no markup reaches the editor or the tutor. It never reads grades and never writes to Canvas.

Canvas credentials are stored because imports run server-side. OAuth connections include a refresh token and expiry; concurrent import requests coalesce refreshes and refuse a result if the connection changed meanwhile. Neither access nor refresh tokens are returned by any route. Disconnecting deletes both rather than marking them inactive.

The Canvas host is student-supplied, so every Canvas request resolves the hostname first and refuses private, loopback, and link-local addresses, requires HTTPS, and does not follow redirects. The client is injectable (`canvasClient`) purely so tests can exercise these routes without relaxing that guard.

The other sources in the product plan are declared with honest status rather than implemented: lecture video and notes are paste-only with the source link kept as provenance, and no local editor or repository connection exists. A link is a reference, never proof its contents were imported.

## MCP tools

Streamable HTTP endpoint: `POST /mcp`. Every request carries the student's connector token; any other method returns 405. The tools are bound to the token's owner for the life of the request, so no tool argument can reach another student's work.

| Tool | Input | Effect |
|---|---|---|
| `list_assignments` | `{}` | Read the caller's own assignment IDs and titles |
| `get_assignment_context` | `{ assignmentId }` | Read materials, draft, attempts, feedback |
| `get_progress` | `{ assignmentId }` | Read derived counts and historical practice topics |
| `record_attempt` | `{ assignmentId, work, question?, errorOutput?, clientRequestId? }` | Save actual student work |
| `record_feedback` | `{ assignmentId, feedback: FeedbackInput }` | Save/update Go's feedback for an attempt |
| `add_material` | `{ assignmentId, title, text, sourceUrl? }` | Save an actual source excerpt |
| `get_study_session` | `{}` | Read the caller’s source, lesson, answers, revisions, and feedback |
| `record_study_lesson` | `{ sessionId, lesson }` | Save Go-authored summary, concepts, and practice questions |
| `record_practice_feedback` | `{ sessionId, answerRevision, feedback }` | Save Go’s review of a submitted practice answer |

Read tools have `readOnlyHint: true`. Write tools are marked as writes and may trigger Go confirmation. Never mislabel a write to suppress confirmation.

Creating assignments and saving drafts happen in the workspace. Go records attempts separately; draft saves alone do not count as attempts.

## Progress definitions

- attemptsTotal: distinct saved attempts, including retries with new IDs.
- reviewedAttempts: attempts with saved feedback, one review record per attempt.
- demonstratedAttempts: those reviews Go currently labels demonstrated, including assisted work.
- practiceTopics: historical mentions across stored developing feedback, deduplicated within a review. A later success does not erase past mentions, so the UI must not label these counts current mastery.
- latestNextStep: the most recently updated feedback's next action.

## Persistent state

One `TutorStore` instance in the server process owns all state: accounts, sessions, connector token hashes, and records. Default file `.data/tutor-state.json` is written atomically with mode 0600, is git-ignored, and is excluded from source control. Restart preserves state; corrupt state fails startup rather than silently resetting it. Test stores use isolated temporary paths or memory.

A version 2 file (written before accounts existed) is migrated to version 3 with its records unowned, and the first account created on that install claims them. Later accounts start empty.

Standalone Node hosting uses the single JSON file and must remain one process. Vercel uses `PostgresState`: each request loads a fresh validated snapshot under a PostgreSQL row lock, applies its API or MCP operation, and commits before releasing the buffered HTTP response. A failed commit cannot send a successful save or sign-in cookie. A missing database returns 503. The cloud snapshot remains one JSONB row, suitable for a small deployment; requests are serialized, so normalized tables are the next scaling step.

## Study and practice

The website captures notes and answers; Go authors all AI content. There is no model API key or direct model client. `POST /api/lesson` starts an owner-scoped session with 40–8,000 characters and a requested count of 3–8. The explicit sample flag loads labeled example questions; it never fabricates grading. The website gives the student a copyable request for their Go agent and polls `/api/study` every three seconds while visible.

`record_study_lesson` accepts a validated `Lesson` with 3–5 summary bullets, concepts, and exactly the requested number of uniquely identified questions. `POST /api/grade` saves an answer of up to 4,000 characters and generates an answer revision. It does not grade. Go then records `{ questionId, score, verdict, explanation, improvedAnswer, missedTopics }` using that exact revision. Scores are tutor judgments, not official grades. Improved answers apply only to these generated practice questions.

A new source invalidates the previous session ID. A changed answer invalidates its previous revision and clears its old feedback. Stale tool writes are rejected. Feedback is replaced by question ID, so retries do not inflate topic counts. Study state is persisted on the student’s stored account and drafts are also cached locally.
