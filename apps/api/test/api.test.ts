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
const password = 'correct-horse-battery';

test('the website shares only its signed-in owner’s open question', async () => {
  const api = await serve();
  try {
    assert.equal((await api.request('/api/workspace/active', {assignmentId: randomUUID()}, 'PUT')).status, 401);
    const first = await api.account();
    const {data: a} = await api.request('/api/assignments', assignment);
    assert.equal((await api.request('/api/workspace/active', {assignmentId: 'not-an-id'}, 'PUT')).status, 400);
    assert.equal((await api.request('/api/workspace/active', {assignmentId: a.id}, 'PUT')).status, 200);
    assert.equal(api.store.getOpenAssignmentContext(first.id).assignment.id, a.id);
    await api.request('/api/auth/signout', {});
    const second = await api.account();
    assert.equal((await api.request('/api/workspace/active', {assignmentId: a.id}, 'PUT')).status, 404);
    assert.equal(api.store.getActiveAssignment(second.id), null);
    const snapshot = api.store.exportSnapshot();
    assert.equal(TutorStore.fromSnapshot(snapshot).getOpenAssignmentContext(first.id).assignment.id, a.id);
    snapshot.users[first.id].activeAssignment!.updatedAt = Date.now() - 16 * 60_000;
    assert.equal(TutorStore.fromSnapshot(snapshot).getActiveAssignment(first.id), null);
    assert.throws(() => TutorStore.fromSnapshot(snapshot).getOpenAssignmentContext(first.id), /No recently open assignment/);
  } finally { await api.close(); }
});

const serve = async (store = new TutorStore()) => {
  const server = createApiApp(store).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  let cookie = '';
  const call = async (path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST', headers: Record<string, string> = {}) => {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const setCookie = res.headers.getSetCookie?.()[0];
    if (setCookie) cookie = setCookie.split(';')[0];
    return { status: res.status, data: await res.json(), setCookie };
  };
  /** Most tests need one signed-in student; the session cookie is then reused automatically. */
  const account = async (email = `student-${randomUUID()}@example.edu`) => (await call('/api/auth/signup', { email, password })).data;
  return {
    store, base, request: call, account, signedOut: () => { cookie = ''; }, cookie: () => cookie,
    close: () => new Promise<void>((resolve) => { server.closeAllConnections(); server.close(() => resolve()); }),
  };
};
/** Create an owner directly for tests that exercise the store rather than HTTP. */
const owner = async (store: TutorStore) => (await store.createAccount({ email: `direct-${randomUUID()}@example.edu`, password })).account.id;

test('student work, attempt history, feedback corrections, and progress share one state', async () => {
  const api = await serve();
  try {
    assert.equal((await api.request('/api/health')).data.modelCalls, false);
    await api.account();
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

test('an account is required, and one student never sees another student\'s work', async () => {
  const api = await serve();
  try {
    // Nothing is readable before signing in.
    for (const path of ['/api/assignments', `/api/assignments/${randomUUID()}/context`]) {
      assert.equal((await api.request(path)).status, 401);
    }
    const first = await api.account('first@example.edu');
    assert.equal(first.connectors.length, 0);
    assert.equal('passwordHash' in first, false, 'the browser never receives a password hash');
    const { data: mine } = await api.request('/api/assignments', assignment);
    assert.equal((await api.request('/api/auth/me')).data.email, 'first@example.edu');

    // A second account is a separate tenant: the other student's id reads as missing, not forbidden.
    await api.request('/api/auth/signout', {});
    await api.account('second@example.edu');
    assert.deepEqual((await api.request('/api/assignments')).data.assignments, []);
    assert.equal((await api.request(`/api/assignments/${mine.id}/context`)).status, 404);
    assert.equal((await api.request(`/api/assignments/${mine.id}/draft`, { work: 'overwrite' }, 'PUT')).status, 404);
    assert.equal((await api.request(`/api/assignments/${mine.id}/attempts`, { work: 'not mine' })).status, 404);
    // The store enforces this too, not only the route layer.
    const second = (await api.request('/api/auth/me')).data;
    assert.throws(() => api.store.getContext(second.id, mine.id), /not found/i);
  } finally { await api.close(); }
});

test('sign-in, sign-out, and duplicate accounts behave predictably', async () => {
  const api = await serve();
  try {
    await api.account('student@example.edu');
    assert.equal((await api.request('/api/auth/signup', { email: 'student@example.edu', password })).status, 409);
    assert.equal((await api.request('/api/auth/signup', { email: 'short@example.edu', password: 'tiny' })).status, 400);
    const signedOut = await api.request('/api/auth/signout', {});
    assert.equal(signedOut.status, 200);
    api.signedOut();
    assert.equal((await api.request('/api/auth/me')).status, 401);
    assert.equal((await api.request('/api/auth/signin', { email: 'student@example.edu', password: 'wrong-password-entirely' })).status, 401);
    // Case and surrounding whitespace in the email must not create a second account.
    const back = await api.request('/api/auth/signin', { email: '  Student@Example.edu  ', password });
    assert.equal(back.status, 200);
    assert.match(back.setCookie ?? '', /HttpOnly/i);
    assert.match(back.setCookie ?? '', /SameSite=Lax/i);
    assert.equal((await api.request('/api/auth/me')).data.email, 'student@example.edu');
  } finally { await api.close(); }
});

test('connector tokens are shown once, scoped to the account, and revocable', async () => {
  const api = await serve();
  try {
    await api.account();
    const created = await api.request('/api/auth/connectors', { label: 'Go on my laptop' });
    assert.equal(created.status, 201);
    assert.match(created.data.secret, /^st_[A-Za-z0-9_-]{43}$/);
    assert.equal(created.data.token.label, 'Go on my laptop');
    assert.equal('hash' in created.data.token, false, 'only the hash is stored, and it is never returned');
    const listed = await api.request('/api/auth/me');
    assert.equal(listed.data.connectors.length, 1);
    assert.equal(JSON.stringify(listed.data).includes(created.data.secret), false, 'the secret cannot be read back');
    const revoked = await api.request(`/api/auth/connectors/${created.data.token.id}`, undefined, 'DELETE');
    assert.equal(revoked.status, 200);
    assert.deepEqual(revoked.data.connectors, []);
    assert.equal((await api.request(`/api/auth/connectors/${created.data.token.id}`, undefined, 'DELETE')).status, 404);
    assert.equal(api.store.resolveConnectorToken(created.data.secret), null, 'a revoked token stops working');
  } finally { await api.close(); }
});

test('rejects invalid input and cross-assignment feedback with readable errors', async () => {
  const api = await serve();
  try {
    await api.account();
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
    assert.equal((await api.request('/api/lesson', { text: 'Too short' })).status, 400);
  } finally { await api.close(); }
});

test('malformed and oversized bodies always return JSON, not stack traces', async () => {
  const api = await serve();
  try {
    await api.account();
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
    await api.account();
    const cases = [
      { path: '/api/assignments', headers: { 'Content-Type': 'application/json; charset=invalid' }, body: '{}', status: 415 },
      { path: '/api/assignments', headers: { 'Content-Type': 'application/json', 'Content-Encoding': 'invalid' }, body: '{}', status: 415 },
      { path: '/api/assignments/%E0%A4%A/context', status: 400 },
    ];
    for (const item of cases) {
      const response = await fetch(`${api.base}${item.path}`, {
        method: item.body === undefined ? 'GET' : 'POST',
        headers: { ...item.headers, cookie: api.cookie() },
        body: item.body,
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
  const email = 'restart@example.edu';
  try {
    await api.account(email);
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
    // A restart must also keep the account and its live session usable.
    api = await serve(new TutorStore(file));
    assert.equal((await api.request('/api/auth/signin', { email, password })).status, 200);
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
    const account = await api.account();
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
    assert.equal(new TutorStore(file).getContext(account.id, a.id).draft?.work, work.work);
  } finally { await api.close(); rmSync(dir, { recursive: true, force: true }); }
});

test('persistent state survives a restart and corrupt state is not overwritten', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'supertutor-state-'));
  const file = join(dir, 'state.json');
  try {
    const first = new TutorStore(file);
    const ownerId = await owner(first);
    const a = first.createAssignment(ownerId, assignment as Parameters<TutorStore['createAssignment']>[1]);
    first.recordAttempt(ownerId, a.id, { work: 'Student work' });
    const second = new TutorStore(file);
    assert.equal(second.getContext(ownerId, a.id).attempts.length, 1);
    writeFileSync(file, 'broken-json');
    assert.throws(() => new TutorStore(file));
    assert.equal(readFileSync(file, 'utf8'), 'broken-json');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('a version 2 state file keeps its work, and the first account claims it', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'supertutor-migrate-'));
  const file = join(dir, 'state.json');
  try {
    const assignmentId = randomUUID();
    const legacy = {
      version: 2,
      records: {
        [assignmentId]: {
          assignment: { ...assignment, id: assignmentId, materials: [], createdAt: 1 },
          draft: { work: 'Work saved before accounts existed', updatedAt: 2 },
          attempts: [], feedback: [],
        },
      },
    };
    writeFileSync(file, JSON.stringify(legacy));
    const store = new TutorStore(file);
    const claimer = await owner(store);
    assert.equal(store.listAssignments(claimer).length, 1);
    assert.equal(store.getContext(claimer, assignmentId).draft?.work, 'Work saved before accounts existed');
    // A later account gets a clean workspace rather than the first student's work.
    const second = await owner(store);
    assert.deepEqual(store.listAssignments(second), []);
    assert.equal(JSON.parse(readFileSync(file, 'utf8')).version, 3);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
