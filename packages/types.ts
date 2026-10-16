/** Shared contract. Ainesh owns changes after the coordinated Go-led migration. */
export const SUBJECTS = ['coding', 'math', 'writing'] as const;
export type Subject = (typeof SUBJECTS)[number];
export const ASSESSMENTS = ['developing', 'demonstrated', 'uncertain'] as const;
export type Assessment = (typeof ASSESSMENTS)[number];
export const MAX_WORK_CHARS = 16_000;
export const MAX_MATERIAL_CHARS = 32_000;

export type MaterialInput = { title: string; text: string; sourceUrl?: string };
export type Material = MaterialInput & { id: string; createdAt: number };
export type AssignmentInput = { title: string; subject: Subject; prompt: string; materials?: MaterialInput[] };
export type Assignment = Omit<AssignmentInput, 'materials'> & { id: string; materials: Material[]; createdAt: number };
export type WorkInput = { work: string; question?: string; errorOutput?: string };
export type Draft = WorkInput & { updatedAt: number };
export type AttemptInput = WorkInput & { clientRequestId?: string };
export type Attempt = WorkInput & { id: string; assignmentId: string; createdAt: number };
export type FeedbackInput = {
  attemptId: string;
  assessment: Assessment;
  explanation: string;
  nextStep: string;
  missedConcepts: string[];
  hintLevel: number;
};
export type Feedback = FeedbackInput & { id: string; assignmentId: string; author: 'go-agent'; updatedAt: number };
export type AssignmentContext = { assignment: Assignment; draft: Draft | null; attempts: Attempt[]; feedback: Feedback[] };
export type ProgressSummary = {
  assignmentId: string;
  attemptsTotal: number;
  reviewedAttempts: number;
  demonstratedAttempts: number;
  practiceTopics: { concept: string; mentions: number; lastSeenAt: number }[];
  latestNextStep: string | null;
};
export type TutorDatabase = { version: 2; records: Record<string, AssignmentContext> };
export type ApiError = { error: string };
