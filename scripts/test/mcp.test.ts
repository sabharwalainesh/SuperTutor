import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import express from 'express';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { TutorStore } from '../../packages/tutor-state.js';
import { createMcpRouter } from '../mcp/server.js';

const url = (server: Server) => `http://127.0.0.1:${(server.address() as AddressInfo).port}/mcp`;
const close = (server: Server) => new Promise<void>((resolve) => { server.closeAllConnections(); server.close(() => resolve()); });
const serveMcp = async (store: TutorStore) => {
  const app = express();
  app.use('/mcp', createMcpRouter(store));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return server;
};
const account = async (store: TutorStore, email: string) => {
  const { account: created } = await store.createAccount({ email, password: 'correct-horse-battery' });
  return { id: created.id, secret: store.issueConnectorToken(created.id, 'Go').secret };
};

test('a real MCP SDK client reads work and saves Go-shaped feedback with a student connector token', async () => {
  const store = new TutorStore();
  const student = await account(store, 'mcp-student@example.edu');
  const assignment = store.createAssignment(student.id, { title: 'Algebra', subject: 'math', prompt: 'Explain each step when simplifying an expression.' });
  store.saveDraft(student.id, assignment.id, { work: '2(x + 3) = 2x + 3' });
  const bridge = await serveMcp(store);
  const client = new Client({ name: 'supertutor-test', version: '1.0.0' });
  try {
    for (const headers of [{}, { Authorization: 'Bearer incorrect' }, { Authorization: `Bearer st_${'a'.repeat(43)}` }] as Record<string, string>[]) {
      const response = await fetch(url(bridge), { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: '{}' });
      assert.equal(response.status, 401);
      assert.match(response.headers.get('www-authenticate') ?? '', /Bearer/);
    }
    await client.connect(new StreamableHTTPClientTransport(new URL(url(bridge)), { requestInit: { headers: { Authorization: `Bearer ${student.secret}` } } }));
    const { tools } = await client.listTools();
    assert.equal(tools.length, 9);
    assert.equal(tools.find((t) => t.name === 'get_assignment_context')?.annotations?.readOnlyHint, true);
    assert.equal(tools.find((t) => t.name === 'record_feedback')?.annotations?.readOnlyHint, false);
    const listed = await client.callTool({ name: 'list_assignments', arguments: {} });
    assert.ok(JSON.stringify(listed).includes(assignment.id));
    const context = await client.callTool({ name: 'get_assignment_context', arguments: { assignmentId: assignment.id } });
    assert.ok(JSON.stringify(context).includes('2x + 3'));
    assert.equal((await client.callTool({name:'get_assignment_context', arguments:{}})).isError, true, 'no open question must not select an arbitrary assignment');
    store.setActiveAssignment(student.id, assignment.id);
    const automatic = await client.callTool({name:'get_assignment_context', arguments:{}});
    assert.equal(automatic.isError, undefined);
    assert.equal((automatic.structuredContent as {assignment:{id:string}}).assignment.id, assignment.id);
    const activeList = await client.callTool({name:'list_assignments', arguments:{}});
    assert.equal((activeList.structuredContent as {activeAssignment:{assignmentId:string}}).activeAssignment.assignmentId, assignment.id);
    const result = await client.callTool({ name: 'record_attempt', arguments: { assignmentId: assignment.id, work: '2(x + 3) = 2x + 3' } });
    const attempt = result.structuredContent as { id: string };
    assert.ok(attempt.id);
    const feedback = { attemptId: attempt.id, assessment: 'developing', explanation: 'You multiplied the x term. Check whether the constant receives the same factor.', nextStep: 'Which terms are inside the parentheses?', missedConcepts: ['Distribution'], hintLevel: 0 };
    const saved = await client.callTool({ name: 'record_feedback', arguments: { assignmentId: assignment.id, feedback } });
    assert.notEqual(saved.isError, true);
    await client.callTool({ name: 'record_feedback', arguments: { assignmentId: assignment.id, feedback } });
    const progress = await client.callTool({ name: 'get_progress', arguments: { assignmentId: assignment.id } });
    assert.equal((progress.structuredContent as { reviewedAttempts: number }).reviewedAttempts, 1);
    assert.equal(store.getContext(student.id, assignment.id).feedback[0].author, 'go-agent');
    const rejected = await client.callTool({ name: 'record_attempt', arguments: { assignmentId: assignment.id, work: '  ' } });
    assert.equal(rejected.isError, true);
    const material = await client.callTool({ name: 'add_material', arguments: { assignmentId: assignment.id, title: 'Lecture excerpt', text: 'Distribute a factor across each term in a sum.', sourceUrl: 'https://example.edu/lecture' } });
    assert.notEqual(material.isError, true);
    assert.equal(store.getContext(student.id, assignment.id).assignment.materials.length, 1);
  } finally { await client.close(); await close(bridge); }
});

test('a connector token reaches only its own student\'s assignments', async () => {
  const store = new TutorStore();
  const mine = await account(store, 'owner@example.edu');
  const other = await account(store, 'other@example.edu');
  const hidden = store.createAssignment(other.id, { title: 'Their essay', subject: 'writing', prompt: 'Draft a thesis statement.' });
  const visible = store.createAssignment(mine.id, { title: 'My essay', subject: 'writing', prompt: 'Draft a thesis statement.' });
  const bridge = await serveMcp(store);
  const client = new Client({ name: 'supertutor-tenancy-test', version: '1.0.0' });
  try {
    await client.connect(new StreamableHTTPClientTransport(new URL(url(bridge)), { requestInit: { headers: { Authorization: `Bearer ${mine.secret}` } } }));
    const listed = JSON.stringify(await client.callTool({ name: 'list_assignments', arguments: {} }));
    assert.ok(listed.includes(visible.id));
    assert.equal(listed.includes(hidden.id), false, 'another student\'s assignment is never listed');
    // Naming the id directly must not work either.
    for (const name of ['get_assignment_context', 'get_progress'] as const) {
      const denied = await client.callTool({ name, arguments: { assignmentId: hidden.id } });
      assert.equal(denied.isError, true);
    }
    const write = await client.callTool({ name: 'record_attempt', arguments: { assignmentId: hidden.id, work: 'An attempt on work that is not mine' } });
    assert.equal(write.isError, true);
    assert.equal(store.getContext(other.id, hidden.id).attempts.length, 0);
  } finally { await client.close(); await close(bridge); }
});

test('the bridge answers non-POST methods without starting a session', async () => {
  const store = new TutorStore();
  const bridge = await serveMcp(store);
  try {
    const response = await fetch(url(bridge), { method: 'GET' });
    assert.equal(response.status, 405);
    assert.equal(response.headers.get('allow'), 'POST');
    assert.equal(store.resolveConnectorToken(`st_${randomUUID().replace(/-/g, '')}0000000`), null);
  } finally { await close(bridge); }
});

test('Go reads a study source, saves a lesson, and reviews the current submitted answer',async()=>{
  const {SAMPLE_LESSON,SAMPLE_SOURCE}=await import('../../packages/learning-fixtures.js');
  const store=new TutorStore();const student=await account(store,'study-mcp@example.edu');
  const study=store.startStudySession(student.id,{text:SAMPLE_SOURCE,count:3});
  const bridge=await serveMcp(store);const client=new Client({name:'study-tools-test',version:'1.0.0'});
  try{
    await client.connect(new StreamableHTTPClientTransport(new URL(url(bridge)),{requestInit:{headers:{Authorization:`Bearer ${student.secret}`}}}));
    const read=await client.callTool({name:'get_study_session',arguments:{}});assert.ok(JSON.stringify(read).includes(SAMPLE_SOURCE));
    const saved=await client.callTool({name:'record_study_lesson',arguments:{sessionId:study.id,lesson:SAMPLE_LESSON}});assert.notEqual(saved.isError,true);
    const questionId=SAMPLE_LESSON.questions[0].id;
    const submitted=store.submitPracticeAnswer(student.id,{sessionId:study.id,questionId,answer:'The condition checks if the loop runs.'});
    const feedback={questionId,score:40,verdict:'partial',explanation:'Include how the state changes.',improvedAnswer:'The loop state must change so its condition eventually becomes false.',missedTopics:['Termination']};
    const reviewed=await client.callTool({name:'record_practice_feedback',arguments:{sessionId:study.id,answerRevision:submitted.answerRevisions[questionId],feedback}});assert.notEqual(reviewed.isError,true);assert.equal(store.getStudySession(student.id)?.feedback[questionId].score,40);
    store.submitPracticeAnswer(student.id,{sessionId:study.id,questionId,answer:'Update the state so the loop eventually stops.'});
    const stale=await client.callTool({name:'record_practice_feedback',arguments:{sessionId:study.id,answerRevision:submitted.answerRevisions[questionId],feedback}});assert.equal(stale.isError,true);
  }finally{await client.close();await close(bridge);}
});
