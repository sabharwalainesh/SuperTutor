import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApiApp } from '../src/app.js';
import { TutorStore } from '../../../packages/tutor-state.js';
import { CanvasError } from '../../../packages/canvas.js';
import { createCanvasCredentialResolver, loadCanvasOAuthInstitutions, type CanvasOAuthClient } from '../../../packages/canvas-oauth.js';
import type { CanvasClient } from '../../../packages/courses.js';
const institutions=loadCanvasOAuthInstitutions({CANVAS_OAUTH_INSTITUTIONS:JSON.stringify([
 {id:'berkeley',name:'UC Berkeley / bCourses',baseUrl:'https://bcourses.berkeley.edu',clientId:'client-1',clientSecret:'secret-1',redirectUri:'http://localhost:5173/api/auth/canvas/callback'},
 {id:'another-school',name:'Another University',baseUrl:'https://canvas.example.edu',clientId:'client-2',clientSecret:'secret-2',redirectUri:'http://localhost:5173/api/auth/canvas/callback'},
])});
const token=(access='oauth-access-token')=>({access_token:access,refresh_token:'oauth-refresh-token',token_type:'Bearer',expires_in:3600,user:{id:7,name:'Dana Student'}});
const fakeCanvas:CanvasClient={normalizeBaseUrl:value=>value,identity:async()=> 'Dana Student',courses:async(_base,access)=>{assert.match(access,/oauth/);return[{id:3,name:'Algorithms',courseCode:'CS'}];},assignments:async()=>[],assignment:async()=>{throw new CanvasError(404,'Missing');}};
async function serve(){
 const store=new TutorStore();let exchanges=0;
 const client:CanvasOAuthClient={exchange:async(institution,code)=>{exchanges++;assert.ok(institutions.includes(institution));if(code==='failure')throw new CanvasError(502,'Canvas could not authorize this connection.');return token();},refresh:async()=>token('oauth-refreshed')};
 const app=createApiApp(store,{canvasOAuthInstitutions:institutions,canvasOAuthClient:client,canvasClient:fakeCanvas});const server=app.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
 const cookies=new Map<string,string>();
 const request=async(path:string,body?:unknown)=>{
  const response=await fetch(base+path,{method:body===undefined?'GET':'POST',redirect:'manual',headers:{'Content-Type':'application/json',cookie:[...cookies].map(([name,value])=>`${name}=${value}`).join('; ')},body:body===undefined?undefined:JSON.stringify(body)});
  for(const item of response.headers.getSetCookie()){const [name,value]=item.split(';')[0].split('=');if(value)cookies.set(name,value);else cookies.delete(name);}
  return {status:response.status,location:response.headers.get('location'),data:response.headers.get('content-type')?.includes('application/json')?await response.json():null};
 };
 const start=async(id='berkeley',intent='signin')=>{const response=await request(`/api/auth/canvas/start?institution=${id}&intent=${intent}`);assert.equal(response.status,302);return new URL(response.location!);};
 const complete=(url:URL,code='ok')=>request(`/api/auth/canvas/callback?${new URLSearchParams({code,state:url.searchParams.get('state')!})}`);
 return {store,request,start,complete,cookies,exchanges:()=>exchanges,close:()=>new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()))};
}
test('Canvas sign-in creates a session, connects Canvas, and exposes no credentials',async()=>{
 const api=await serve();try{
  const config=await api.request('/api/config');assert.equal(config.data.canvasOAuth.institutions.filter((i:{enabled:boolean})=>i.enabled).length,2);assert.equal(JSON.stringify(config.data).includes('secret-1'),false);
  const authorization=await api.start();assert.equal(authorization.origin,'https://bcourses.berkeley.edu');assert.equal(authorization.searchParams.get('client_id'),'client-1');assert.match(authorization.searchParams.get('scope')!,/url:GET/);assert.equal(authorization.searchParams.has('client_secret'),false);
  assert.equal((await api.complete(authorization)).status,302);
  const account=(await api.request('/api/auth/me')).data;assert.equal(account.displayName,'Dana Student');assert.equal(JSON.stringify(account).includes('oauth-access-token'),false);
  const connection=(await api.request('/api/courses/sources')).data.canvas;assert.equal(connection.userName,'Dana Student');assert.equal('token' in connection,false);assert.equal('oauth' in connection,false);
  assert.equal((await api.request('/api/courses/canvas/courses')).data.courses[0].name,'Algorithms');
  const again=await api.start();await api.complete(again);assert.equal((await api.request('/api/auth/me')).data.id,account.id);
  const otherSchool=await api.start('another-school');await api.complete(otherSchool);assert.notEqual((await api.request('/api/auth/me')).data.id,account.id,'equal Canvas user IDs in different schools are distinct accounts');
 }finally{await api.close();}
});
test('callbacks reject wrong state, missing browser binding, replay, and cancellation',async()=>{
 const api=await serve();try{
  const authorization=await api.start();assert.equal((await api.request('/api/auth/canvas/callback?code=ok&state=wrong')).status,400);assert.equal(api.exchanges(),0);
  const nonce=api.cookies.get('supertutor_canvas_oauth')!;api.cookies.delete('supertutor_canvas_oauth');assert.equal((await api.complete(authorization)).status,400);api.cookies.set('supertutor_canvas_oauth',nonce);
  await api.complete(authorization);assert.equal((await api.complete(authorization)).status,400);assert.equal(api.exchanges(),1);
  const canceled=await api.start();const result=await api.request(`/api/auth/canvas/callback?${new URLSearchParams({error:'access_denied',state:canceled.searchParams.get('state')!})}`);assert.equal(result.status,302);assert.match(new URL(result.location!).searchParams.get('canvas_error')!,/canceled/);assert.equal(api.exchanges(),1);
 }finally{await api.close();}
});
test('explicit linking preserves an existing account and refuses a claimed Canvas identity',async()=>{
 const api=await serve();try{
  const first=(await api.request('/api/auth/signup',{email:'first@example.edu',password:'long-enough-test-password'})).data;
  await api.complete(await api.start('berkeley','connect'));assert.equal((await api.request('/api/auth/me')).data.id,first.id);
  const second=(await api.request('/api/auth/signup',{email:'second@example.edu',password:'long-enough-test-password'})).data;
  const conflict=await api.complete(await api.start('berkeley','connect'));assert.match(new URL(conflict.location!).searchParams.get('canvas_error')!,/different SuperTutor account/);assert.equal((await api.request('/api/auth/me')).data.id,second.id);assert.equal(api.store.getCanvasConnection(second.id),null);
 }finally{await api.close();}
});
test('failed exchange cannot create or connect an account',async()=>{
 const api=await serve();try{const result=await api.complete(await api.start(),'failure');assert.match(new URL(result.location!).searchParams.get('canvas_error')!,/could not authorize/);assert.equal((await api.request('/api/auth/me')).status,401);assert.equal((await api.request('/api/auth/canvas/start?institution=unregistered')).status,503);}finally{await api.close();}
});
test('OAuth refresh is coalesced, persists, and cannot resurrect a disconnected credential',async()=>{
 const file=join(mkdtempSync(join(tmpdir(),'canvas-oauth-')),'state.json');const store=new TutorStore(file);
 const {account}=store.signInWithCanvas({baseUrl:institutions[0].baseUrl,userId:'7',userName:'Dana',token:'oauth-old',oauth:{refreshToken:'refresh',expiresAt:Date.now()-1000}});
 let refreshes=0;const client:CanvasOAuthClient={exchange:async()=>token(),refresh:async()=>{refreshes++;await Promise.resolve();return token('oauth-new');}};
 const resolve=createCanvasCredentialResolver(store,institutions,client);const [a,b]=await Promise.all([resolve(account.id),resolve(account.id)]);assert.equal(a.token,'oauth-new');assert.deepEqual(a,b);assert.equal(refreshes,1);assert.equal(new TutorStore(file).useCanvasCredential(account.id).token,'oauth-new');assert.equal('oauth' in store.getCanvasConnection(account.id)!,false);
 store.signInWithCanvas({baseUrl:institutions[0].baseUrl,userId:'7',userName:'Dana',token:'oauth-expired',oauth:{refreshToken:'refresh',expiresAt:Date.now()-1000}});
 const stale=createCanvasCredentialResolver(store,institutions,{...client,refresh:async()=>{store.disconnectCanvas(account.id);return token('oauth-stale');}});await assert.rejects(()=>stale(account.id),/connection changed/);assert.equal(store.getCanvasConnection(account.id),null);
});
test('OAuth configuration only permits registered callback paths and unique schools',()=>{
 assert.throws(()=>loadCanvasOAuthInstitutions({CANVAS_OAUTH_INSTITUTIONS:JSON.stringify([{...institutions[0],redirectUri:'https://app.example.com/elsewhere'}])}),/redirect/);
 assert.throws(()=>loadCanvasOAuthInstitutions({CANVAS_OAUTH_INSTITUTIONS:JSON.stringify([institutions[0],institutions[0]])}),/unique/);
});
