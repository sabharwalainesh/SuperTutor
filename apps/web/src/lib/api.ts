// The ONLY file in the renderer that talks to the network.
import type { Feedback, Lesson, Question } from '../../../../packages/types.js';

const BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8787';

const post = async <T>(path: string, body: unknown): Promise<T> => {
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('Cannot reach the local API. Is it running on port 8787?');
  }

  const data = await response.json().catch(() => ({ error: 'Bad response from the API.' }));
  if (!response.ok) throw new Error((data as { error?: string }).error ?? 'Request failed.');
  return data as T;
};

export const createLesson = (text: string, count?: number) =>
  post<Lesson>('/api/lesson', { text, count });

export const gradeAnswer = (question: Question, answer: string) =>
  post<Feedback>('/api/grade', { question, answer });
