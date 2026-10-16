# Connect the SuperTutor agent in Go

Owner: **Ainesh**, with Albert testing tool behavior and Ian checking the workspace.

This is an account setup procedure. The repository contains a working local MCP bridge and a connector template, not an already-installed Go agent.

## 1. Start the local workspace

```bash
npm install
cp .env.example .env
npm run dev
```

Create a sample assignment and save its work at http://localhost:5173. Check http://127.0.0.1:8787/api/health reports `go-tools`. No Anthropic/model key is needed.

## 2. Set the bridge credential

Generate a random token locally:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Put the result in `MCP_BEARER_TOKEN` in the ignored root `.env` file. Keep it private; do not paste it into GitHub, screenshots, chat, or a frontend variable. Start `npm run dev:mcp` in another terminal. Alternatively, after configuring the token, `npm run dev:connected` starts API, workspace, and bridge together.

The bridge refuses to start with a missing/short token. Its health endpoint is public, but every `/mcp` request requires `Authorization: Bearer <token>`.

## 3. Make only the MCP endpoint reachable

If using a trusted tunnel tool such as cloudflared or ngrok, expose **port 8788 only**. For example, after installing cloudflared through its official instructions:

```bash
cloudflared tunnel --url http://127.0.0.1:8788
```

The resulting HTTPS URL plus `/mcp` is the connector endpoint. A laptop localhost URL is not reachable from Go's cloud. Keep the local API on loopback; do not tunnel 8787. A tunnel command is a deployment action the team performs deliberately, not something the app starts silently.

## 4. Create and install a connector

Follow the [official MCP connector tutorial](https://coda.io/packs/build/latest/tutorials/build/mcp/). It lists a Go Pro-or-higher plan and Doc Maker access as prerequisites; check event-provided account access with the mentor early.

- Open Pack Studio and create a connector Pack.
- Copy `agents/connector.pack.ts.example` into the editor.
- Replace both `YOUR-TUNNEL.example` values with the actual endpoint hostname. Use that hostname in `addNetworkDomain`, with no protocol/path.
- Build and release the Pack, then install its connector in Go.
- During connector authentication, provide the same bridge bearer token, following the credential field's instructions. Do not hardcode it into the Pack source.
- Test `list_assignments` in Go before building a longer tutoring flow. Confirm it returns the assignment created in the workspace.

Exact UI labels and account permissions may vary. The template's hostname is intentionally not a live deployment. If your event account offers a different supported connector creation flow, use that flow with the same authenticated Streamable HTTP endpoint.

## 5. Create the Go tutor

Create a custom agent named SuperTutor. Paste the behavior instructions in `agents/supertutor.md`. Enable the SuperTutor connector. Add other course connectors only if they are available, authorized, and relevant. Automatic Canvas/video access is not part of this baseline.

Use one Go tutor first; do not recreate four backend model personas. Teach through tools and the student's actual work. Go performs the reasoning and saves feedback through `record_feedback`.

## 6. Verify the actual round trip

1. In the workspace, load the sample loop assignment and save its draft.
2. In Go, ask SuperTutor to open that assignment and explain why the loop does not finish, without writing the finished function.
3. Confirm Go calls the context tool and uses the actual code.
4. Have Go record the student's attempt, then save specific feedback with the returned attempt ID.
5. Check the workspace learning log updates within a few seconds.
6. Submit a revised attempt and check that it is preserved as a separate attempt.
7. Ask one transfer question and test uncertain/alternative answers.

Record the real Go interaction for the demo. `npm test` proves local SDK/tool integration only; it cannot establish a real Go connection or tutoring quality.

## Troubleshooting

- **401:** connector credential and `.env` token must match; restart the bridge after changing `.env`.
- **Cannot reach server:** check the tunnel is running, points to 8788, and the connector URL ends with `/mcp`.
- **Tools missing:** build/release/install the updated connector and check the official connector logs.
- **No assignments:** create one in the workspace; both processes must point to the same API port.
- **Feedback not saved:** record the attempt first, use its returned ID, and supply the nested `feedback` object. Only developing feedback may have missed concepts.
- **No video text:** a source link alone is not a transcript. Supply an accessible excerpt or configure a supported authorized source connection.
