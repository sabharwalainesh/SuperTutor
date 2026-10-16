# Learning Coach — Base Product Plan
**Event:** MTC x Grammarly Hackathon
**Goal:** Ship a small, demoable base product in ~24h that 3 people can build in parallel without stepping on each other.

---

## 1. Product in One Sentence

An AI learning coach: the user pastes or uploads study material, the app turns it into a short lesson plan plus practice questions, grades their answers, and tracks what they're weak at.

### Why this fits a Grammarly-adjacent hackathon
Grammarly's core loop is *user writes → system gives targeted, explainable feedback*. Learning Coach is the same loop applied to understanding instead of grammar: the user answers → the coach gives targeted feedback and a next step. Feedback quality, not feature count, is the demo.

### Demo script (what judges see, 3 minutes)
1. Paste a chunk of course notes.
2. App returns: a 3-bullet summary, 5 practice questions.
3. User answers 2 questions — one well, one badly.
4. Coach grades each with a short explanation and a corrected version.
5. "Weak spots" panel updates with the topics missed.

---

## 2. Scope

### In scope (the base product — build this first)
- Paste text in (no file upload v1).
- Generate lesson: summary + key concepts + N practice questions.
- Answer a question, get graded feedback (score + explanation + improved answer).
- Session view: list of questions, answered state, weak-topic list.
- Local persistence so a refresh doesn't kill the demo.

### Out of scope for v1 (stretch, only if lanes finish early)
- Accounts / real auth
- PDF or file upload
- Spaced repetition scheduling
- Multi-session history, sharing, export
- Mobile-specific layout

**Rule:** nobody starts a stretch item until the base loop runs end to end.

---

## 3. Architecture

Deliberately boring, so three people can work at once.

```
apps/web     Vite + React + TypeScript     (Person A)
apps/api     FastAPI (Python) or Express   (Person B)
packages/    shared types + fixtures       (Person C owns, A+B consume)
```

Pick **one** backend language in the first 10 minutes and do not revisit it.

### Data flow
```
Browser ──POST /api/lesson──> API ──> Claude ──> Lesson JSON ──> Browser
Browser ──POST /api/grade───> API ──> Claude ──> Feedback JSON ─> Browser
Browser ──localStorage──────> session state (v1 persistence)
```

### The contract (write this file FIRST, together, before anyone codes)

`packages/types.ts` — the single source of truth. Both sides code against it.

```ts
export type Question = {
  id: string;
  prompt: string;
  topic: string;          // used for weak-spot grouping
  difficulty: 'easy' | 'medium' | 'hard';
};

export type Lesson = {
  id: string;
  sourceTitle: string;
  summary: string[];      // 3-5 bullets
  concepts: string[];
  questions: Question[];
};

export type Feedback = {
  questionId: string;
  score: number;          // 0-100
  verdict: 'correct' | 'partial' | 'incorrect';
  explanation: string;    // why, in plain language
  improvedAnswer: string;
  missedTopics: string[];
};
```

### Endpoints

| Method | Path          | Body                                | Returns    |
|--------|---------------|-------------------------------------|------------|
| POST   | `/api/lesson` | `{ text: string, count?: number }`  | `Lesson`   |
| POST   | `/api/grade`  | `{ question: Question, answer: string }` | `Feedback` |
| GET    | `/api/health` | —                                   | `{ ok: true }` |

Both endpoints return `{ error: string }` with a non-200 on failure. Frontend must render that string — never a blank screen.

---

## 4. Three Parallel Lanes

Each person owns directories, not features-across-directories. This is the whole merge-conflict strategy.

### Person A — Frontend (owns `apps/web/**`)
Build against the mock server from hour zero; never blocked on B.

- `src/App.tsx` — three panes: Source input / Lesson / Coach feedback
- `src/components/SourceInput.tsx` — textarea + "Generate lesson" button
- `src/components/LessonView.tsx` — summary bullets, concept chips, question list
- `src/components/QuestionCard.tsx` — prompt, answer box, submit, feedback display
- `src/components/WeakSpots.tsx` — aggregated `missedTopics` with counts
- `src/lib/api.ts` — the ONLY file that does `fetch`. Reads `VITE_API_BASE`.
- `src/lib/session.ts` — localStorage load/save of the session object

States that must exist or the demo dies: loading, error, empty, long-text-truncated.

### Person B — API + AI (owns `apps/api/**`)
- `main.py` / `index.ts` — server bootstrap, CORS open to localhost, health route
- `routes/lesson.*` — validate input, call prompt, parse, validate against schema, return
- `routes/grade.*` — same shape for grading
- `ai/prompts.*` — the two prompts, as separate named constants
- `ai/client.*` — Claude call wrapper: timeout, one retry, JSON-mode parsing
- `ai/schema.*` — runtime validation (pydantic / zod) mirroring `packages/types.ts`

Hard requirements:
- Never return unparsed model output. Parse, validate, or return a clean error.
- Cap input text (~8k chars) and say so in the error when exceeded.
- Keep latency under ~8s; prefer a smaller max token budget over a richer answer.

**Model:** use `claude-sonnet-5-5` for both calls. Put the API key in `apps/api/.env`, and make sure `.env` is gitignored before the first commit.

### Person C — Glue, Data, Demo (owns `packages/**`, `scripts/**`, root config, `README.md`)
The person who keeps the other two unblocked. Highest-leverage role, not the leftover one.

- `packages/types.ts` — the contract above (written in minute 1)
- `packages/fixtures.ts` — a realistic `Lesson` and `Feedback` literal, exported
- `scripts/mock-server.*` — serves the fixtures on the real routes, so A can build immediately and B can diff against it
- Root: `package.json` workspaces, `.gitignore`, `.env.example`, `docker`/run scripts
- `scripts/demo-seed.*` — one-command load of the demo source text, so the live demo never starts from an empty box
- `README.md` — setup in 5 lines
- Owns the **demo content**: pick the source notes, actually run the loop, and tune the prompts' tone with B

After hour 4, C becomes integrator: runs both apps together, finds the seams, fixes the glue.

---

## 5. Merge Conflict Plan

Conflicts in a hackathon come from two things: shared files and long-lived branches. Kill both.

### Ownership table — only the owner edits these

| Path                | Owner | Others may |
|---------------------|-------|------------|
| `apps/web/**`       | A     | read only  |
| `apps/api/**`       | B     | read only  |
| `packages/**`       | C     | read only  |
| `scripts/**`, root config, `README.md` | C | read only |

If you need a change in someone else's lane: ask them in chat, they make it. Do not "just fix it quickly" — that is the commit that costs 40 minutes at hour 20.

### Shared-file rules
- `packages/types.ts` is the one file all three care about. **Change it only by announcing it first.** Treat a type change like a breaking API change: say it out loud, then push it alone, then everyone pulls before continuing.
- `package.json` / lockfile: adding a dependency is an announce-then-push action too. Lockfile conflicts are resolved by deleting the lockfile and reinstalling, never by hand-merging.
- Nobody commits `.env`. `.env.example` is the shared one, and it belongs to C.

### Git workflow
- Branch per lane: `feat/web`, `feat/api`, `feat/glue`.
- **Push and merge to `main` at least every 90 minutes**, even if the work is partial and behind a flag. Small merges never conflict badly; a 6-hour branch always does.
- Before every push: `git pull --rebase origin main`, resolve locally, then push. Rebase, not merge, so history stays readable at 3am.
- Never force-push `main`.
- `main` must always run. If your merge breaks it, you fix it immediately or you revert it immediately — both are fine, leaving it broken is not.

### If you do hit a conflict
1. Is it in a file you own? Take your version.
2. Is it in a file you don't own? Take theirs, then re-apply your change by asking the owner.
3. Lockfile? Delete, reinstall.
4. More than 10 minutes on one conflict → `git merge --abort`, pull fresh, re-apply your change by hand. Re-typing 30 lines beats debugging a bad merge.

---

## 6. Timeline

| Hour  | A (web)                        | B (api)                        | C (glue)                       |
|-------|--------------------------------|--------------------------------|--------------------------------|
| 0–0.5 | **All three:** agree stack, write `types.ts`, create repo + branches, push skeleton to `main` |||
| 0.5–2 | Layout, SourceInput, LessonView against mock | `/api/health`, Claude client, lesson prompt | Mock server, fixtures, run scripts, README |
| 2–4   | QuestionCard, answer + feedback UI | `/api/lesson` real, schema validation | Integrate real API, fix CORS/env, pick demo content |
| 4–6   | WeakSpots, loading/error states | `/api/grade` real, prompt tuning | **End-to-end run.** File bugs. Tune feedback tone with B |
| 6–8   | Polish, empty states, keyboard submit | Latency, retries, error messages | Demo script, seed data, rehearse |
| 8+    | Freeze. Stretch items only behind a flag ||| |

**Merge points:** end of every row. No exceptions.

---

## 7. Definition of Done (base product)

- [ ] `git clone` → README steps → app runs in under 5 minutes on a fresh machine
- [ ] Paste text → lesson with summary and ≥3 questions
- [ ] Answer a question → feedback with score, explanation, improved answer
- [ ] Weak spots populate from real grading, not fixtures
- [ ] Refresh preserves the session
- [ ] API down → visible error message, app still interactive
- [ ] Demo rehearsed end to end at least twice, by someone who didn't build that part

---

## 8. Known Risks

| Risk                                 | Mitigation                                                  |
|--------------------------------------|-------------------------------------------------------------|
| Model returns non-JSON               | Schema validation + one retry + fixture fallback             |
| Latency kills the demo               | Cap input size and output tokens; show streaming-ish loading state |
| Lane A blocked on lane B             | Mock server exists from hour 1; that's its entire purpose    |
| Scope creep into accounts/upload     | Stretch list is frozen until DoD above is fully checked      |
| Big merge at hour 20                 | 90-minute merge cadence, enforced by C                       |
| API key leaked in a commit           | `.gitignore` written before the first commit; `.env.example` only |
