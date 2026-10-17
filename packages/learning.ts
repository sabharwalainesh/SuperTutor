import { z } from 'zod';
const questionIdSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/, 'Use a short unique question ID.').refine(value => !['constructor','prototype'].includes(value), 'Use a different question ID.');
const short = z.string().trim().min(1).max(1000);
export const questionSchema = z.object({id:questionIdSchema,prompt:short,topic:z.string().min(1).max(160),difficulty:z.enum(['easy','medium','hard'])});
export const lessonSchema = z.object({id:z.string().min(1).max(100),sourceTitle:z.string().min(1).max(160),summary:z.array(short).min(3).max(5),concepts:z.array(z.string().min(1).max(160)).min(1).max(12),questions:z.array(questionSchema).min(3).max(8)}).refine(value=>new Set(value.questions.map(q=>q.id)).size===value.questions.length,{message:'Questions must have unique IDs.'});
export const gradeSchema = z.object({questionId:questionIdSchema,score:z.number().int().min(0).max(100),verdict:z.enum(['correct','partial','incorrect']),explanation:z.string().min(1).max(2000),improvedAnswer:z.string().min(1).max(3000),missedTopics:z.array(z.string().min(1).max(160)).max(12)});
export const lessonInputSchema = z.object({text:z.string().trim().min(40,'Paste at least 40 characters of course notes.').max(8000,'Course notes must be 8,000 characters or fewer.'),count:z.number().int().min(3).max(8).default(5),sample:z.boolean().default(false)});
export const gradeInputSchema = z.object({sessionId:z.string().uuid(),questionId:questionIdSchema,answer:z.string().trim().min(1,'Write an answer first.').max(4000,'Answers must be 4,000 characters or fewer.')});
export const studySessionSchema = z.object({id:z.string().uuid(),source:z.string().max(8000),requestedCount:z.number().int().min(3).max(8),lesson:lessonSchema.nullable(),answers:z.record(z.string().max(4000)),answerRevisions:z.record(z.string().uuid()),feedback:z.record(gradeSchema),sample:z.boolean(),updatedAt:z.number()});
export type StudySession = z.infer<typeof studySessionSchema>;

export type Lesson = z.infer<typeof lessonSchema>;
export type PracticeQuestion = z.infer<typeof questionSchema>;
export type PracticeFeedback = z.infer<typeof gradeSchema>;
export type LessonInput = z.input<typeof lessonInputSchema>;
export type GradeInput = z.infer<typeof gradeInputSchema>;
export type LearningSession = {lesson:Lesson|null;answers:Record<string,string>;feedback:Record<string,PracticeFeedback>;source:string;sample:boolean};
