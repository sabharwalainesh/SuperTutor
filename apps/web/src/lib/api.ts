import type { StudySession, LessonInput, GradeInput } from '../../../../packages/learning.js';
import type {
  Account, Assignment, AssignmentContext, AssignmentInput, CanvasAssignment, CanvasConnection,
  CanvasConnectionInput, CanvasCourse, CanvasImportInput, ConnectorTokenIssued, CourseSource,
  Credentials, DeploymentConfig, Draft, ProgressSummary, WorkInput,
} from '../../../../packages/types.js';

/** Same origin in production; the Vite dev server proxies /api to the same server in development. */
const BASE = import.meta.env.VITE_API_BASE ?? '';

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const request = async <T>(path: string, method = 'GET', body?: unknown): Promise<T> => {
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method, credentials: 'include',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30_000),
    });
  } catch { throw new ApiError(0, 'Cannot reach SuperTutor. Check your connection and try again.'); }
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => ({ error: 'SuperTutor returned an unreadable response.' }));
  if (!response.ok) throw new ApiError(response.status, data.error ?? 'That request failed.');
  return data as T;
};

export const signUp = (credentials: Credentials) => request<Account>('/api/auth/signup', 'POST', credentials);
export const signIn = (credentials: Credentials) => request<Account>('/api/auth/signin', 'POST', credentials);
export const signOut = () => request<{ ok: true }>('/api/auth/signout', 'POST', {});
export const getAccount = () => request<Account>('/api/auth/me');
export const createConnectorToken = (label?: string) => request<ConnectorTokenIssued>('/api/auth/connectors', 'POST', label ? { label } : {});
export const revokeConnectorToken = (id: string) => request<Account>(`/api/auth/connectors/${id}`, 'DELETE');

export const listAssignments = () => request<{ assignments: Assignment[] }>('/api/assignments');
export const createAssignment = (input: AssignmentInput) => request<Assignment>('/api/assignments', 'POST', input);
export const getContext = (id: string) => request<AssignmentContext>(`/api/assignments/${id}/context`);
export const getProgress = (id: string) => request<ProgressSummary>(`/api/assignments/${id}/progress`);
export const saveDraft = (id: string, work: WorkInput) => request<Draft>(`/api/assignments/${id}/draft`, 'PUT', work);

export const getConfig = () => request<DeploymentConfig>('/api/config');
export const shareOpenAssignment = (assignmentId: string) => request<{assignmentId: string; updatedAt: number}>('/api/workspace/active', 'PUT', {assignmentId});

export const getCourseSources = () => request<{ sources: CourseSource[]; canvas: CanvasConnection | null }>('/api/courses/sources');
export const connectCanvas = (input: CanvasConnectionInput) => request<CanvasConnection>('/api/courses/canvas', 'PUT', input);
export const disconnectCanvas = () => request<{ ok: true }>('/api/courses/canvas', 'DELETE');
export const listCanvasCourses = () => request<{ courses: CanvasCourse[] }>('/api/courses/canvas/courses');
export const listCanvasAssignments = (courseId: number) => request<{ assignments: CanvasAssignment[] }>(`/api/courses/canvas/courses/${courseId}/assignments`);
export const importCanvasAssignment = (input: CanvasImportInput) => request<Assignment>('/api/courses/canvas/import', 'POST', input);

export const generateLesson = (input: LessonInput) => request<StudySession>('/api/lesson', 'POST', input);
export const gradeAnswer = (input: GradeInput) => request<StudySession>('/api/grade', 'POST', input);

export const getStudySession = () => request<{study: StudySession | null}>('/api/study');
export const clearStudySession = () => request<{ok:true}>('/api/study', 'DELETE');

export const canvasSignInUrl = (institution: string, intent: 'signin' | 'connect' = 'signin') => `${BASE}/api/auth/canvas/start?${new URLSearchParams({institution,intent})}`;
