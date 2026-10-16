# Albert — API & AI

**You own:** `apps/api/**` — nothing else. Read everything, edit only this.

**Branch:** `feat/api`

You own the part judges actually judge. The UI is a frame around your feedback text; if the grading
is vague, the demo is vague. Grammarly's entire product is *specific, explainable feedback* — your
prompts are the thing being compared against that bar.

---

## Already built (verify, don't rewrite)

```
apps/api/src/
  index.ts            Express bootstrap, CORS, /api/health (reports live vs offline)
  routes/lesson.ts    POST /api/lesson  -> Lesson
  routes/grade.ts     POST /api/grade   -> Feedback
  ai/client.ts        Claude wrapper: 20s timeout, one retry, JSON-fence stripping
  ai/prompts.ts       LESSON_PROMPT, GRADE_PROMPT
  ai/schema.ts        zod schemas mirroring packages/types.ts
```

Check it runs:

```bash
npm install
npm run dev:api
curl localhost:8787/api/health
# {"ok":true,"mode":"offline-fixtures"}   <- no key yet, that's correct
```

Then add your key and confirm it flips to live:

```bash
cp .env.example apps/api/.env
# fill in ANTHROPIC_API_KEY
npm run dev:api
curl localhost:8787/api/health   # -> "mode":"live"
```

**Model:** `claude-sonnet-5-5`. Set in `ai/client.ts`.

**Security — non-negotiable:** `apps/api/.env` is gitignored. Never commit a key, never paste one in
chat, never hardcode one as a "temporary" fallback in `client.ts`. A leaked key in a public hackathon
repo gets scraped within hours.

---

## Your tasks, in order

### 1. Hour 0.5 — get live mode working and measure it

Run both routes against the real model with real text. Write down the latency. If `/api/lesson`
takes more than ~8 seconds, the demo drags and you fix it now, not at hour 7 — lower `max_tokens`,
shorten the summary requirement, or cut the question count default.

### 2. Hours 1–4 — make the output good, not just valid

Validation already passes. That's the floor. The work is quality:

- **Questions must require explanation, not recall.** If the model produces "What is spaced
  repetition?", the prompt isn't working. You want "Why does an easy review do almost no work?"
  Iterate `LESSON_PROMPT` until this holds across 5 different source texts, not one.
- **`topic` must exactly match an entry in `concepts`.** The weak-spot panel groups on string
  equality. If the model writes "Intervals" in one place and "Interval scheduling" in the other, Ian's
  panel shows two rows for one idea and the feature looks broken. The prompt demands it — verify it,
  and consider enforcing it in code: drop or remap any question whose topic isn't in `concepts`.
- **Grading must be specific.** Every `explanation` should name what was right, what was missing, and
  why the missing part matters. Ban generic praise. Test with a deliberately half-right answer — that's
  the case the demo will show, and it's the one that proves the product.
- **`missedTopics` must be honest.** Empty on a correct answer. Populated accurately otherwise. This
  array *is* the weak-spot feature; if you pad it, the panel lies.
- **`verdict` and `score` must agree.** A 90 marked `incorrect` makes the UI look buggy. Consider
  deriving the verdict from the score in code rather than trusting the model to keep them consistent.

Test each change against the same 3 saved source texts so you can tell whether a prompt edit actually
helped. Keep them in `apps/api/` as scratch files — your lane, your call.

### 3. Hours 3–5 — harden the failure paths

The demo will hit at least one of these:

- **Model returns prose instead of JSON.** Handled (fence strip + brace slice + one retry). Force it
  and watch: temporarily break the prompt, confirm the user sees "The model returned a lesson we
  could not read. Try again." and not a stack trace.
- **Timeout.** 20s is generous. Confirm the error reaches the UI as a sentence.
- **Rate limit / 429.** Currently surfaces as a raw model error. Catch it and return something a human
  reads: "Rate limited — wait a few seconds and try again."
- **Oversized input.** Capped at 8000 chars with a clear message. Confirm the message includes the
  actual length, because it does and that's what makes it useful.

Rule that already holds and must keep holding: **never return unparsed model output.** Parse, validate,
or return a clean `{ error: string }`.

### 4. Hours 4–6 — tune tone with Ainesh

He owns demo content; you own the voice that responds to it. Sit together, run real answers through
`/api/grade`, and tune until the feedback sounds like a good tutor: direct, specific, never
condescending, never padded. This is the single highest-leverage hour in your lane.

### 5. Hours 6–8 — freeze and support

Stop changing prompts. Late prompt edits are how a working demo breaks 20 minutes before judging.
Spend the time making sure Ian's error states have real messages to display, and be on hand during
rehearsal.

---

## Adding a new route (the pattern)

1. Ask **Ainesh** to add the request/response types to `packages/types.ts`. Don't edit it yourself.
2. Add the zod schema to `ai/schema.ts`, mirroring those types exactly.
3. Add `routes/<name>.ts` following `lesson.ts`: validate → offline fixture fallback → model call →
   validate response → return.
4. Mount it in `index.ts`.
5. Tell **Ian** the route exists and what it returns.

Keep the offline fixture branch in every route. Ainesh's demo depends on the app working with no key.

---

## Stretch (only after the base loop is green end to end)

- Stream the lesson so the UI fills progressively instead of waiting 6 seconds. Big perceived-speed
  win; needs a coordinated change with Ian, so agree before starting.
- Cache lessons by a hash of the source text. Makes rehearsal instant and protects you from rate
  limits during repeated demo runs. Cheap, self-contained, genuinely useful — do this one first.
- A `/api/followup` route: given a wrong answer, generate one easier question on the same topic. This
  is the closest thing to a "coach" rather than a quizzer, and it's the obvious v2 story to pitch.

---

## Merge discipline

- Push to `main` every 90 minutes, even partial work.
- `git pull --rebase origin main` before every push.
- Need something in `packages/types.ts`? Ask Ainesh. Need a UI change? Ask Ian.
- Adding a dependency: announce it first, push it alone.
- If `main` breaks because of your merge: fix it or revert it immediately. Both fine. Leaving it is not.

## Done when

- [ ] `/api/health` reports `live` with a key, `offline-fixtures` without
- [ ] `/api/lesson` returns 5 explanation-type questions in under ~8s
- [ ] Every `topic` matches an entry in `concepts`
- [ ] `/api/grade` gives specific feedback on a half-right answer, with an honest `missedTopics`
- [ ] `verdict` and `score` never contradict
- [ ] Every failure path returns a readable `{ error: string }`, never a stack trace
- [ ] No key anywhere in git history
