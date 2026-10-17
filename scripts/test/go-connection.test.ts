import assert from 'node:assert/strict';
import test from 'node:test';
import { goConnection, shouldOfferGoSetup } from '../../apps/web/src/lib/go-connection.js';

const token = {id:'saved-token', label:'Go', createdAt:1, expiresAt:1000, lastUsedAt:50};
test('a saved connection suppresses repeated setup even when browser confirmation is missing', () => {
  const state = goConnection({connectors:[token]}, 100);
  assert.equal(state.linked, true);
  assert.equal(shouldOfferGoSetup(true, false, state.linked), false);
  assert.equal(shouldOfferGoSetup(false, false, state.linked), true, 'an unsupported browser still gets compatibility guidance');
  assert.equal(shouldOfferGoSetup(true, false, goConnection(null,100).linked), true, 'connection state is scoped to the signed-in account');
});
test('an unused or expired token does not claim a successful connection', () => {
  assert.deepEqual(goConnection({connectors:[{...token,lastUsedAt:null}]},100), {linked:false,pending:true,expired:false});
  assert.deepEqual(goConnection({connectors:[token]},1000), {linked:false,pending:false,expired:true});
  assert.equal(goConnection({connectors:[token,{...token,id:'other',expiresAt:2000,lastUsedAt:null}]},1000).linked, false);
});
