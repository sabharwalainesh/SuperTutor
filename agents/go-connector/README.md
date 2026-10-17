# SuperTutor Go connector

This is the source of the private SuperTutor connector, Pack **72889**, release **2**.

- Workspace: https://super-tutor-mauve.vercel.app
- MCP endpoint: https://super-tutor-mauve.vercel.app/mcp
- Install/listing: https://docs.superhuman.com/packs/72889
- Pack Studio: https://docs.superhuman.com/p/72889?section=code

The connector requires the student's own bearer token, created in the live website under **Connect your tutor**. It reads only that account's saved coursework and uses the MCP write tools to save attempts, lessons, and tutor feedback. It never receives the student's Canvas credentials. No model API key is used.

The owner released this version through Pack Studio. It is not verified or publicly published in the Go Store; other accounts need Pack access before installing. Release 1 was an auto-generated draft without authentication and was replaced with the authenticated definition in this directory.

For future source changes, run `npm ci` and `npm run validate` here before uploading/building and releasing a new version. Keep `.coda.json` and local Pack metadata out of source control. Do not create a duplicate Pack when updating this one.
