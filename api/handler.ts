import type { IncomingMessage, ServerResponse } from 'node:http';
import { getPostgresState } from '../packages/postgres-state.js';
import { createServerlessHandler } from '../apps/server/src/serverless.js';

// Express must read the original request body; disable Vercel's pre-parsing.
export const config = { api: { bodyParser: false } };

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  // Vercel Node functions do not use Next.js catch-all filename semantics.
  // Rewrites pass the full route explicitly to this one function.
  const query = (request as IncomingMessage & { query?: Record<string, unknown> }).query;
  const original = new URL(request.url ?? '/', 'https://supertutor.invalid');
  const route = query?.__supertutor_route ?? original.searchParams.get('__supertutor_route');
  if (typeof route !== 'string' || !(route.startsWith('/api/') || route === '/mcp' || route === '/healthz') || route.includes('?') || route.includes('#')) {
    response.statusCode = 404;
    response.end();
    return;
  }
  original.searchParams.delete('__supertutor_route');
  request.url = route + original.search;
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
    response.statusCode = 503;
    response.setHeader('Content-Type', 'application/json');
    response.setHeader('Cache-Control', 'no-store');
    response.end(JSON.stringify({ error: 'SuperTutor’s database is not connected. Add a PostgreSQL database to this Vercel project and redeploy.' }));
    return;
  }
  await createServerlessHandler(getPostgresState())(request, response);
}
