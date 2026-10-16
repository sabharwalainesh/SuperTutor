// Runtime validation mirroring packages/types.ts.
// The model never gets to hand unvalidated shapes to the UI.
import { z } from 'zod';

export const questionSchema = z.object({
  id: z.string().min(1),
  prompt: z.string().min(1),
  topic: z.string().min(1),
  difficulty: z.enum(['easy', 'medium', 'hard']),
});

export const lessonSchema = z.object({
  id: z.string().min(1),
  sourceTitle: z.string().min(1),
  summary: z.array(z.string()).min(1),
  concepts: z.array(z.string()),
  questions: z.array(questionSchema).min(1),
});

export const feedbackSchema = z.object({
  questionId: z.string().min(1),
  score: z.number().min(0).max(100),
  verdict: z.enum(['correct', 'partial', 'incorrect']),
  explanation: z.string().min(1),
  improvedAnswer: z.string().min(1),
  missedTopics: z.array(z.string()),
});

export const lessonRequestSchema = z.object({
  text: z.string().min(20, 'Paste at least a couple of sentences to work from.'),
  count: z.number().int().min(1).max(10).optional(),
});

export const gradeRequestSchema = z.object({
  question: questionSchema,
  answer: z.string().min(1, 'Write an answer first.'),
});
