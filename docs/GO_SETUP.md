# Connect the SuperTutor agent in Go

Owner: **Ainesh**, with Albert testing tool behavior and Ian checking the workspace.

This is an account setup procedure. The repository contains a working web app and connector templates, not an already-installed Go agent.

Each student connects their own account. There is no shared bridge token: the workspace issues a per-student connector token, stores only its hash, and a token reaches that student's assignments and nothing else.

Signing out of the website ends the browser session only. The Go credential is independent and remains valid until its 180-day expiry or explicit revocation. On a later sign-in, the website recognizes a live token with successful prior use, hides repeated onboarding in supported browsers, and shows **Go connection saved** under Connect your tutor. Account metadata refreshes on focus and every 30 seconds while visible, so the first successful Go use is recognized without a reload. Extension installation confirmation is a separate browser preference; clearing it must not reset the account connection. Unsupported browsers still receive compatibility guidance.

## Use Go beside an open question

Open an assignment in the website, then open the **Go tab at the right edge of desktop Chrome/Edge** (or use the Go extension icon). Ask “Help me with my open SuperTutor question.” Keep the assignment page attached in Go. The website shares the visible assignment through an authenticated `PUT /api/workspace/active`; the connector can call `get_assignment_context` without an ID. This selection expires after 15 minutes without a refresh. If several tabs are open, the ID on the attached page takes precedence over the most recently shared question.

Each assignment also has a stable `#work/ASSIGNMENT_ID` link and its ID in the page's Question reference. The website's tutor panel includes an exact-context starter as a clipboard fallback. Unsaved edits are local until autosave succeeds; Go reads the saved version.

This configures context retrieval, not automatic conversation or extension control. The website does not have a documented API to open Go’s native sidebar or send a chat to it. The student opens Go and sends the first message. Generic Go with the SuperTutor connector works; a custom tutoring agent can additionally use the instructions in `agents/supertutor.md`.

## 1. Run the app

```bash
npm install
cp .env.example .env
npm run dev
```

One server (port 8787 by default) hosts the workspace, the `/api` routes, and the authenticated `/mcp` endpoint. In development the Vite dev server on http://localhost:5173 proxies `/api` and `/mcp` to it, so the session cookie behaves exactly as in production.

Create an account, create an assignment, and save some work. `http://127.0.0.1:8787/healthz` should report both surfaces and `modelCalls: false`. No Anthropic or other model key is needed.

## 2. Make the app reachable over HTTPS

Go runs in Superhuman's cloud and cannot reach `localhost`. Deploy the app, or expose it through a trusted tunnel. Unlike the previous two-process layout, the whole app is now behind one origin, so the tunnel exposes the workspace as well as `/mcp` — treat that origin as public.

```bash
npm run build          # build the workspace once
npm start              # production server, NODE_ENV=production
cloudflared tunnel --url http://127.0.0.1:8787
```

Behind a tunnel or proxy, set `SECURE_COOKIES=true` and `TRUST_PROXY=true` so the session cookie is marked Secure and sign-in rate limiting sees real client IPs. See [deployment](DEPLOY.md).

## 3. Publish the packs — maintainer, once per deployment

**Students never write or paste pack source.** One person publishes the connector and the tutor agents for the whole deployment; everyone else installs them.

Follow the [official MCP connector tutorial](https://coda.io/packs/build/latest/tutorials/build/mcp/). It lists a Go Pro-or-higher plan and Doc Maker access as prerequisites; check event-provided account access with the mentor early.

1. In Pack Studio, create a connector Pack from `agents/connector.pack.ts.example`. Replace both hostnames with your deployed origin; `addNetworkDomain` takes the hostname alone, with no protocol or path. The workspace's setup screen prints the exact endpoint.
2. Build, release, and publish it. Note its pack ID and its store listing URL.
3. Set `CONNECTOR_LISTING_URL` to that listing and restart the server. The setup screen then shows students an install link instead of the publishing instructions.
4. Publish the tutor agents from `agents/agent.pack.ts.example`, one per subject if you want a coding, math, and writing tutor. Each grants the connector by pack ID and carries the instructions from `agents/supertutor.md`.
5. Optionally set `AGENT_DIRECTORY_URL` if your deployment points students somewhere other than `https://go.superhuman.com/agent-directory`.

A `setDefaultWhileWritingTrigger` lets an agent offer help on its own while a student writes. A contextual trigger only fires on Superhuman surfaces such as Docs and Email — it cannot fire inside the SuperTutor web workspace, where the student asks the agent directly. Triggers and tool grants are copied when an agent is installed, so reinstall after changing either one.

## 4. What each student does

In the workspace, open **Connect your tutor**. Three steps, in this order:

1. **Create an access token.** Shown once, stored only as a hash, revocable from the same screen.
2. **Install the SuperTutor connector** from the store link, pasting that token when Go asks for a credential.
3. **Search the agent directory for SuperTutor** and install the tutor for their subject.

Students can choose **Sign in with Canvas** and select their school to connect automatically. Each school must first have an approved OAuth registration configured by the maintainer; see [multi-school Canvas setup](CANVAS_SIGN_IN.md). Existing accounts can link under **Canvas & bCourses**, or connect manually with a Canvas access token (Canvas → Account → Settings → New access token). Imports read assignment instructions, due dates, and links only; they never submit work. Disconnecting deletes the stored credentials.

## 5. Teaching behavior

Go performs the reasoning and saves feedback through `record_feedback`. Keep the instructions in `agents/supertutor.md` as the single source of teaching behavior, and do not recreate four backend model personas.

## 6. Verify the actual round trip

1. In the workspace, open the sample loop assignment and save its draft.
2. In Go, ask SuperTutor to open that assignment and explain why the loop does not finish, without writing the finished function.
3. Confirm Go calls the context tool and uses the actual code.
4. Have Go record the student's attempt, then save specific feedback with the returned attempt ID.
5. Check the workspace learning log updates within a few seconds.
6. Submit a revised attempt and check that it is preserved as a separate attempt.
7. Ask one transfer question and test uncertain or alternative answers.

Record the real Go interaction for the demo. `npm test` proves local SDK and tool integration only; it cannot establish a real Go connection or judge tutoring quality.

## Troubleshooting

- **401 from `/mcp`:** the token was revoked, expired, mistyped, or belongs to another deployment. Create a new one in the workspace and update the connector's credential.
- **No install link on the setup screen:** `CONNECTOR_LISTING_URL` is unset, so the connector has not been published for this deployment yet.
- **Canvas rejects the token:** generate a fresh one in Canvas under Account → Settings. SuperTutor refuses non-HTTPS and private Canvas addresses by design.
- **Canvas import has no instructions:** the instructor left the description empty in Canvas. Paste the problem yourself.
- **Cannot reach server:** check the tunnel is running, points at the app's port, and the connector URL ends with `/mcp`.
- **Tools missing:** build, release, and install the updated connector, then check the official connector logs.
- **No assignments:** the token's account has none. Confirm you are signed in as the same student who generated it.
- **Feedback not saved:** record the attempt first, use its returned ID, and supply the nested `feedback` object. Only developing feedback may have missed concepts.
- **Signed out unexpectedly:** sessions last 30 days, and signing out invalidates that session only. Connector tokens are independent of sessions and last 180 days.
- **No video text:** a source link alone is not a transcript. Supply an accessible excerpt or configure a supported authorized source connection.

## Study & practice tools

The connector now includes `get_study_session`, `record_study_lesson`, and `record_practice_feedback` alongside the six assignment tools. Update the deployed MCP server, publish the updated instructions in `agents/supertutor.md`, and reinstall/update the agent if its installed tool grants were copied before these tools existed. The website never calls a model API.

Students paste notes into Study & practice and choose **Prepare lesson in Go**, then copy the request into their SuperTutor agent. Go creates and saves the lesson. Students write an answer and choose **Send answer to Go**, then ask the agent to review it. Saved feedback appears automatically in the website.

## Current private connector

The production workspace is https://super-tutor-mauve.vercel.app. Its authenticated MCP endpoint is https://super-tutor-mauve.vercel.app/mcp. The private SuperTutor connector is Pack **72889**, release **2**, with source maintained in `agents/go-connector/pack.ts`. It uses a per-student bearer token; the first auto-generated version incorrectly omitted authentication and was superseded.

The connector can be installed by accounts with Pack access at https://docs.superhuman.com/packs/72889. A release is not public Store verification or sharing permission. Broader distribution still requires the owner to share/publish the Pack. Never commit its API credentials or `.coda.json` file.
