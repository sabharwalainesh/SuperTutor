import type { Assignment, AssignmentContext, AssignmentInput, Draft, ProgressSummary, WorkInput } from '../../../../packages/types.js';
const BASE = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8787';
const request = async <T>(path: string, method = 'GET', body?: unknown): Promise<T> => {
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method, headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(10_000),
    });
  } catch { throw new Error('Cannot reach the workspace API. Start it and try again.'); }
  const data = await response.json().catch(() => ({ error: 'The workspace returned an unreadable response.' }));
  if (!response.ok) throw new Error(data.error ?? 'The workspace request failed.');
  return data as T;
};
export const listAssignments = () => request<{ assignments: Assignment[] }>('/api/assignments');
export const createAssignment = (input: AssignmentInput) => request<Assignment>('/api/assignments', 'POST', input);
export const getContext = (id: string) => request<AssignmentContext>(`/api/assignments/${id}/context`);
export const getProgress = (id: string) => request<ProgressSummary>(`/api/assignments/${id}/progress`);
export const saveDraft = (id: string, work: WorkInput) => request<Draft>(`/api/assignments/${id}/draft`, 'PUT', work);
