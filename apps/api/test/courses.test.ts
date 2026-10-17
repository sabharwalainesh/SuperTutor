import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import { canvasHtmlToText, normalizeCanvasBaseUrl, assertPublicHost, CanvasError } from '../../../packages/canvas.js';
import type { CanvasClient } from '../../../packages/courses.js';
import { TutorStore } from '../../../packages/tutor-state.js';
import { createApiApp } from '../src/app.js';

const password = 'correct-horse-battery';
const CANVAS_TOKEN = 'canvas-personal-access-token-0001';
const CANVAS_HOST = 'https://canvas.example.edu';
const ASSIGNMENT = {
  id: 42,
  name: 'Loops and termination',
  description: '<p>Write <b>sum_to(n)</b>.</p><ul><li>Explain why it ends</li></ul><script>alert(1)</script>',
  htmlUrl: 'https://canvas.example.edu/courses/7/assignments/42',
  dueAt: '2026-11-01T06:59:00Z',
  pointsPossible: 10,
};

/**
 * Stands in for Canvas itself. The real client's SSRF guard and URL handling are unit-tested
 * below against actual hostnames, so this fake never has to weaken them.
 */
const fakeCanvas: CanvasClient = {
  normalizeBaseUrl: normalizeCanvasBaseUrl,
  identity: async (_baseUrl, token) => {
    if (token !== CANVAS_TOKEN) throw new CanvasError(401, 'Canvas rejected that access token. Generate a new one in Canvas under Account → Settings.');
    return 'Dana Student';
  },
  courses: async () => [{ id: 7, name: 'Intro to Computing', courseCode: 'CS 61A' }],
  assignments: async (_baseUrl, _token, courseId) => (courseId === 7 ? [ASSIGNMENT] : []),
  assignment: async (_baseUrl, _token, courseId, assignmentId) => {
    if (courseId !== 7 || assignmentId !== ASSIGNMENT.id) throw new CanvasError(404, 'That assignment is no longer listed in Canvas.');
    return ASSIGNMENT;
  },
};

const serve = async (store = new TutorStore()) => {
  const server = createApiApp(store, { deployment: { connectorListingUrl: null }, canvasClient: fakeCanvas }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  let cookie = '';
  const request = async (path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST') => {
    const res = await fetch(`${base}${path}`, {
      method, headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const setCookie = res.headers.getSetCookie?.()[0];
    if (setCookie) cookie = setCookie.split(';')[0];
    return { status: res.status, data: await res.json() };
  };
  await request('/api/auth/signup', { email: `courses-${randomUUID()}@example.edu`, password });
  return { store, request, close: () => new Promise<void>((resolve) => { server.closeAllConnections(); server.close(() => resolve()); }) };
};

test('course sources are listed with their real status and require an account', async () => {
  const api = await serve();
  try {
    const { data } = await api.request('/api/courses/sources');
    const byId = Object.fromEntries(data.sources.map((source: { id: string; status: string }) => [source.id, source.status]));
    assert.equal(byId.canvas, 'available');
    assert.equal(byId['lecture-video'], 'manual-only', 'a video link is never presented as imported content');
    assert.equal(byId.repository, 'not-implemented');
    assert.equal(data.canvas, null);
  } finally { await api.close(); }
});

test('the deployment config reports links without implying a connection', async () => {
  const api = await serve();
  try {
    const { data } = await api.request('/api/config');
    assert.match(data.mcpEndpoint, /\/mcp$/);
    assert.equal(data.connectorPublished, false, 'no listing URL configured means nothing to install yet');
    assert.equal(data.connectorListingUrl, null);
    assert.match(data.agentDirectoryUrl, /^https:\/\//);
  } finally { await api.close(); }
});

test('Canvas connects with the student\'s own token, imports an assignment, and disconnects', async () => {
  const api = await serve();
  try {
    // A wrong token must not be saved as a connection.
    const rejected = await api.request('/api/courses/canvas', { baseUrl: CANVAS_HOST, token: 'not-the-right-token-aaaaaaaa' }, 'PUT');
    assert.equal(rejected.status, 401);
    assert.equal((await api.request('/api/courses/sources')).data.canvas, null);

    const connected = await api.request('/api/courses/canvas', { baseUrl: CANVAS_HOST, token: CANVAS_TOKEN }, 'PUT');
    assert.equal(connected.status, 200);
    assert.equal(connected.data.userName, 'Dana Student');
    assert.equal('token' in connected.data, false, 'the stored Canvas token is never returned');

    const courses = await api.request('/api/courses/canvas/courses');
    assert.deepEqual(courses.data.courses, [{ id: 7, name: 'Intro to Computing', courseCode: 'CS 61A' }]);
    const assignments = await api.request('/api/courses/canvas/courses/7/assignments');
    assert.equal(assignments.data.assignments[0].name, 'Loops and termination');
    assert.equal((await api.request('/api/courses/canvas/courses/9/assignments')).data.assignments.length, 0);
    assert.equal((await api.request('/api/courses/canvas/courses/0/assignments')).status, 400);

    const imported = await api.request('/api/courses/canvas/import', { courseId: 7, assignmentId: 42, subject: 'coding' });
    assert.equal(imported.status, 201);
    assert.equal(imported.data.title, 'Loops and termination');
    assert.match(imported.data.prompt, /Write sum_to\(n\)/, 'instructions arrive as text, not HTML');
    assert.equal(imported.data.prompt.includes('<'), false, 'markup never reaches the editor or the tutor');
    assert.equal(imported.data.prompt.includes('alert(1)'), false, 'scripts in instructor HTML are dropped');
    assert.match(imported.data.prompt, /Due /);
    assert.equal(imported.data.materials[0].sourceUrl, 'https://canvas.example.edu/courses/7/assignments/42', 'provenance is kept');
    assert.equal((await api.request('/api/courses/canvas/import', { courseId: 7, assignmentId: 999, subject: 'coding' })).status, 404);

    assert.equal((await api.request('/api/courses/canvas', undefined, 'DELETE')).status, 200);
    assert.equal((await api.request('/api/courses/sources')).data.canvas, null);
    // With no connection, an import must fail rather than fall back to anything.
    assert.equal((await api.request('/api/courses/canvas/import', { courseId: 7, assignmentId: 42, subject: 'coding' })).status, 409);
  } finally { await api.close(); }
});

test('Canvas requests refuse private and non-HTTPS addresses', async () => {
  for (const hostname of ['127.0.0.1', '10.0.0.5', '169.254.169.254', '::1', '192.168.1.1']) {
    await assert.rejects(() => assertPublicHost(hostname), CanvasError, `${hostname} must be refused`);
  }
  assert.throws(() => normalizeCanvasBaseUrl('http://canvas.example.edu'), /HTTPS/);
  assert.throws(() => normalizeCanvasBaseUrl('not a url'), /Canvas/);
  // A pasted course URL is reduced to its origin.
  assert.equal(normalizeCanvasBaseUrl('canvas.instructure.com'), 'https://canvas.instructure.com');
  assert.equal(normalizeCanvasBaseUrl('https://canvas.example.edu/courses/7/assignments/42'), 'https://canvas.example.edu');
});

test('instructor HTML becomes readable text', () => {
  assert.equal(canvasHtmlToText('<p>Step one.</p><p>Step two.</p>'), 'Step one.\nStep two.');
  assert.equal(canvasHtmlToText('<ul><li>First</li><li>Second</li></ul>'), '• First\n• Second');
  assert.equal(canvasHtmlToText('5 &lt; 10 &amp;&amp; x &gt; 2'), '5 < 10 && x > 2');
  assert.equal(canvasHtmlToText('<style>p{color:red}</style><p>Only this.</p>'), 'Only this.');
});
