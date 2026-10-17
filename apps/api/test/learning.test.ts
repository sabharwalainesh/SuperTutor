import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApiApp } from '../src/app.js';
import { TutorStore } from '../../../packages/tutor-state.js';
import { SAMPLE_LESSON, SAMPLE_SOURCE } from '../../../packages/learning-fixtures.js';

async function serve(store=new TutorStore()){
 const server=createApiApp(store).listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;let cookie='';
 const request=async(path:string,body?:unknown,method=body===undefined?'GET':'POST')=>{const res=await fetch(base+path,{method,headers:{'Content-Type':'application/json',cookie},body:body===undefined?undefined:JSON.stringify(body)});const next=res.headers.getSetCookie()[0];if(next)cookie=next.split(';')[0];return {status:res.status,data:await res.json()};};
 return {store,request,close:()=>new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()))};
}
test('study source and answers persist while only Go tools author lessons and feedback',async()=>{
 const api=await serve();try{
  assert.equal((await api.request('/api/lesson',{text:SAMPLE_SOURCE,count:3})).status,401);
  const signup=await api.request('/api/auth/signup',{email:'practice@example.edu',password:'test-password-long-enough'});const owner=signup.data.id;
  assert.equal((await api.request('/api/lesson',{text:'short'})).status,400);
  assert.equal((await api.request('/api/lesson',{text:'a'.repeat(8001)})).status,400);
  const pending=await api.request('/api/lesson',{text:SAMPLE_SOURCE,count:3});assert.equal(pending.status,202);assert.equal(pending.data.lesson,null);assert.equal(pending.data.source,SAMPLE_SOURCE);
  const ready=api.store.recordStudyLesson(owner,pending.data.id,SAMPLE_LESSON);assert.equal(ready.lesson?.summary.length,3);
  const questionId=ready.lesson!.questions[0].id;
  const submitted=await api.request('/api/grade',{sessionId:ready.id,questionId,answer:'The condition checks the state.',score:100});assert.equal(submitted.status,202);assert.deepEqual(submitted.data.feedback,{});
  const feedback={questionId,score:45,verdict:'partial' as const,explanation:'Explain how the state changes.',improvedAnswer:'Update the state so the condition eventually becomes false.',missedTopics:['Termination']};
  api.store.recordPracticeFeedback(owner,ready.id,submitted.data.answerRevisions[questionId],feedback);
  const read=await api.request('/api/study');assert.equal(read.data.study.feedback[questionId].score,45);
  const revised=await api.request('/api/grade',{sessionId:ready.id,questionId,answer:'The state eventually makes the condition false.'});assert.deepEqual(revised.data.feedback,{});
  assert.throws(()=>api.store.recordPracticeFeedback(owner,ready.id,submitted.data.answerRevisions[questionId],feedback),/revised this answer/);
  assert.equal((await api.request('/api/grade',{sessionId:ready.id,questionId,answer:''})).status,400);
  assert.equal((await api.request('/api/grade',{sessionId:ready.id,questionId:'invented',answer:'not a real question'})).status,404);
  assert.equal((await api.request('/api/study',undefined,'DELETE')).status,200);assert.equal((await api.request('/api/study')).data.study,null);
 }finally{await api.close();}
});
test('study sessions survive restart and stale or cross-owner writes are rejected',async()=>{
 const file=join(mkdtempSync(join(tmpdir(),'supertutor-study-')),'state.json');const store=new TutorStore(file);
 const {account:a}=await store.createAccount({email:'a@example.edu',password:'test-password-long-enough'});
 const {account:b}=await store.createAccount({email:'b@example.edu',password:'test-password-long-enough'});
 const first=store.startStudySession(a.id,{text:SAMPLE_SOURCE,count:3});store.recordStudyLesson(a.id,first.id,SAMPLE_LESSON);
 assert.throws(()=>store.recordStudyLesson(b.id,first.id,SAMPLE_LESSON),/session has changed/);
 assert.equal(store.getStudySession(b.id),null);
 assert.equal(new TutorStore(file).getStudySession(a.id)?.lesson?.questions.length,3);
 const second=store.startStudySession(a.id,{text:SAMPLE_SOURCE,count:5});
 assert.throws(()=>store.recordStudyLesson(a.id,first.id,SAMPLE_LESSON),/session has changed/);
 assert.throws(()=>store.recordStudyLesson(a.id,second.id,SAMPLE_LESSON),/exactly 5/);
 assert.equal(store.getStudySession(a.id)?.lesson,null);
});
