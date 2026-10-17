import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Express } from 'express';
import { createServiceApp } from './service.js';
import { loadCanvasOAuthInstitutions } from '../../../packages/canvas-oauth.js';
import type { TransactionalStore } from '../../../packages/postgres-state.js';
import type { TutorStore } from '../../../packages/tutor-state.js';

/** Buffer the response until the database COMMIT succeeds, including redirects and cookies. */
function captureResponse(app: Express, request: IncomingMessage, response: ServerResponse) {
  const originals = { write: response.write, end: response.end, writeHead: response.writeHead, flushHeaders: response.flushHeaders };
  const chunks: Buffer[] = [];
  let size = 0;
  let settled = false;
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const done = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  const fail = (error: Error) => { if (!settled) { settled = true; reject(error); } };
  const onClose = () => fail(new Error('Client disconnected before the response was saved.'));
  response.once('close', onClose);
  const timer = setTimeout(() => fail(new Error('SuperTutor request timed out.')), 25_000);
  const append = (chunk: unknown, encoding?: unknown) => {
    if (chunk === undefined || chunk === null) return;
    const buffer = Buffer.isBuffer(chunk) ? chunk : typeof chunk === 'string' ? Buffer.from(chunk, typeof encoding === 'string' ? encoding as BufferEncoding : 'utf8') : Buffer.from(chunk as Uint8Array);
    size += buffer.length;
    if (size > 8 * 1024 * 1024) throw new Error('SuperTutor response is too large.');
    chunks.push(buffer);
  };
  response.write = ((chunk: unknown, encoding?: unknown, callback?: () => void) => {
    append(chunk, encoding);
    const cb = typeof encoding === 'function' ? encoding as () => void : callback;
    if (cb) queueMicrotask(cb);
    return true;
  }) as typeof response.write;
  response.writeHead = ((status: number, message?: unknown, headers?: unknown) => {
    response.statusCode = status;
    if (typeof message === 'string') response.statusMessage = message;
    const values = typeof message === 'object' ? message : headers;
    if (Array.isArray(values)) {
      for (let i = 0; i < values.length; i += 2) response.setHeader(String(values[i]), values[i + 1]);
    } else if (values) {
      for (const [key, value] of Object.entries(values)) if (value !== undefined) response.setHeader(key, value as string | number | string[]);
    }
    return response;
  }) as typeof response.writeHead;
  response.flushHeaders = () => { /* Headers are held until persistence succeeds. */ };
  response.end = ((chunk?: unknown, encoding?: unknown) => {
    append(chunk, encoding);
    if (!settled) { settled = true; resolve(); }
    return response;
  }) as typeof response.end;
  const restore = () => { Object.assign(response, originals); clearTimeout(timer); response.off('close', onClose); };
  try {
    app(request, response);
  } catch (error) { fail(error instanceof Error ? error : new Error('Request failed.')); }
  return {
    done,
    flush: () => { restore(); response.end(Buffer.concat(chunks)); },
    discard: restore,
  };
}

export function createServerlessHandler(persistence: TransactionalStore, appFactory: (store: TutorStore) => Express = store => createServiceApp(store, {
  secureCookies: true,
  canvasOAuthInstitutions: loadCanvasOAuthInstitutions(),
  deployment: {
    publicOrigin: process.env.SUPERTUTOR_PUBLIC_ORIGIN ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined),
    connectorListingUrl: process.env.CONNECTOR_LISTING_URL || null,
    agentDirectoryUrl: process.env.AGENT_DIRECTORY_URL || 'https://go.superhuman.com/agent-directory',
  },
})) {
  return async (request: IncomingMessage, response: ServerResponse) => {
    let captured: ReturnType<typeof captureResponse> | undefined;
    try {
      const url = new URL(request.url ?? '/', 'https://supertutor.invalid');
      // Vercel rewrites these two public paths into the API function; handle either URL form.
      if (url.pathname === '/api/mcp' || url.pathname === '/api/healthz') {
        request.url = `${url.pathname.slice(4)}${url.search}`;
      }
      await persistence.run(async store => {
        captured = captureResponse(appFactory(store), request, response);
        await captured.done;
      });
      captured!.flush();
    } catch (error) {
      captured?.discard();
      if (response.destroyed) return;
      for (const name of response.getHeaderNames()) response.removeHeader(name);
      console.error('[serverless] Request failed:', error instanceof Error ? error.name : 'UnknownError');
      response.statusCode = 503;
      response.statusMessage = 'Service Unavailable';
      response.setHeader('Content-Type', 'application/json');
      response.setHeader('Cache-Control', 'no-store');
      response.end(JSON.stringify({ error: 'SuperTutor could not complete this request. Your change was not confirmed. Please try again.' }));
    }
  };
}
