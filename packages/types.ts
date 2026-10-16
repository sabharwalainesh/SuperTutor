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

// ---------------------------------------------------------------------------
// AGENTS (added for the Superhuman Go pivot — see docs/ARCHITECTURE.md)
// ---------------------------------------------------------------------------

/**
 * The four tutor personas. Each is a system prompt plus a job, not a model.
 * `apps/api` runs them locally; Superhuman Go agents reach the same jobs
 * through the MCP server in `scripts/mcp-server.ts`.
 */
export type AgentRole = 'explainer' | 'quizzer' | 'grader' | 'coach';

export type TutorTurn = {
  role: 'user' | 'agent';
  agent?: AgentRole;
  text: string;
  at: number;
};

export type AgentRequest = {
  role: AgentRole;
  /** Free-text ask. The quizzer and coach ignore it when empty. */
  message?: string;
  /** Prior turns, oldest first. The caller owns truncation. */
  history?: TutorTurn[];
  /** Concept the explainer should teach. Required for `explainer`. */
  concept?: string;
};

export type AgentReply = {
  role: AgentRole;
  text: string;
  /** Set when the quizzer picked a question to ask next. */
  question?: Question;
  /** Set when the coach wants the UI to jump somewhere. */
  suggestedConcept?: string;
};

/** One concept the learner keeps missing. Derived, never hand-edited. */
export type WeakSpot = {
  concept: string;
  misses: number;
  attempts: number;
  /** 0-100, mean score across attempts on this concept. */
  mastery: number;
  lastSeenAt: number;
};

/** The whole learner record. Shared by the app and the MCP server. */
export type TutorState = {
  lesson: Lesson | null;
  sourceText: string;
  answers: Record<string, string>;
  feedback: Record<string, Feedback>;
  transcript: TutorTurn[];
  askedQuestionIds: string[];
  updatedAt: number;
};

export const emptyTutorState = (): TutorState => ({
  lesson: null,
  sourceText: '',
  answers: {},
  feedback: {},
  transcript: [],
  askedQuestionIds: [],
  updatedAt: Date.now(),
});

export type ProgressSummary = {
  sourceTitle: string | null;
  questionsAnswered: number;
  questionsTotal: number;
  meanScore: number | null;
  weakSpots: WeakSpot[];
};

/** Agent personas are fixed; the MCP tool list and the UI both read this. */
export const AGENT_ROLES: readonly AgentRole[] = ['explainer', 'quizzer', 'grader', 'coach'];
