# Ian — Student workspace

**Own:** `apps/web/**`. **Branch:** `feat/web` after the baseline lands.

The student talks to SuperTutor **in Go**. Your app captures actual work and displays saved results. Do not build a separate AI chat, a fake generated lesson, or a full-answer reveal panel.

## Baseline supplied

Sign-in and account screens, assignment creation/selection, optional source excerpts, a Monaco editor for code/math/writing with per-language highlighting and autosave, the connector setup screen, a Go starter prompt, polling of shared feedback/progress, loading/error states, and responsive layout.

Accounts, sessions, and connector tokens are Ainesh's lane: call `/api/auth/*` through `lib/api.ts` and treat a 401 as "signed out", rather than storing credentials yourself. Never render a connector token anywhere but the one screen that issues it.

## Work order

1. Run `npm run dev`, create the sample assignment, and save an edited draft. Check with Albert that Go sees that exact saved version.
2. With Ainesh's real connector active, confirm Go feedback appears without refreshing the page. Polling runs every 3 seconds and pauses on a hidden tab.
3. Make it obvious which work is saved, where tutoring happens, and whether the connection has actually been configured. Opening a Go URL does not prove connection status.
4. Exercise empty input, unavailable API, slow saves, assignment switching, long code/error output, and narrow windows. Verify local unsaved-draft recovery and improve navigation protection if time permits.
5. Make the next learning action clear. Preserve student authorship; show explanations/hints and uncertainty, not a model's finished target answer.
6. Polish accessibility and the exact demo path, then freeze.

## Done when

- Students can save a real assignment and their own attempt without copying it repeatedly into a separate editor.
- The work Go can read is clearly distinguished from unsaved edits.
- Feedback and progress reflect API records and update after Go writes them.
- Error, loading, and disconnected states are readable.
- The sample is visibly sample input, with no fake live tutoring.
- The app works in the browser at phone width as well as on a laptop. There is no desktop wrapper any more.

Shared API/types changes go through Albert and Ainesh. Automatic video ingestion, photo/handwriting interpretation, and live VS Code access are not in the baseline. A source link alone is not imported course content.
