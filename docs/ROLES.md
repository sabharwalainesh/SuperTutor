# Who owns what

| Person | Lane | Directories | Assignment |
|---|---|---|---|
| Ainesh | Integration and Go setup | `packages/**`, `scripts/**`, `agents/**`, `.github/**`, `apps/desktop/**`, root config, `docs/**`, `README.md` | [AINESH.md](AINESH.md) |
| Albert | API tools and backend reliability | `apps/api/**` | [ALBERT.md](ALBERT.md) |
| Ian | Companion workspace | `apps/web/**` | [IAN.md](IAN.md) |

The coordinated Go-led migration updates all three lanes under Albert's explicit authorization. After it lands, return to this map. Read everything; edit only your lane. Request changes from the owner rather than silently editing their files.

Ainesh owns shared contracts and dependency/lockfile changes. Announce such changes, push them alone, and have everyone pull before continuing.

Work on `feat/api`, `feat/web`, and `feat/glue`. Integrate small reviewed changes frequently, rebase on the latest main, and keep main runnable. Never force-push main. The Go-led baseline PR should land as one coordinated change because its API, types, bridge, and UI are a matched set.

There is no requirement for four developers or four Go agents. Albert helps with teaching quality; Ainesh owns the actual Go configuration. See [architecture](ARCHITECTURE.md).
