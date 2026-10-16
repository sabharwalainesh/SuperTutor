# Ian — Frontend

**You own:** `apps/web/**` — nothing else. Read everything, edit only this.

**Branch:** `feat/web`

You are never blocked. The mock server serves the real routes with real shapes before Albert writes
anything, so you can build the entire UI against it from minute one.

```bash
npm install
npm run dev:mock    # terminal 1 — fixture API on :8787
npm run dev:web     # terminal 2 — Vite on :5173
# or `npm run dev` for the full Electron window once Albert's API is up
```

The mock adds a deliberate 600ms delay. That's so you build loading states instead of discovering at
hour 7 that the app looks frozen for six seconds.

---

## Already built (verify, don't rewrite)

```
apps/web/src/
  App.tsx                     three-pane shell, session state, error banner
  components/SourceInput.tsx  textarea, char counter, demo-text button
  components/LessonView.tsx   summary bullets + concept chips
  components/QuestionCard.tsx collapsible, answer box, Cmd+Enter, feedback display
  components/WeakSpots.tsx    aggregates missedTopics into a ranked list
  lib/api.ts                  the ONLY file that calls fetch
  lib/session.ts              the ONLY file that touches localStorage
  styles.css                  tokens, light + dark
```

Two rules that keep this lane clean as it grows:

- **All network goes through `lib/api.ts`.** Do not add a `fetch` anywhere else, not even once.
- **All persistence goes through `lib/session.ts`.** Ainesh may later swap localStorage for a file on
  disk; that's a one-file change only if nothing else reads storage.

---

## Your tasks, in order

### 1. Hour 0.5 — run it and find what's ugly

Load the demo text, generate, answer a question, watch the weak-spot panel update. Note everything
that feels wrong. Trust that list — you're the only person who'll look at this app with fresh eyes
before the judges do.

### 2. Hours 1–3 — the states that decide whether this looks finished

The happy path works. These are what separate a demo from a prototype:

- **Loading.** Generating a lesson takes ~6 seconds live. A disabled button saying "Building lesson…"
  is the floor; a skeleton of the lesson pane is what makes it feel fast. Grading is shorter but still
  needs the spinner on the specific card, not globally.
- **Error.** The banner exists and renders the API's message. Confirm it reads well for every message
  Albert actually produces — ask him for the list. An error that says "Model call failed: 429" is a
  bug in presentation even though it's technically correct.
- **Empty.** First launch shows a placeholder. Make it do work: tell the user what to do next, not
  just that there's nothing here.
- **Long content.** Paste 8000 characters. Paste a question whose prompt runs four lines. Paste an
  answer of 2000 words. Nothing should overflow, nothing should push the layout sideways.
- **Offline.** Kill the API (`Ctrl+C` in Albert's terminal) and try to generate. The app must stay
  interactive and say something useful. This *will* happen during judging.

### 3. Hours 2–4 — make the coaching loop feel like coaching

Right now it's a quiz with feedback attached. Small changes make it a coach:

- **Progress.** "2 / 5 graded" exists in the header. Make it visual — a bar, or graded cards visibly
  settling. Progress is the feeling of a learning product.
- **Score presentation.** A bare `62/100` is cold. A verdict word with the colored left border
  (already there) plus the score reads better. Consider hiding the number until the user expands.
- **Next action.** After grading, the user should know what to do next. Auto-collapse the answered
  card and auto-expand the next unanswered one. Tiny change, large feel.
- **Weak spots as a feature, not a list.** Clicking a weak topic should scroll to or filter the
  questions on that topic. This is the thing that makes the app a *coach* rather than a grader, and
  it's the moment to point at in the demo.

### 4. Hours 4–6 — polish that reads as intentional

- Keyboard: Cmd+Enter submits an answer (done). Add Cmd+Enter in the source box to generate.
- Focus management: after generating, focus the first question's answer box.
- Transitions: feedback appearing should fade/slide, not pop. 150ms, no more.
- Typography: check line length in the summary bullets. Long measure is the most common tell of an
  unstyled React app.
- Dark and light: the CSS handles both. Actually look at light mode — nobody ever does, and a judge
  on a light-mode machine will.
- Window resize: drag the Electron window narrow and tall. The grid is fixed at 360px + 1fr; decide
  what happens below ~900px.

### 5. Hours 6–8 — freeze and rehearse

Stop adding. Sit with Ainesh through the demo script and fix only what he trips on.

---

## Consuming a new API route (the pattern)

1. Ainesh adds the types to `packages/types.ts` and tells you.
2. You add a function to `lib/api.ts` — nowhere else.
3. You add or update a component that calls it.

If you need a shape that doesn't exist yet, ask Ainesh for the type and Albert for the route. Don't
define a local duplicate type in `apps/web` to get unblocked — that's how the two sides drift apart
and spend hour 18 debugging a field name.

---

## Stretch (only after the base loop is green end to end)

- **Markdown in feedback.** Albert's explanations may contain emphasis or lists. Rendering them raw
  looks sloppy. One small dependency; announce it before adding.
- **Diff-style improved answer.** Show the user's answer with the improved version overlaid as
  additions. This is the most Grammarly-shaped thing you could build, and it's a strong demo beat.
  Expensive — only with real time left.
- **Question filtering by topic** (see weak spots above). Cheaper than the diff and nearly as good.

---

## Merge discipline

- Push to `main` every 90 minutes, even partial work behind a flag.
- `git pull --rebase origin main` before every push.
- Need a type change? Ask Ainesh. Need the API to return something different? Ask Albert.
- Adding a dependency: announce it first, push it alone. Lockfile conflicts get fixed by deleting the
  lockfile and reinstalling, never by hand-merging.
- If `main` breaks because of your merge: fix or revert immediately.

## Done when

- [ ] Loading, error, empty, long-content and offline states all look deliberate
- [ ] Killing the API leaves the app interactive with a readable message
- [ ] Refresh preserves lesson, answers and feedback
- [ ] Weak spots populate from real grading and clicking one does something
- [ ] Light mode and dark mode both look finished
- [ ] No `fetch` outside `lib/api.ts`, no storage access outside `lib/session.ts`
