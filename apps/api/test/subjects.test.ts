import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import { TutorStore } from '../../../packages/tutor-state.js';
import { createApiApp } from '../src/app.js';

const serve = async () => {
  const server = createApiApp(new TutorStore()).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const request = async (path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST') => {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, data: await response.json() };
  };
  return {
    request,
    close: () => new Promise<void>((resolve) => {
      server.closeAllConnections();
      server.close(() => resolve());
    }),
  };
};

test('coding, math, and writing preserve real work and honest Go assessments', async () => {
  const api = await serve();
  try {
    const cases = [
      {
        assignment: {
          title: 'Recursive total',
          subject: 'coding',
          prompt: 'Compute a total without using a loop.',
          materials: [{
            title: 'Lecture excerpt',
            text: 'A recursive function needs a base case and a smaller recursive call.',
            sourceUrl: 'https://course.example.edu/recursion',
          }],
        },
        attempt: { work: 'def total(n):\n    return 0 if n == 0 else n + total(n - 1)' },
        feedback: {
          assessment: 'demonstrated',
          explanation: 'This is a valid recursive alternative with a base case and decreasing input.',
          nextStep: 'Trace total(3) to explain why it terminates.',
          missedConcepts: [],
          hintLevel: 0,
        },
      },
      {
        assignment: {
          title: 'Distribute a factor',
          subject: 'math',
          prompt: 'Expand 3(x + 4) and explain each step.',
        },
        attempt: { work: '3(x + 4) = 3x + 4', question: 'Is the 4 also multiplied?' },
        feedback: {
          assessment: 'developing',
          explanation: 'You distributed the factor to x but not yet to every term in the sum.',
          nextStep: 'What is 3 multiplied by 4?',
          missedConcepts: ['Distribution'],
          hintLevel: 1,
        },
      },
      {
        assignment: {
          title: 'Evidence paragraph',
          subject: 'writing',
          prompt: 'Write a paragraph connecting evidence to your claim.',
        },
        attempt: { work: 'The author repeats the image of a locked door. This supports my claim.', question: 'Is my explanation specific enough?' },
        feedback: {
          assessment: 'uncertain',
          explanation: 'The connection may be valid, but the intended claim is not included in this attempt.',
          nextStep: 'State your claim, then explain what the locked door suggests about it.',
          missedConcepts: [],
          hintLevel: 0,
        },
      },
    ] as const;

    for (const item of cases) {
      const created = await api.request('/api/assignments', item.assignment);
      assert.equal(created.status, 201);
      const path = `/api/assignments/${created.data.id}`;

      const attempt = await api.request(`${path}/attempts`, item.attempt);
      assert.equal(attempt.status, 200);
      const savedFeedback = await api.request(`${path}/feedback`, {
        attemptId: attempt.data.id,
        ...item.feedback,
      });
      assert.equal(savedFeedback.status, 200);
      assert.equal(savedFeedback.data.author, 'go-agent');

      const context = await api.request(`${path}/context`);
      assert.equal(context.data.assignment.subject, item.assignment.subject);
      assert.equal(context.data.attempts[0].work, item.attempt.work);
      assert.equal(context.data.feedback[0].assessment, item.feedback.assessment);
      if ('materials' in item.assignment) {
        assert.equal(context.data.assignment.materials[0].text, item.assignment.materials[0].text);
        assert.equal(context.data.assignment.materials[0].sourceUrl, item.assignment.materials[0].sourceUrl);
      }

      const progress = await api.request(`${path}/progress`);
      assert.equal(progress.data.attemptsTotal, 1);
      assert.equal(progress.data.reviewedAttempts, 1);
      assert.equal(progress.data.demonstratedAttempts, item.feedback.assessment === 'demonstrated' ? 1 : 0);
      assert.equal(progress.data.practiceTopics.length, item.feedback.assessment === 'developing' ? 1 : 0);
    }
  } finally {
    await api.close();
  }
});

