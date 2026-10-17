# Product decisions

The planning conversation established these decisions, which supersede the earlier direct-Claude prototype:

1. Students use **SuperTutor inside Superhuman Go**. Go performs tutoring; no separate model API is required by this application.
2. Connections work in both directions: tools return authorized context to Go, and Go calls write tools to save student attempts and feedback.
3. The web workspace is where students save current work and see progress. It is not a second AI chat surface.
   - SuperTutor is a hosted web application with student accounts, not a local single-tenant demo. One Node server serves the workspace, `/api`, and `/mcp` on one origin; the Electron wrapper was deleted rather than maintained beside it.
   - Each student authenticates the browser with a session cookie and authenticates Go with their own connector token, stored as a hash and revocable. There is no shared bridge token, because one shared secret across students is not a multi-user design.
   - The MCP tools call the shared store directly instead of making HTTP calls back to the API in the same process. One store instance stays the single authority, and the shared Zod schemas still validate every tool argument.
   - The work pane uses Monaco, the editor component from VS Code, so coding assignments feel like a real editor. Nothing is executed, so there is no sandbox to maintain. A while-writing trigger cannot fire in this app, so proactive tutoring belongs to Superhuman surfaces such as Docs.
4. Help must address actual attempts: unfinished code, error output, math steps, or a draft. A GitHub or Drive connection alone does not capture unsaved local work.
5. Go asks diagnostic questions and gives increasingly explicit support while preserving student authorship. A completed target homework answer is not the default feedback artifact.
6. College lecture context often lives in Canvas/bCourses and hosted videos. Available transcripts, slides, and excerpts matter more than assuming students keep notes in Drive. Ingestion must be implemented and authorized before being advertised.
7. Start with one complete Go/tool/workspace loop. Automatic course sync, handwritten input, local editor access, code execution, and broad subject coverage come later.
8. This coordinated repository migration is authorized across lanes. Afterward, Albert owns API, Ian owns web, and Ainesh owns shared contracts, auth, the server, integration, Go setup, and docs.

Do not treat older role documents, scores, provider keys, or model personas from the original baseline as current requirements. Current contracts are in `packages/types.ts` and `packages/schemas.ts`.
