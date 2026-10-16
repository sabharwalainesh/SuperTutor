# Ainesh — Glue, Contract & Integration

**You own:** `packages/**`, `scripts/**`, `apps/desktop/**`, root config (`package.json`, `tsconfig.json`, `.gitignore`, `.env.example`), `docs/**`, `README.md`

**Branch:** `feat/glue`

Your lane looks like the least glamorous one. It isn't. You own the contract both other lanes code
against, the mock server that keeps Ian unblocked, the Electron shell that makes this a desktop app
instead of a website, and — from hour 4 — the integration itself. When something breaks between
lanes, it's yours. When the demo has to work, it's yours.

---

## Already built (verify, don't rewrite)

- `packages/types.ts` — the shared contract: `Question`, `Lesson`, `Feedback`, `Session`, request types, `MAX_SOURCE_CHARS`
- `packages/fixtures.ts` — a realistic lesson + feedback, used by both the mock server and the API's offline mode
- `scripts/mock-server.ts` — serves fixtures on the real routes with a fake 600ms latency, so Ian builds loading states instead of forgetting them
- `apps/desktop/src/main.ts` — Electron window, dev-server vs packaged loading, external links to the system browser
- `apps/desktop/src/preload.cts` — context bridge, exposes exactly one field
- Root scripts: `dev`, `dev:api`, `dev:mock`, `dev:web`, `dev:desktop`, `build`, `typecheck`

Sanity check before you touch anything:

```bash
npm install
npm run typecheck   # must be silent
npm run build       # must produce apps/web/dist + apps/desktop/dist
npm run dev         # API + Vite + Electron window
```

---

## Your tasks, in order

### 1. Hour 0 — lock the contract (do this before anyone writes a line)

Walk Albert and Ian through `packages/types.ts` out loud. Both lanes are about to spend hours
assuming these shapes. Five minutes now beats a rename at hour 12.

Decide and announce: is `topic` on a `Question` free text, or must it match an entry in
`Lesson.concepts`? The weak-spot panel only groups correctly if it's the latter — the prompt
already demands it, so hold Albert to it.

### 2. Hour 0.5 — make sure nobody is blocked

Confirm Ian can run `npm run dev:mock` + `npm run dev:web` and see a lesson render without Albert
having written anything. If that doesn't work, it's your highest-priority bug, ahead of all other work.

### 3. Hours 1–4 — Electron shell beyond the baseline

The window exists and loads. Make it feel like an app:

- **App menu.** Electron's default menu says "Electron". Build a real `Menu` template in `main.ts`
  with the app name, plus Edit (cut/copy/paste/select-all — without these, Cmd+C does nothing in the
  textareas and it looks broken on stage).
- **Window state.** Remember size and position between launches. Write it to a small JSON file in
  `app.getPath('userData')`.
- **Single instance.** `app.requestSingleInstanceLock()` — focus the existing window instead of
  opening a second one.
- **API lifecycle (the real decision).** Right now `npm run dev` starts the API as a separate
  process. A packaged app can't rely on that. Either spawn the API as a child process from
  `main.ts` on `app.whenReady()` and kill it on quit, or move the routes in-process. Pick one and
  tell Albert, because it changes how he runs things. Child-process is the smaller change; do that
  unless you have spare time.
- **Dock/taskbar icon.** A default Electron icon in a demo screenshot is a tell.

### 4. Hours 2–6 — own the demo content

This is a real deliverable, not a nicety. The judges see your source text, your questions, your
feedback tone.

- Pick the source material. Something a judge can evaluate without domain knowledge, long enough to
  yield 5 real questions, short enough to paste in 2 seconds. Replace `DEMO_TEXT` in
  `SourceInput.tsx` by asking **Ian** to swap it — that file is his.
- Update `packages/fixtures.ts` to match the new material, so offline mode and live mode tell the
  same story.
- Sit with Albert and tune the feedback tone against real answers. Feedback that says "Good effort!"
  loses to feedback that says "You named the mechanism but not why it works." Grammarly's whole
  product is specific feedback — generic praise reads as a miss in this room.

### 5. Hour 4+ — integrator mode

Switch from building to connecting. Every 90 minutes:

1. `git pull --rebase origin main` on `main`, run `npm run typecheck`, run the full demo loop.
2. Anything broken between lanes: find which side, tell that owner, don't fix it yourself unless
   it's in your directories.
3. Keep `main` green. A broken `main` blocks two people, not one.

### 6. Hours 6–8 — demo readiness

- Rehearse the full 3-minute script end to end, twice. Once yourself, once watching someone else
  drive — they'll hit the states you unconsciously avoid.
- Kill the API mid-demo on purpose. Confirm the app shows Ian's error banner and stays interactive.
- Clear localStorage, relaunch, confirm a clean first-run looks intentional and not empty-broken.
- Fill in the README's setup steps on a genuinely fresh clone. If it takes more than 5 minutes,
  that's a bug in your lane.

---

## Stretch (only after the base loop is green end to end)

- `electron-builder` config to produce a real `.dmg`. Nice to say "it's a real desktop app you can
  install," expensive if code signing fights you. Timebox to 45 minutes, abandon without guilt.
- Move the session from localStorage to a JSON file in `userData` so it survives a renderer reset.
  Only `apps/web/src/lib/session.ts` reads storage, so it's a contained change — but it's Ian's file,
  so you'd expose the capability through preload and he calls it.

---

## Your merge discipline

You enforce it, so you follow it hardest.

- Push to `main` every 90 minutes minimum.
- `packages/types.ts` changes ship **alone**, announced before the push: "pushing a types change,
  pull before you continue."
- Adding a dependency is also announce-then-push. Lockfile conflicts get resolved by deleting the
  lockfile and reinstalling, never by hand-merging.
- Never force-push `main`.
- Confirm `.env` is gitignored before the first commit with a key anywhere near the machine. It is
  right now — keep it that way.

## Done when

- [ ] Fresh clone → README steps → running app in under 5 minutes
- [ ] `npm run dev` gives a real desktop window with a real menu and a remembered size
- [ ] Mock server works standalone and Ian has used it
- [ ] Demo content chosen, loaded in fixtures, rehearsed twice
- [ ] API killed mid-demo degrades visibly instead of hanging
- [ ] `main` is green at every merge point
