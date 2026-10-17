import { studySessionSchema } from './learning.js';
import { z } from 'zod';
import { ASSESSMENTS, MAX_MATERIAL_CHARS, MAX_WORK_CHARS, SUBJECTS } from './types.js';

const text = (max: number) => z.string().trim().min(1, 'Enter some text first.').max(max);
// Preserve indentation and newlines in code, student work, and source excerpts.
// The same schemas validate persisted records when the API restarts.
const sourceText = (max: number) => z.string().max(max).refine((value) => value.trim().length > 0, 'Enter some text first.');
const optionalText = (max: number) => z.string().trim().max(max).optional();
export const idSchema = z.string().uuid('Use a valid assignment or attempt ID.');
export const materialInputSchema = z.object({
  title: text(160),
  text: sourceText(MAX_MATERIAL_CHARS),
  sourceUrl: z.string().url().max(2_000).refine((url) => /^https?:\/\//i.test(url), 'Use an HTTP or HTTPS source link.').optional(),
}).strict();
export const assignmentInputSchema = z.object({
  title: text(160), subject: z.enum(SUBJECTS), prompt: text(MAX_WORK_CHARS),
  materials: z.array(materialInputSchema).max(10).optional(),
}).strict();
export const workInputSchema = z.object({
  work: sourceText(MAX_WORK_CHARS), question: optionalText(2_000), errorOutput: z.string().max(8_000).optional(),
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

// Accounts. A weak minimum length is the one password rule worth enforcing; composition rules
// push students toward reused passwords without adding real strength.
export const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(254),
  password: z.string().min(10, 'Use at least 10 characters.').max(200, 'Use at most 200 characters.'),
}).strict();
export const connectorTokenInputSchema = z.object({ label: optionalText(60) }).strict();
/** Shape check only; the real check is a constant-time hash comparison in the store. */
export const connectorSecretSchema = z.string().regex(/^st_[A-Za-z0-9_-]{43}$/, 'That is not a SuperTutor connector token.');

// Course sources. The Canvas token is the student's own, generated in Canvas and revocable there.
export const canvasConnectionSchema = z.object({
  baseUrl: z.string().trim().min(4, 'Enter your Canvas web address.').max(255),
  token: z.string().trim().min(20, 'Paste the full Canvas access token.').max(500),
}).strict();
export const canvasImportSchema = z.object({
  courseId: z.number().int().positive(),
  assignmentId: z.number().int().positive(),
  subject: z.enum(SUBJECTS),
}).strict();

// Validate persisted data on startup; corrupt or incompatible files must not be silently erased.
const materialSchema = materialInputSchema.extend({ id: idSchema, createdAt: z.number() });
const assignmentSchema = assignmentInputSchema.omit({ materials: true }).extend({ id: idSchema, materials: z.array(materialSchema), createdAt: z.number() });
const attemptSchema = workInputSchema.extend({ id: idSchema, assignmentId: idSchema, createdAt: z.number() });
const feedbackSchema = z.object({
  id: idSchema, assignmentId: idSchema, attemptId: idSchema, assessment: z.enum(ASSESSMENTS),
  explanation: text(6_000), nextStep: text(3_000), missedConcepts: z.array(text(120)).max(12),
  hintLevel: z.number().int().min(0).max(4), author: z.literal('go-agent'), updatedAt: z.number(),
});
const recordSchema = z.object({
  assignment: assignmentSchema,
  draft: workInputSchema.extend({ updatedAt: z.number() }).nullable(),
  attempts: z.array(attemptSchema),
  feedback: z.array(feedbackSchema),
});
const storedUserSchema = z.object({
  activeAssignment: z.object({ assignmentId: idSchema, updatedAt: z.number() }).optional(),
  displayName: z.string().max(200).optional(),
  canvasIdentity: z.object({ baseUrl: z.string().url(), userId: z.string().min(1) }).optional(),
  study: studySessionSchema.optional(),
  id: idSchema, email: z.string().email().max(254), passwordHash: z.string().min(1), createdAt: z.number(),
  connectors: z.array(z.object({ id: idSchema, label: z.string().max(60), hash: z.string().length(64), createdAt: z.number(), expiresAt: z.number(), lastUsedAt: z.number().nullable() })),
  sessions: z.array(z.object({ hash: z.string().length(64), createdAt: z.number(), expiresAt: z.number() })),
  canvas: z.object({
    oauth: z.object({ refreshToken: z.string().min(1), expiresAt: z.number() }).optional(),
    baseUrl: z.string().url(), token: z.string().min(1), userName: z.string().nullable(),
    connectedAt: z.number(), lastUsedAt: z.number().nullable(),
  }).optional(),
});
export const databaseSchema = z.object({
  version: z.literal(3),
  users: z.record(storedUserSchema),
  records: z.record(recordSchema.extend({ ownerId: idSchema.nullable() })),
  canvasOAuthFlows: z.record(z.object({ institutionId: z.string().min(1), nonceHash: z.string().length(64), expires: z.number(), ownerId: idSchema.nullable() })).optional(),
  authRateLimits: z.record(z.object({ count: z.number().int().nonnegative(), resetAt: z.number() })).optional(),
});
/** Version 2 had no accounts. Its records are migrated unowned and claimed by the first account. */
export const databaseV2Schema = z.object({ version: z.literal(2), records: z.record(recordSchema) });
