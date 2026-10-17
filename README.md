# SuperTutor

**A web app for your assignments, with your tutor in Superhuman Go beside it.**

Students sign in, create an assignment, and write their code, math steps, or draft in a real editor. They open the **SuperTutor agent in Superhuman Go**, which reads that work through the student's own connector, asks diagnostic questions, explains concepts, and offers one next-step hint. Go saves attempts and feedback back to the workspace, so the next session has context.

**Two learning flows:** Go tutors you on saved assignments through the SuperTutor connector. **Study & practice** turns pasted course notes into a short lesson and 3–8 practice questions, grades answers with explanations, and tracks topics to revisit. Your Superhuman Go agent creates lessons and reviews submitted answers through the same connector. No model API key is needed.

## The experience

1. Create an account. Import an assignment from **Canvas**, or paste one in.
2. Write your attempt in the workspace editor. It autosaves, and saved work is what the tutor reads.
3. Set up once under **Connect your tutor**: create your access token, install the published SuperTutor connector, then search the agent directory for the tutor that fits your course.
4. Ask your tutor in Go. It reads your current work and answers with a question, not the finished answer.
5. Its marks appear in the margin beside your work, with the hint level it actually used.

The agent should preserve student authorship, accept valid alternative approaches, and change its explanation when a student is stuck. It should not give the finished homework solution. See [the tutor instructions](agents/supertutor.md).

## What works

- Accounts with scrypt-hashed passwords and HttpOnly session cookies; every assignment is scoped to its owner.
- Multi-school Canvas sign-in automatically connects the student's account, with automatic OAuth token refresh. Each school requires its own approved registration; see [Canvas setup](docs/CANVAS_SIGN_IN.md). Email sign-in and manual Canvas access tokens remain available.
- Canvas / bCourses assignment import: instructions, due date, and link, with instructor HTML reduced to text. Read-only; it never submits work.
- A course sources screen that states each source's real status instead of implying an import happened.
- A published-pack setup flow: the maintainer publishes the connector and tutor agents once, and students install them and search the agent directory. Students never paste pack source.
- Per-student connector tokens for Go, shown once, stored only as hashes, revocable, with a visible last-used time.
- One server on one origin hosting the workspace, `/api`, and the authenticated `/mcp` endpoint.
- Coding, math, and writing assignments, with a Monaco editor (the editing interface from VS Code), per-language syntax highlighting, and autosave.
- A responsive website with a visual landing page, interactive subject examples, searchable assignments, Canvas navigation, light/dark mode, and reduced-motion support.
- Browser setup prompts recommend desktop Chrome or Edge and show Go installation and toolbar-pinning steps. Extension readiness uses the student's confirmation because a website cannot inspect arbitrary installed extensions.
- Study & practice: validated lessons, question-by-question grading, revised answers, weak-topic counts, server-persisted sessions and local draft recovery scoped to the signed-in account. Sample lessons are labeled; missing Go feedback never becomes fixture grades.
- Optional course excerpts with source links, including accessible lecture transcripts.
- Nine MCP tools with read/write annotations, bound to the token's owner.
- A learning log fed only by what Go actually saved — no fabricated feedback anywhere.
- Tests covering the API, tenancy isolation across both surfaces, a real MCP SDK client, and migration of a pre-accounts state file.

**Account setup is separate:** the Go connector must be created and installed and the agent configured before Go can call these tools. Local tests do not establish a live Go connection. Follow [Go setup](docs/GO_SETUP.md).

Not implemented: code execution, password reset or email verification, Canvas write-back or grade reading, automatic lecture-video or transcript ingestion, handwritten-image analysis, a VS Code extension, symbolic math verification, official grading or submission, and automated application backups. A source URL is a reference, not proof its content was imported. A Superhuman while-writing trigger cannot fire inside this web app; it fires on Superhuman surfaces such as Docs, so proactive help works there and the workspace relies on asking Go directly.

## Run locally

For Vercel hosting, see [the deployment guide](docs/DEPLOY.md#vercel). The web output is `apps/web/dist`; `/api` and `/mcp` run in a PostgreSQL-backed function so accounts and work survive cold starts.

Use **Node 22+**.

```bash
npm install
cp .env.example .env
npm run dev
```

Open [the workspace](http://localhost:5173) and create an account. The Vite dev server proxies `/api` and `/mcp` to the app server on port 8787, so the session cookie behaves exactly as in production. No model API key is needed. Connect your SuperTutor agent in Superhuman Go to create lessons and review submitted practice answers. Try the sample assignment; its lecture excerpt is clearly labeled sample content, and no sample tutor feedback is fabricated.

To run the production server on one port:

```bash
npm run build
npm start                     # http://127.0.0.1:8787
```

Go cannot reach `localhost`, so deploy the app or expose it over an HTTPS tunnel before publishing the connector. Publish the connector and tutor agents once and set `CONNECTOR_LISTING_URL`; students then install rather than paste pack source. See [deployment](docs/DEPLOY.md) and [Go setup](docs/GO_SETUP.md). Each student creates their own access token in the workspace; there is no shared bridge token.

## Who owns what

| Person | Responsibility | Owned files | Assignment |
|---|---|---|---|
| **Albert** | Backend context, attempts, feedback, validation, API tests | `apps/api/**` | [ALBERT.md](docs/ALBERT.md) |
| **Ainesh** | Shared contracts/state, auth, the server, MCP connection, Go setup, integration and demo | `packages/**`, `apps/server/**`, `scripts/**`, `agents/**`, `.github/**`, root config, `docs/**`, `README.md` | [AINESH.md](docs/AINESH.md) |
| **Ian** | Web workspace, work capture, saved feedback and progress UI | `apps/web/**` | [IAN.md](docs/IAN.md) |

Everyone may read everything. Edit your lane; ask the owner for a change elsewhere. Ainesh owns shared type/dependency changes and announces them before others pull. Nobody independently reinvents an API shape or introduces a second state store.

Albert also helps design and test teaching behavior; Ainesh applies those instructions to the Go agent. Four backend model personas are no longer part of the plan.

## Lesson and practice verification

See [the coverage notes](docs/LEARNING_PLAN_COVERAGE.md) for the attached base plan, setup, and remaining live checks. Use “Try sample notes” in the website, or `node --import tsx scripts/demo-seed.ts` to print demo course notes.
