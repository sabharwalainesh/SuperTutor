# Learning Coach — Desktop Baseline

Electron desktop app for the MTC x Grammarly hackathon. Paste study material, get a lesson plus
practice questions, answer them, get graded feedback and a running list of your weak spots.

Full scope, lane ownership and merge rules: [`learning-coach-product-plan.md`](./learning-coach-product-plan.md).

**Per-person task docs:** [Ainesh](./docs/AINESH.md) · [Albert](./docs/ALBERT.md) · [Ian](./docs/IAN.md) · [index](./docs/ROLES.md)

## Setup

```bash
npm install
cp .env.example apps/api/.env   # optional — without a key the app runs on fixtures
npm run dev
```

`npm run dev` starts three processes: the API (:8787), the Vite renderer (:5173), and Electron.

**No API key?** Everything still works. The API detects the missing key and serves fixture data,
so the app is demoable offline.

## Layout — this is also the ownership map

| Path          | Owner    | Contents                                        |
|---------------|----------|-------------------------------------------------|
| `apps/web`    | Person A | React renderer, components, api/session libs     |
| `apps/api`    | Person B | Express server, routes, prompts, Claude client   |
| `apps/desktop`| Person C | Electron main + preload                          |
| `packages`    | Person C | `types.ts` (the contract), `fixtures.ts`         |
| `scripts`     | Person C | Mock server                                      |

Only the owner edits their directory. `packages/types.ts` changes are announced before they are pushed.

## Scripts

| Command                | What it does                                       |
|------------------------|----------------------------------------------------|
| `npm run dev`          | API + renderer + Electron together                 |
| `npm run dev:mock`     | Fixture-only API, for frontend work with B offline |
| `npm run typecheck`    | Type-checks every workspace against the contract   |
| `npm run build`        | Builds renderer and Electron main                  |

## Where to build next

- **New API route:** add `apps/api/src/routes/<name>.ts`, mount it in `index.ts`, add its types to `packages/types.ts` first.
- **New UI surface:** add a component under `apps/web/src/components/`, call it from `App.tsx`. All fetches go through `lib/api.ts` — do not add a second one.
- **Persistence beyond localStorage:** swap the body of `apps/web/src/lib/session.ts`; nothing else reads storage.
- **Native OS features:** add one explicit function to `apps/desktop/src/preload.cts`. Never expose `ipcRenderer` wholesale.
