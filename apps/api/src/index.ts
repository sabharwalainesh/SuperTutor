import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { hasApiKey } from './ai/client.js';
import { gradeRouter } from './routes/grade.js';
import { lessonRouter } from './routes/lesson.js';

const PORT = Number(process.env.API_PORT ?? 8787);

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, mode: hasApiKey() ? 'live' : 'offline-fixtures' });
});

app.use('/api', lessonRouter);
app.use('/api', gradeRouter);

app.listen(PORT, () => {
  const mode = hasApiKey() ? 'live Claude' : 'OFFLINE fixtures (no ANTHROPIC_API_KEY)';
  console.log(`[api] http://localhost:${PORT} — ${mode}`);
});
