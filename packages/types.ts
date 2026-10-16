// SHARED CONTRACT — owned by Person C (glue lane).
// Changing anything here is a breaking change: announce it, push it alone,
// everyone pulls before continuing. See supertutor-product-plan.md §5.

export type Difficulty = 'easy' | 'medium' | 'hard';

export type Question = {
  id: string;
  prompt: string;
  topic: string;
  difficulty: Difficulty;
};

export type Lesson = {
  id: string;
  sourceTitle: string;
  summary: string[];
  concepts: string[];
  questions: Question[];
};

export type Verdict = 'correct' | 'partial' | 'incorrect';

export type Feedback = {
  questionId: string;
  score: number;
  verdict: Verdict;
  explanation: string;
  improvedAnswer: string;
  missedTopics: string[];
};

export type LessonRequest = { text: string; count?: number };
export type GradeRequest = { question: Question; answer: string };
export type ApiError = { error: string };

/** Everything the app persists between launches. */
export type Session = {
  lesson: Lesson | null;
  answers: Record<string, string>;
  feedback: Record<string, Feedback>;
  updatedAt: number;
};

export const emptySession = (): Session => ({
  lesson: null,
  answers: {},
  feedback: {},
  updatedAt: Date.now(),
});

export const MAX_SOURCE_CHARS = 8000;
export const DEFAULT_QUESTION_COUNT = 5;
