# Product decisions

The planning conversation established these decisions, which supersede the earlier direct-Claude prototype:

1. Students use **SuperTutor inside Superhuman Go**. Go performs tutoring; no separate model API is required by this application.
2. Connections work in both directions: tools return authorized context to Go, and Go calls write tools to save student attempts and feedback.
3. The companion workspace is where students save current work and see progress. It is not a second AI chat surface.
4. Help must address actual attempts: unfinished code, error output, math steps, or a draft. A GitHub or Drive connection alone does not capture unsaved local work.
5. Go asks diagnostic questions and gives increasingly explicit support while preserving student authorship. A completed target homework answer is not the default feedback artifact.
6. College lecture context often lives in Canvas/bCourses and hosted videos. Available transcripts, slides, and excerpts matter more than assuming students keep notes in Drive. Ingestion must be implemented and authorized before being advertised.
7. Start with one complete Go/tool/workspace loop. Automatic course sync, handwritten input, local editor access, code execution, and broad subject coverage come later.
8. This coordinated repository migration is authorized across lanes. Afterward, Albert owns API, Ian owns web, and Ainesh owns shared contracts, integration, Go setup, desktop, and docs.

Do not treat older role documents, scores, provider keys, or model personas from the original baseline as current requirements. Current contracts are in `packages/types.ts` and `packages/schemas.ts`.
