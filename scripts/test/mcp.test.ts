import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createApiApp } from '../../apps/api/src/app.js';
import { TutorStore } from '../../packages/tutor-state.js';
import { createMcpApp } from '../mcp/server.js';
const url = (server: Server) => `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
const close = (server: Server) => new Promise<void>((resolve) => { server.closeAllConnections(); server.close(() => resolve()); });

test('real MCP SDK client can read work and save Go-shaped feedback through authenticated HTTP', async () => {
  const store = new TutorStore();
  const assignment = store.createAssignment({ title: 'Algebra', subject: 'math', prompt: 'Explain each step when simplifying an expression.' });
  store.saveDraft(assignment.id, { work: '2(x + 3) = 2x + 3' });
  const api = createApiApp(store).listen(0, '127.0.0.1');
  await once(api, 'listening');
  const token = 'local-integration-test-token-1234567890';
  const bridge = createMcpApp({ token, apiBaseUrl: url(api) }).listen(0, '127.0.0.1');
  await once(bridge, 'listening');
  const client = new Client({ name: 'supertutor-test', version: '1.0.0' });
  try {
    for (const headers of [{}, { Authorization: 'Bearer incorrect' }] as Record<string, string>[]) {
      const response = await fetch(`${url(bridge)}/mcp`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: '{}' });
      assert.equal(response.status, 401);
    }
    await client.connect(new StreamableHTTPClientTransport(new URL(`${url(bridge)}/mcp`), { requestInit: { headers: { Authorization: `Bearer ${token}` } } }));
    const { tools } = await client.listTools();
    assert.equal(tools.length, 6);
    assert.equal(tools.find((t) => t.name === 'get_assignment_context')?.annotations?.readOnlyHint, true);
    assert.equal(tools.find((t) => t.name === 'record_feedback')?.annotations?.readOnlyHint, false);
    const listed = await client.callTool({ name: 'list_assignments', arguments: {} });
    assert.ok(JSON.stringify(listed).includes(assignment.id));
    const context = await client.callTool({ name: 'get_assignment_context', arguments: { assignmentId: assignment.id } });
    assert.ok(JSON.stringify(context).includes('2x + 3'));
    const result = await client.callTool({ name: 'record_attempt', arguments: { assignmentId: assignment.id, work: '2(x + 3) = 2x + 3' } });
    const attempt = result.structuredContent as { id: string };
    assert.ok(attempt.id);
    const feedback = { attemptId: attempt.id, assessment: 'developing', explanation: 'You multiplied the x term. Check whether the constant receives the same factor.', nextStep: 'Which terms are inside the parentheses?', missedConcepts: ['Distribution'], hintLevel: 0 };
    const saved = await client.callTool({ name: 'record_feedback', arguments: { assignmentId: assignment.id, feedback } });
    assert.notEqual(saved.isError, true);
    await client.callTool({ name: 'record_feedback', arguments: { assignmentId: assignment.id, feedback } });
    const progress = await client.callTool({ name: 'get_progress', arguments: { assignmentId: assignment.id } });
    assert.equal((progress.structuredContent as { reviewedAttempts: number }).reviewedAttempts, 1);
    assert.equal(store.getContext(assignment.id).feedback[0].author, 'go-agent');
    const rejected = await client.callTool({ name: 'record_attempt', arguments: { assignmentId: assignment.id, work: '  ' } });
    assert.equal(rejected.isError, true);
    const material = await client.callTool({ name: 'add_material', arguments: { assignmentId: assignment.id, title: 'Lecture excerpt', text: 'Distribute a factor across each term in a sum.', sourceUrl: 'https://example.edu/lecture' } });
    assert.notEqual(material.isError, true);
    assert.equal(store.getContext(assignment.id).assignment.materials.length, 1);
  } finally { await client.close(); await close(bridge); await close(api); }
});

test('bridge refuses a missing/weak credential', () => {
  assert.throws(() => createMcpApp({ token: '', apiBaseUrl: 'http://127.0.0.1:8787' }), /MCP_BEARER_TOKEN/);
});
