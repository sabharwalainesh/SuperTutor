import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { DEFAULT_QUESTION_COUNT, MAX_SOURCE_CHARS } from '../../../../packages/types.js';
import { fixtureLesson } from '../../../../packages/fixtures.js';
import { askForJson, hasApiKey } from '../ai/client.js';
import { LESSON_PROMPT } from '../ai/prompts.js';
import { lessonRequestSchema, lessonSchema } from '../ai/schema.js';

export const lessonRouter = Router();

lessonRouter.post('/lesson', async (req, res) => {
  const parsed = lessonRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const { text, count = DEFAULT_QUESTION_COUNT } = parsed.data;
  if (text.length > MAX_SOURCE_CHARS) {
    return res.status(400).json({
      error: `That's ${text.length} characters. Trim it to ${MAX_SOURCE_CHARS} or fewer.`,
    });
  }

  if (!hasApiKey()) {
    return res.json({ ...fixtureLesson, id: randomUUID() });
  }

  try {
    const raw = await askForJson(LESSON_PROMPT(text, count), 2000);
    // The model doesn't invent ids; we own them so the frontend can key off them.
    const withIds = {
      ...(raw as Record<string, unknown>),
      id: randomUUID(),
      questions: ((raw as { questions?: unknown[] }).questions ?? []).map((q, i) => ({
        ...(q as Record<string, unknown>),
        id: `q${i + 1}`,
      })),
    };

    const lesson = lessonSchema.safeParse(withIds);
    if (!lesson.success) {
      return res.status(502).json({ error: 'The model returned a lesson we could not read. Try again.' });
    }

    return res.json(lesson.data);
  } catch (error) {
    return res.status(502).json({ error: error instanceof Error ? error.message : 'Lesson failed.' });
  }
});
