import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { TutorStore } from '../../../packages/tutor-state.js';
import { createApiApp } from '../src/app.js';

const assignment = { title: 'Loop reasoning', subject: 'coding', prompt: 'Explain why this loop does not terminate.' };
const serve = async (store = new TutorStore()) => {
  const server = createApiApp(store).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const request = async (path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST') => {
    const res = await fetch(`${base}${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: res.status, data: await res.json() };
  };
  return { store, base, request, close: () => new Promise<void>((resolve) => { server.closeAllConnections(); server.close(() => resolve()); }) };
};

test('student work, attempt history, feedback corrections, and progress share one state', async () => {
  const api = await serve();
  try {
    assert.equal((await api.request('/api/health')).data.modelCalls, false);
    const { data: a } = await api.request('/api/assignments', assignment);
    const path = `/api/assignments/${a.id}`;
    const work = { work: 'while i <= n: total += i', question: 'Where is the progress?' };
    assert.equal((await api.request(`${path}/draft`, work, 'PUT')).status, 200);
    const context = await api.request(`${path}/context`);
    assert.equal(context.data.draft.work, work.work);
    assert.equal(context.data.attempts.length, 0, 'saving a draft is not proof of an attempt');
    const clientRequestId = randomUUID();
    const { data: attempt } = await api.request(`${path}/attempts`, { ...work, clientRequestId });
    assert.equal((await api.request(`${path}/attempts`, { ...work, clientRequestId })).data.id, attempt.id);
    assert.equal((await api.request(`${path}/attempts`, { work: 'different', clientRequestId })).status, 409);
    const feedback = { attemptId: attempt.id, assessment: 'developing', explanation: 'You have an initial value and condition. Trace how i changes.', nextStep: 'What is i after one iteration?', missedConcepts: ['Loop progress', 'Loop progress'], hintLevel: 0 };
    const firstFeedback = await api.request(`${path}/feedback`, feedback);
    assert.equal(firstFeedback.status, 200);
    const repeatedFeedback = await api.request(`${path}/feedback`, feedback);
    assert.equal(repeatedFeedback.data.updatedAt, firstFeedback.data.updatedAt, 'identical retry preserves the review timestamp');
    let progress = (await api.request(`${path}/progress`)).data;
    assert.equal(progress.attemptsTotal, 1);
    assert.equal(progress.reviewedAttempts, 1);
    assert.equal(progress.demonstratedAttempts, 0, 'a hint cannot itself establish success');
    assert.deepEqual(progress.practiceTopics.map((t: { concept: string; mentions: number }) => [t.concept, t.mentions]), [['Loop progress', 1]]);
    await api.request(`${path}/attempts`, { work: 'A revised student attempt explaining the update.' });
    await api.request(`${path}/feedback`, { ...feedback, assessment: 'demonstrated', missedConcepts: [], nextStep: 'Try tracing a different input.' });
    progress = (await api.request(`${path}/progress`)).data;
    assert.equal(progress.attemptsTotal, 2);
    assert.equal(progress.reviewedAttempts, 1);
    assert.equal(progress.demonstratedAttempts, 1);
    assert.deepEqual(progress.practiceTopics, []);
    assert.equal((await api.request('/api/assignments')).data.assignments.length, 1);
  } finally { await api.close(); }
});

test('rejects invalid input and cross-assignment feedback with readable errors', async () => {
  const api = await serve();
  try {
    assert.equal((await api.request('/api/assignments', { ...assignment, prompt: '   ' })).status, 400);
    assert.equal((await api.request('/api/assignments', { ...assignment, prompt: 'x'.repeat(16001) })).status, 400);
    const { data: a } = await api.request('/api/assignments', assignment);
    const { data: b } = await api.request('/api/assignments', { ...assignment, title: 'Other assignment' });
    const path = `/api/assignments/${a.id}`;
    assert.equal((await api.request(`${path}/attempts`, { work: ' ' })).status, 400);
    assert.equal((await api.request(`${path}/materials`, { title: 'Bad source', text: 'Example', sourceUrl: 'javascript:alert(1)' })).status, 400);
    const { data: attempt } = await api.request(`/api/assignments/${b.id}/attempts`, { work: 'A separate attempt' });
    const feedback = { attemptId: attempt.id, assessment: 'developing', explanation: 'Explanation', nextStep: 'Question?', missedConcepts: ['Loops'], hintLevel: 1 };
    assert.equal((await api.request(`${path}/feedback`, feedback)).status, 404);
    assert.equal((await api.request(`/api/assignments/${b.id}/feedback`, { ...feedback, assessment: 'demonstrated' })).status, 400);
    assert.equal((await api.request(`/api/assignments/${b.id}/feedback`, { ...feedback, assessment: 'uncertain' })).status, 400);
    assert.equal((await api.request('/api/assignments/not-an-id/context')).status, 400);
    assert.equal((await api.request(`/api/assignments/${randomUUID()}/context`)).status, 404);
    assert.equal((await api.request('/api/lesson', { text: 'Old route' })).status, 410);
  } finally { await api.close(); }
});

test('malformed and oversized bodies always return JSON, not stack traces', async () => {
  const api = await serve();
  try {
    for (const [body, status] of [['{broken', 400], [JSON.stringify({ prompt: 'x'.repeat(530000) }), 413]] as const) {
      const response = await fetch(`${api.base}/api/assignments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
      assert.equal(response.status, status);
      assert.match(response.headers.get('content-type') ?? '', /application\/json/);
      const data = await response.json();
      assert.equal(typeof data.error, 'string');
      assert.equal('stack' in data, false);
    }
  } finally { await api.close(); }
});

test('unsupported request encodings and malformed URLs are readable client errors', async () => {
  const api = await serve();
  try {
    const cases = [
      { path: '/api/assignments', headers: { 'Content-Type': 'application/json; charset=invalid' }, body: '{}', status: 415 },
      { path: '/api/assignments', headers: { 'Content-Type': 'application/json', 'Content-Encoding': 'invalid' }, body: '{}', status: 415 },
      { path: '/api/assignments/%E0%A4%A/context', status: 400 },
    ];
    for (const item of cases) {
      const response = await fetch(`${api.base}${item.path}`, {
        method: item.body === undefined ? 'GET' : 'POST', headers: item.headers, body: item.body,
      });
      assert.equal(response.status, item.status);
      assert.match(response.headers.get('content-type') ?? '', /application\/json/);
      const data = await response.json();
      assert.equal(typeof data.error, 'string');
      assert.equal('stack' in data, false);
    }
    assert.deepEqual((await api.request('/api/assignments')).data.assignments, []);
  } finally { await api.close(); }
});

test('code indentation, source excerpts, feedback, and retries survive an API restart', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'supertutor-restart-'));
  const file = join(dir, 'state.json');
  let api = await serve(new TutorStore(file));
  try {
    const material = { title: 'Indented excerpt', text: '    return total\n', sourceUrl: 'https://example.edu/lecture' };
    const { data: a } = await api.request('/api/assignments', { ...assignment, materials: [material] });
    const path = `/api/assignments/${a.id}`;
    const work = { work: '    total += i\n    i += 1\n', errorOutput: '  File "student.py", line 8\n    total += i\n' };
    const clientRequestId = randomUUID();
    const draft = await api.request(`${path}/draft`, work, 'PUT');
    assert.equal(draft.data.work, work.work);
    const { data: attempt } = await api.request(`${path}/attempts`, { ...work, clientRequestId });
    assert.equal(attempt.work, work.work);
    assert.equal(attempt.errorOutput, work.errorOutput);
    const feedback = { attemptId: attempt.id, assessment: 'developing', explanation: 'Trace the update.', nextStep: 'What value changes?', missedConcepts: ['Loop progress'], hintLevel: 0 };
    assert.equal((await api.request(`${path}/feedback`, feedback)).status, 200);
    const before = (await api.request(`${path}/context`)).data;
    assert.equal(before.assignment.materials[0].text, material.text);
    await api.close();
    api = await serve(new TutorStore(file));
    assert.deepEqual((await api.request(`${path}/context`)).data, before);
    assert.equal((await api.request(`${path}/attempts`, { ...work, clientRequestId })).data.id, attempt.id);
    await api.request(`${path}/feedback`, feedback);
    const progress = (await api.request(`${path}/progress`)).data;
    assert.equal(progress.attemptsTotal, 1);
    assert.equal(progress.reviewedAttempts, 1);
    assert.equal(progress.practiceTopics[0].mentions, 1);
    assert.equal((await api.request(`${path}/attempts`, { work: ' \n\t ' })).status, 400);
    assert.equal((await api.request(`${path}/materials`, { title: 'Blank', text: ' \n\t ' })).status, 400);
  } finally { await api.close(); rmSync(dir, { recursive: true, force: true }); }
});

test('a disk write failure does not report success or change saved work', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'supertutor-write-failure-'));
  const file = join(dir, 'state.json');
  const api = await serve(new TutorStore(file));
  try {
    const { data: a } = await api.request('/api/assignments', assignment);
    const path = `/api/assignments/${a.id}`;
    const work = { work: 'Original work' };
    await api.request(`${path}/draft`, work, 'PUT');
    const before = readFileSync(file, 'utf8');
    // A directory at the destination makes the atomic rename fail on every platform.
    rmSync(file);
    mkdirSync(file);
    const failed = await api.request(`${path}/draft`, { work: 'Unsaved replacement' }, 'PUT');
    assert.equal(failed.status, 500);
    assert.equal(typeof failed.data.error, 'string');
    assert.equal('stack' in failed.data, false);
    assert.equal((await api.request(`${path}/context`)).data.draft.work, work.work);
    rmSync(file, { recursive: true });
    writeFileSync(file, before);
    assert.equal(new TutorStore(file).getContext(a.id).draft?.work, work.work);
  } finally { await api.close(); rmSync(dir, { recursive: true, force: true }); }
});

test('persistent state survives a restart and corrupt state is not overwritten', () => {
  const dir = mkdtempSync(join(tmpdir(), 'supertutor-state-'));
  const file = join(dir, 'state.json');
  try {
    const first = new TutorStore(file);
    const a = first.createAssignment(assignment as Parameters<TutorStore['createAssignment']>[0]);
    first.recordAttempt(a.id, { work: 'Student work' });
    const second = new TutorStore(file);
    assert.equal(second.getContext(a.id).attempts.length, 1);
    writeFileSync(file, 'broken-json');
    assert.throws(() => new TutorStore(file));
    assert.equal(readFileSync(file, 'utf8'), 'broken-json');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
