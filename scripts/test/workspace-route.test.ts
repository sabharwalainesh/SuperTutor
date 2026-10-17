import assert from 'node:assert/strict';
import test from 'node:test';
import { workspaceRoute, assignmentStarter } from '../../apps/web/src/lib/workspace-route.js';

test('question URLs retain an explicit assignment while legacy workspace URLs still work', () => {
  const id = '12345678-1234-4123-8123-123456789012';
  assert.deepEqual(workspaceRoute(`#work/${id}`), {view:'work', assignmentId:id});
  assert.deepEqual(workspaceRoute('#work'), {view:'work', assignmentId:null});
  assert.deepEqual(workspaceRoute('#work/not-a-question'), {view:'work', assignmentId:null});
  assert.deepEqual(workspaceRoute(`#connect/${id}`), {view:'connect', assignmentId:null});
  assert.deepEqual(workspaceRoute('#unknown'), {view:'home', assignmentId:null});
  assert.match(assignmentStarter(id, 'Distribution'), new RegExp(id));
});
