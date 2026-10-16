// Demo/offline data. The API falls back to these when no ANTHROPIC_API_KEY is set,
// so the app is always demoable — including on stage with bad wifi.
import type { Feedback, Lesson, Question } from './types.js';

export const fixtureLesson: Lesson = {
  id: 'fixture-lesson',
  sourceTitle: 'Spaced Repetition & Memory',
  summary: [
    'Memory decays predictably; review timed against that curve beats cramming.',
    'Each successful recall lengthens the interval before the next review.',
    'Difficulty of recall, not time spent, is what strengthens retention.',
  ],
  concepts: ['Forgetting curve', 'Retrieval practice', 'Interval scheduling', 'Desirable difficulty'],
  questions: [
    {
      id: 'q1',
      prompt: 'Why does spacing reviews out beat reviewing the same material repeatedly in one sitting?',
      topic: 'Interval scheduling',
      difficulty: 'easy',
    },
    {
      id: 'q2',
      prompt: 'What does "desirable difficulty" mean, and why is an easy review close to worthless?',
      topic: 'Desirable difficulty',
      difficulty: 'medium',
    },
    {
      id: 'q3',
      prompt: 'Describe how a scheduler should react when a learner fails a card they previously passed twice.',
      topic: 'Interval scheduling',
      difficulty: 'hard',
    },
  ],
};

export const fixtureFeedback = (question: Question): Feedback => ({
  questionId: question.id,
  score: 62,
  verdict: 'partial',
  explanation:
    'You named the right mechanism but stopped before explaining why it works. Offline fixture response — set ANTHROPIC_API_KEY in apps/api/.env for real grading.',
  improvedAnswer:
    'Spacing forces the memory to be reconstructed after partial decay. That reconstruction is the thing that strengthens the trace; a massed review skips it because the answer is still in working memory.',
  missedTopics: [question.topic],
});
