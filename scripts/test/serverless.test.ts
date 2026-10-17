import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createServerlessHandler } from '../../apps/server/src/serverless.js';
import { TutorStore } from '../../packages/tutor-state.js';
import type { TransactionalStore } from '../../packages/postgres-state.js';
import { hashSecret } from '../../packages/auth.js';

class TestPersistence implements TransactionalStore {
  snapshot = new TutorStore().exportSnapshot();
  failCommit = false;
  private tail = Promise.resolve();
  run<T>(action: (store: TutorStore) => Promise<T>): Promise<T> {
    const result = this.tail.then(async () => {
      const store = TutorStore.fromSnapshot(this.snapshot);
      const value = await action(store);
      if (this.failCommit && store.hasChanges) { this.failCommit = false; throw new Error('Injected commit failure'); }
      this.snapshot = store.exportSnapshot();
      return value;
    });
    this.tail = result.then(() => undefined, () => undefined);
    return result;
  }
}
async function serve() {
  const persistence = new TestPersistence();
  const handler = createServerlessHandler(persistence);
  const server = createServer((req, res) => { void handler(req, res); });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  let cookie = '';
  const request = async (path: string, method = 'GET', body?: unknown) => {
    const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    if (response.headers.has('set-cookie')) cookie = response.headers.get('set-cookie')!.split(';')[0];
    return { response, data: await response.json() };
  };
  return { persistence, base, request, close: () => new Promise<void>(resolve => { server.closeAllConnections(); server.close(() => resolve()); }) };
}

test('fresh serverless stores preserve sessions, concurrent saves, and the Go MCP round trip', async () => {
  const app = await serve();
  try {
    const signup = await app.request('/api/auth/signup', 'POST', { email: 'cloud@example.edu', password: 'correct-horse-battery' });
    assert.equal(signup.response.status, 201);
    assert.match(signup.response.headers.get('set-cookie')!, /Secure/);
    const account = await app.request('/api/auth/me'); assert.equal(account.data.id, signup.data.id);
    const create = (title: string) => app.request('/api/assignments', 'POST', { title, subject: 'math', prompt: 'Explain your reasoning for distribution.' });
    const [first, second] = await Promise.all([create('First'), create('Second')]);
    assert.equal(first.response.status, 201); assert.equal(second.response.status, 201);
    await app.request(`/api/assignments/${first.data.id}/draft`, 'PUT', { work: '2(x + 3) = 2x + 6' });
    assert.equal((await app.request('/api/assignments')).data.assignments.length, 2);
    assert.equal((await app.request(`/api/assignments/${first.data.id}/context`)).data.draft.work, '2(x + 3) = 2x + 6');
    const issued = await app.request('/api/auth/connectors', 'POST', { label: 'Go cloud test' });
    const client = new Client({ name: 'cloud-go-test', version: '1.0.0' });
    try {
      await client.connect(new StreamableHTTPClientTransport(new URL(app.base + '/api/mcp'), { requestInit: { headers: { Authorization: `Bearer ${issued.data.secret}` } } }));
      assert.equal((await client.listTools()).tools.length, 9);
      const listed = await client.callTool({ name: 'list_assignments', arguments: {} });
      assert.ok(JSON.stringify(listed).includes(first.data.id));
      // Browser sessions and Go credentials are independent, across fresh function instances.
      const before = (await app.request('/api/auth/me')).data.connectors;
      assert.ok(before[0].lastUsedAt);
      await app.request('/api/auth/signout', 'POST', {});
      assert.equal((await app.request('/api/auth/me')).response.status, 401);
      assert.ok(JSON.stringify(await client.callTool({name:'list_assignments',arguments:{}})).includes(first.data.id), 'Go still works while the website is signed out');
      const signedIn = await app.request('/api/auth/signin', 'POST', {email:'cloud@example.edu',password:'correct-horse-battery'});
      assert.equal(signedIn.response.status, 200);
      assert.deepEqual(signedIn.data.connectors, before, 'signing in restores the existing connector without issuing or rotating a token');
      assert.ok(JSON.stringify(await client.callTool({name:'get_assignment_context',arguments:{assignmentId:first.data.id}})).includes('2x + 6'));
    } finally { await client.close(); }
    assert.equal((await app.request('/api/healthz')).data.modelCalls, false);
  } finally { await app.close(); }
});

test('a failed cloud commit sends neither success nor a session cookie and loses no previous state', async () => {
  const app = await serve();
  try {
    app.persistence.failCommit = true;
    const failed = await app.request('/api/auth/signup', 'POST', { email: 'retry@example.edu', password: 'correct-horse-battery' });
    assert.equal(failed.response.status, 503); assert.equal(failed.response.headers.has('set-cookie'), false);
    assert.equal(Object.keys(app.persistence.snapshot.users).length, 0);
    const saved = await app.request('/api/auth/signup', 'POST', { email: 'retry@example.edu', password: 'correct-horse-battery' });
    assert.equal(saved.response.status, 201);
    app.persistence.failCommit = true;
    assert.equal((await app.request('/api/assignments', 'POST', { title: 'Not saved', subject: 'writing', prompt: 'Write a thesis statement.' })).response.status, 503);
    assert.equal((await app.request('/api/assignments')).data.assignments.length, 0);
  } finally { await app.close(); }
});

test('browser-bound Canvas OAuth state survives a different serverless instance and is single-use', () => {
  const before = new TutorStore();
  before.beginCanvasOAuthFlow('state-secret', { institutionId: 'berkeley', nonceHash: hashSecret('browser-secret'), expires: Date.now() + 60_000, ownerId: null });
  const after = TutorStore.fromSnapshot(before.exportSnapshot());
  assert.throws(() => after.consumeCanvasOAuthFlow('state-secret', 'wrong-browser'), /could not be verified/);
  assert.equal(after.consumeCanvasOAuthFlow('state-secret', 'browser-secret').institutionId, 'berkeley');
  const again = TutorStore.fromSnapshot(after.exportSnapshot());
  assert.throws(() => again.consumeCanvasOAuthFlow('state-secret', 'browser-secret'), /could not be verified/);
});

test('sign-in attempt limits survive fresh serverless instances', () => {
  let store = new TutorStore();
  for (let i = 0; i < 10; i++) {
    store.limitAuthentication('203.0.113.7|student@example.edu');
    store = TutorStore.fromSnapshot(store.exportSnapshot());
  }
  assert.throws(() => store.limitAuthentication('203.0.113.7|student@example.edu'), /Too many attempts/);
  assert.doesNotThrow(() => store.limitAuthentication('203.0.113.8|another@example.edu'));
});
