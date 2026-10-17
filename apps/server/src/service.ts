import express from 'express';
import { createApiApp, type ApiOptions } from '../../api/src/app.js';
import { createMcpRouter } from '../../../scripts/mcp/server.js';
import type { TutorStore } from '../../../packages/tutor-state.js';

/** Shared API/MCP application for a local Node process and the Vercel request adapter. */
export function createServiceApp(store: TutorStore, options: ApiOptions = {}) {
  const app = express();
  app.disable('x-powered-by');
  if (process.env.TRUST_PROXY) app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : process.env.TRUST_PROXY);
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', [
      "default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:", "font-src 'self' data:", "connect-src 'self'",
      "worker-src 'self' blob:", "frame-ancestors 'none'", "base-uri 'none'", "form-action 'self'", "object-src 'none'",
    ].join('; '));
    if (options.secureCookies) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
    next();
  });
  app.use('/mcp', createMcpRouter(store));
  app.get('/healthz', (_req, res) => res.json({ ok: true, service: 'supertutor', surfaces: ['web', 'mcp'], modelCalls: false }));
  app.use(createApiApp(store, options));
  return app;
}
