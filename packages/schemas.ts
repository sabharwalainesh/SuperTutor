import { z } from 'zod';
import { ASSESSMENTS, MAX_MATERIAL_CHARS, MAX_WORK_CHARS, SUBJECTS } from './types.js';

const text = (max: number) => z.string().trim().min(1, 'Enter some text first.').max(max);
const optionalText = (max: number) => z.string().trim().max(max).optional();
export const idSchema = z.string().uuid('Use a valid assignment or attempt ID.');
export const materialInputSchema = z.object({
  title: text(160),
  text: text(MAX_MATERIAL_CHARS),
  sourceUrl: z.string().url().max(2_000).refine((url) => /^https?:\/\//i.test(url), 'Use an HTTP or HTTPS source link.').optional(),
}).strict();
export const assignmentInputSchema = z.object({
  title: text(160), subject: z.enum(SUBJECTS), prompt: text(MAX_WORK_CHARS),
  materials: z.array(materialInputSchema).max(10).optional(),
}).strict();
export const workInputSchema = z.object({
  work: text(MAX_WORK_CHARS), question: optionalText(2_000), errorOutput: optionalText(8_000),
}).strict();
export const attemptInputSchema = workInputSchema.extend({ clientRequestId: idSchema.optional() });
export const feedbackInputSchema = z.object({
  attemptId: idSchema, assessment: z.enum(ASSESSMENTS), explanation: text(6_000), nextStep: text(3_000),
  missedConcepts: z.array(text(120)).max(12).transform((items) => [...new Set(items)]),
  hintLevel: z.number().int().min(0).max(4),
}).strict().superRefine((value, context) => {
  if (value.assessment !== 'developing' && value.missedConcepts.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['missedConcepts'], message: 'Only developing feedback can record missed concepts. Uncertain feedback is not a diagnosis.' });
  }
});

// Validate persisted data on startup; corrupt or incompatible files must not be silently erased.
const materialSchema = materialInputSchema.extend({ id: idSchema, createdAt: z.number() });
const assignmentSchema = assignmentInputSchema.omit({ materials: true }).extend({ id: idSchema, materials: z.array(materialSchema), createdAt: z.number() });
const attemptSchema = workInputSchema.extend({ id: idSchema, assignmentId: idSchema, createdAt: z.number() });
const feedbackSchema = z.object({
  id: idSchema, assignmentId: idSchema, attemptId: idSchema, assessment: z.enum(ASSESSMENTS),
  explanation: text(6_000), nextStep: text(3_000), missedConcepts: z.array(text(120)).max(12),
  hintLevel: z.number().int().min(0).max(4), author: z.literal('go-agent'), updatedAt: z.number(),
});
export const databaseSchema = z.object({
  version: z.literal(2),
  records: z.record(z.object({ assignment: assignmentSchema, draft: workInputSchema.extend({ updatedAt: z.number() }).nullable(), attempts: z.array(attemptSchema), feedback: z.array(feedbackSchema) })),
});
