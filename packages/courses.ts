import { Router } from 'express';
import {
  CanvasError, canvasHtmlToText, fetchCanvasAssignment, fetchCanvasAssignments, fetchCanvasCourses,
  fetchCanvasIdentity, normalizeCanvasBaseUrl,
} from './canvas.js';
import { requireAccount } from './http-auth.js';
import { canvasConnectionSchema, canvasImportSchema } from './schemas.js';
import { StateError, type TutorStore } from './tutor-state.js';
import { MAX_MATERIAL_CHARS, MAX_WORK_CHARS, type CourseSource } from './types.js';

/**
 * Course sources from the product plan. Canvas is a real connection using the student's own
 * Canvas access token. The rest are listed with their actual status so the workspace never
 * implies an import that has not happened — a link is a reference, not its contents.
 */
export const describeSources = (canvasConnected: string | null): CourseSource[] => [
  {
    id: 'canvas',
    name: 'Canvas / bCourses',
    status: canvasConnected ? 'connected' : 'available',
    detail: 'Imports an assignment\'s title, instructions, due date, and link using your own Canvas access token. Reads only; it never submits work or changes anything in Canvas.',
    ...(canvasConnected ? { connectedAs: canvasConnected } : {}),
  },
  {
    id: 'lecture-video',
    name: 'Lecture video',
    status: 'manual-only',
    detail: 'Paste a transcript or caption excerpt and keep the source link. SuperTutor does not fetch or watch video, and a link alone is not its contents.',
  },
  {
    id: 'drive',
    name: 'Notes and slides',
    status: 'manual-only',
    detail: 'Paste the passage you want the tutor to use. Go may have its own Drive access, which is separate from this workspace.',
  },
  {
    id: 'repository',
    name: 'Local editor or repository',
    status: 'not-implemented',
    detail: 'No VS Code extension or Git connection yet, so work you edit elsewhere has to be saved here before the tutor can read it.',
  },
];

/**
 * The Canvas calls are injected so tests can exercise these routes without a live Canvas and
 * without relaxing the SSRF guard, which is unit-tested directly against real hostnames.
 */
export type CanvasClient = {
  identity: (baseUrl: string, token: string) => Promise<string | null>;
  courses: typeof fetchCanvasCourses;
  assignments: typeof fetchCanvasAssignments;
  assignment: typeof fetchCanvasAssignment;
  normalizeBaseUrl: (input: string) => string;
};
export const liveCanvasClient: CanvasClient = {
  identity: fetchCanvasIdentity,
  courses: fetchCanvasCourses,
  assignments: fetchCanvasAssignments,
  assignment: fetchCanvasAssignment,
  normalizeBaseUrl: normalizeCanvasBaseUrl,
};

export const createCoursesRouter = (store: TutorStore, canvas: CanvasClient = liveCanvasClient, credentials: (ownerId: string) => Promise<{baseUrl:string;token:string}> = async(ownerId) => store.useCanvasCredential(ownerId)) => {
  const router = Router();
  router.use(requireAccount);
  const owner = (res: { locals: Record<string, string> }) => res.locals.ownerId;

  router.get('/sources', (_req, res) => {
    const canvas = store.getCanvasConnection(owner(res));
    res.json({ sources: describeSources(canvas?.userName ?? (canvas ? canvas.baseUrl : null)), canvas });
  });

  router.put('/canvas', async (req, res, next) => {
    try {
      const result = canvasConnectionSchema.safeParse(req.body);
      if (!result.success) return res.status(400).json({ error: result.error.issues[0].message });
      const baseUrl = canvas.normalizeBaseUrl(result.data.baseUrl);
      // Verify the credential before storing it, so a typo never becomes a saved connection.
      const userName = await canvas.identity(baseUrl, result.data.token);
      res.json(store.saveCanvasConnection(owner(res), { baseUrl, token: result.data.token, userName }));
    } catch (error) { next(error); }
  });

  router.delete('/canvas', (_req, res) => {
    store.disconnectCanvas(owner(res));
    res.json({ ok: true });
  });

  router.get('/canvas/courses', async (_req, res, next) => {
    try {
      const { baseUrl, token } = await credentials(owner(res));
      res.json({ courses: await canvas.courses(baseUrl, token) });
    } catch (error) { next(error); }
  });

  router.get('/canvas/courses/:courseId/assignments', async (req, res, next) => {
    try {
      const courseId = Number(req.params.courseId);
      if (!Number.isInteger(courseId) || courseId <= 0) return res.status(400).json({ error: 'That is not a valid Canvas course.' });
      const { baseUrl, token } = await credentials(owner(res));
      res.json({ assignments: await canvas.assignments(baseUrl, token, courseId) });
    } catch (error) { next(error); }
  });

  /** Creates a SuperTutor assignment from a Canvas one. Instructions and link only — no work, no grades. */
  router.post('/canvas/import', async (req, res, next) => {
    try {
      const result = canvasImportSchema.safeParse(req.body);
      if (!result.success) return res.status(400).json({ error: result.error.issues[0].message });
      const { baseUrl, token } = await credentials(owner(res));
      const assignment = await canvas.assignment(baseUrl, token, result.data.courseId, result.data.assignmentId);
      const instructions = assignment.description ? canvasHtmlToText(assignment.description) : '';
      const due = assignment.dueAt ? `Due ${new Date(assignment.dueAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}.` : '';
      const prompt = [instructions, due].filter(Boolean).join('\n\n').slice(0, MAX_WORK_CHARS)
        || 'Canvas listed no instructions for this assignment. Paste the problem you were given.';
      const created = store.createAssignment(owner(res), {
        title: assignment.name.slice(0, 160),
        subject: result.data.subject,
        prompt,
        // The Canvas page is kept as provenance, clearly labeled as imported instructions.
        materials: assignment.htmlUrl
          ? [{
            title: 'Canvas assignment page',
            text: (instructions || 'Canvas listed no instructions for this assignment.').slice(0, MAX_MATERIAL_CHARS),
            sourceUrl: assignment.htmlUrl,
          }]
          : [],
      });
      res.status(201).json(created);
    } catch (error) { next(error); }
  });

  return router;
};

/** Canvas failures are reported with their own status, not as a SuperTutor error. */
export const canvasErrorHandler = (error: unknown) =>
  error instanceof CanvasError ? new StateError(error.status, error.message) : null;
