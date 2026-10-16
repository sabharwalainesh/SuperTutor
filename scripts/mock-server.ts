// Lane A's unblocker: serves the fixtures on the real routes, no API key, no model.
// Run with `npm run dev:mock` instead of `npm run dev:api`.
import cors from 'cors';
import express from 'express';
import { randomUUID } from 'node:crypto';
import { fixtureFeedback, fixtureLesson } from '../packages/fixtures.js';
import type { GradeRequest } from '../packages/types.js';

const PORT = Number(process.env.API_PORT ?? 8787);
const LATENCY_MS = 600; // Fake the wait so loading states get built, not forgotten.

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const delay = () => new Promise((resolve) => setTimeout(resolve, LATENCY_MS));

app.get('/api/health', (_req, res) => res.json({ ok: true, mode: 'mock' }));

app.post('/api/lesson', async (_req, res) => {
  await delay();
  res.json({ ...fixtureLesson, id: randomUUID() });
});

app.post('/api/grade', async (req, res) => {
  await delay();
  const { question } = req.body as GradeRequest;
  res.json(fixtureFeedback(question));
});

app.listen(PORT, () => console.log(`[mock] http://localhost:${PORT} — fixtures only`));
