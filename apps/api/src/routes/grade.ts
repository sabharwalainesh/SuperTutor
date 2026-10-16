import { Router } from 'express';
import { fixtureFeedback } from '../../../../packages/fixtures.js';
import { askForJson, hasApiKey } from '../ai/client.js';
import { GRADE_PROMPT } from '../ai/prompts.js';
import { feedbackSchema, gradeRequestSchema } from '../ai/schema.js';

export const gradeRouter = Router();

gradeRouter.post('/grade', async (req, res) => {
  const parsed = gradeRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const { question, answer } = parsed.data;

  if (!hasApiKey()) {
    return res.json(fixtureFeedback(question));
  }

  try {
    const raw = await askForJson(GRADE_PROMPT(question.prompt, question.topic, answer), 1000);
    const feedback = feedbackSchema.safeParse({
      ...(raw as Record<string, unknown>),
      questionId: question.id,
    });

    if (!feedback.success) {
      return res.status(502).json({ error: 'The model returned feedback we could not read. Try again.' });
    }

    return res.json(feedback.data);
  } catch (error) {
    return res.status(502).json({ error: error instanceof Error ? error.message : 'Grading failed.' });
  }
});
