import cors from 'cors';
import express, { type ErrorRequestHandler, type RequestHandler } from 'express';
import { assignmentInputSchema, attemptInputSchema, feedbackInputSchema, idSchema, materialInputSchema, workInputSchema } from '../../../packages/schemas.js';
import { StateError, TutorStore } from '../../../packages/tutor-state.js';

export const createApiApp = (store: TutorStore) => {
  const app = express();
  app.disable('x-powered-by');
  app.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'null'] }));
  app.use(express.json({ limit: '512kb' }));
  app.get('/api/health', (_req, res) => res.json({ ok: true, mode: 'go-tools', schemaVersion: 2, modelCalls: false }));
  app.get('/api/assignments', (_req, res) => res.json({ assignments: store.listAssignments() }));
  app.post('/api/assignments', (req, res) => {
    const result = assignmentInputSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ error: result.error.issues[0].message });
    res.status(201).json(store.createAssignment(result.data));
  });
  const requireId: RequestHandler = (req, res, next) => {
    const result = idSchema.safeParse(req.params.id);
    if (!result.success) return res.status(400).json({ error: result.error.issues[0].message });
    res.locals.assignmentId = result.data;
    next();
  };
  app.get('/api/assignments/:id/context', requireId, (_req, res) => res.json(store.getContext(res.locals.assignmentId)));
  app.get('/api/assignments/:id/progress', requireId, (_req, res) => res.json(store.getProgress(res.locals.assignmentId)));
  app.put('/api/assignments/:id/draft', requireId, (req, res) => {
    const result = workInputSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ error: result.error.issues[0].message });
    res.json(store.saveDraft(res.locals.assignmentId, result.data));
  });
  app.post('/api/assignments/:id/attempts', requireId, (req, res) => {
    const result = attemptInputSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ error: result.error.issues[0].message });
    res.json(store.recordAttempt(res.locals.assignmentId, result.data));
  });
  app.post('/api/assignments/:id/feedback', requireId, (req, res) => {
    const result = feedbackInputSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ error: result.error.issues[0].message });
    res.json(store.recordFeedback(res.locals.assignmentId, result.data));
  });
  app.post('/api/assignments/:id/materials', requireId, (req, res) => {
    const result = materialInputSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ error: result.error.issues[0].message });
    res.status(201).json(store.addMaterial(res.locals.assignmentId, result.data));
  });
  app.post(['/api/lesson', '/api/grade'], (_req, res) => res.status(410).json({ error: 'Tutoring now happens in Superhuman Go. Use the assignment tools API; see docs/API.md.' }));
  app.use((_req, res) => res.status(404).json({ error: 'API route not found.' }));
  const errorHandler: ErrorRequestHandler = (error, _req, res, next) => {
    if (res.headersSent) return next(error);
    if (error instanceof StateError) return res.status(error.status).json({ error: error.message });
    if (error?.type === 'entity.too.large') return res.status(413).json({ error: 'Request too large. Send less than 512 KB.' });
    if (error instanceof SyntaxError && 'body' in error) return res.status(400).json({ error: 'Request body must contain valid JSON.' });
    if (error?.type === 'charset.unsupported' || error?.type === 'encoding.unsupported') return res.status(415).json({ error: 'Use UTF-8 JSON with a supported content encoding.' });
    if (error instanceof URIError) return res.status(400).json({ error: 'The request URL contains invalid encoding.' });
    console.error('[api] Request failed:', error instanceof Error ? error.name : 'UnknownError');
    res.status(500).json({ error: 'We could not save or read that work. Please try again.' });
  };
  app.use(errorHandler);
  return app;
};
