import { loadCanvasOAuthInstitutions } from '../../../packages/canvas-oauth.js';
import express from 'express';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { repoRoot, stateFile } from '../../../packages/config.js';
import { TutorStore } from '../../../packages/tutor-state.js';
import { createServiceApp } from './service.js';

const port = Number(process.env.PORT ?? process.env.API_PORT ?? 8787);
// Loopback by default so a misread instruction cannot expose an unconfigured instance.
const host = process.env.HOST ?? '127.0.0.1';
const production = process.env.NODE_ENV === 'production';
// Behind a tunnel or load balancer the session cookie must still be marked Secure.
const secureCookies = process.env.SECURE_COOKIES === 'true' || production;
const devOrigins = production ? [] : ['http://localhost:5173', 'http://127.0.0.1:5173'];
const webDist = resolve(repoRoot, 'apps/web/dist');

const store = new TutorStore(stateFile);
const app = createServiceApp(store, {
  devOrigins,
  secureCookies,
  canvasOAuthInstitutions: loadCanvasOAuthInstitutions(),
  deployment: {
    // Set once the SuperTutor connector is published, so students install it instead of
    // pasting pack source. Until then the setup screen shows the maintainer's publish step.
    connectorListingUrl: process.env.CONNECTOR_LISTING_URL || null,
    agentDirectoryUrl: process.env.AGENT_DIRECTORY_URL || 'https://go.superhuman.com/agent-directory',
  },
});

if (existsSync(webDist)) {
  app.use(express.static(webDist, { index: false, maxAge: production ? '1h' : 0 }));
  // Client-side routing: every non-API path renders the app shell.
  app.get('*', (_req, res) => res.sendFile(resolve(webDist, 'index.html')));
} else {
  app.get('*', (_req, res) => res.status(503).type('text/plain').send('Run "npm run build:web" to build the workspace, or use "npm run dev" for the Vite dev server.'));
}

app.listen(port, host, () => {
  console.log(`[supertutor] http://${host}:${port} — workspace, API, and /mcp on one origin. Go performs the tutoring.`);
  if (!existsSync(webDist)) console.log('[supertutor] No web build found yet. "npm run dev" serves the workspace from Vite on port 5173.');
});
