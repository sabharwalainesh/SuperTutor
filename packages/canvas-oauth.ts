import { Router } from 'express';
import { z } from 'zod';
import { createSessionSecret, hashSecret } from './auth.js';
import { assertPublicHost, CanvasError, normalizeCanvasBaseUrl } from './canvas.js';
import { sessionCookieOptions } from './http-auth.js';
import { StateError, type TutorStore } from './tutor-state.js';
import { SESSION_COOKIE } from './types.js';

const institutionSchema = z.object({
  id:z.string().regex(/^[a-z0-9-]{1,50}$/),name:z.string().trim().min(1).max(100),
  baseUrl:z.string().min(1),clientId:z.string().min(1),clientSecret:z.string().min(1),redirectUri:z.string().url(),
}).transform(value=>{
  const baseUrl=normalizeCanvasBaseUrl(value.baseUrl);const redirect=new URL(value.redirectUri);
  if(redirect.username||redirect.password||redirect.search||redirect.hash||redirect.pathname!=='/api/auth/canvas/callback'||(redirect.protocol!=='https:'&&!(redirect.protocol==='http:'&&['localhost','127.0.0.1'].includes(redirect.hostname))))throw new Error('Canvas OAuth redirect must be an HTTPS /api/auth/canvas/callback URL (HTTP localhost is allowed for development).');
  return {...value,baseUrl};
});
export type CanvasOAuthInstitution = z.infer<typeof institutionSchema>;
export function loadCanvasOAuthInstitutions(env:NodeJS.ProcessEnv=process.env):CanvasOAuthInstitution[]{
  if(!env.CANVAS_OAUTH_INSTITUTIONS)return [];
  const result=z.array(institutionSchema).max(50).parse(JSON.parse(env.CANVAS_OAUTH_INSTITUTIONS));
  if(new Set(result.map(i=>i.id)).size!==result.length||new Set(result.map(i=>i.baseUrl)).size!==result.length)throw new Error('Canvas OAuth institutions must have unique IDs and Canvas hosts.');
  return result;
}
export function publicCanvasInstitutions(institutions:CanvasOAuthInstitution[]){
  const listed=institutions.map(({id,name,baseUrl})=>({id,name,baseUrl,enabled:true}));
  const defaults=[
    {id:'berkeley',name:'UC Berkeley / bCourses',baseUrl:'https://bcourses.berkeley.edu'},
    {id:'stanford',name:'Stanford University',baseUrl:'https://canvas.stanford.edu'},
    {id:'ucla',name:'UCLA / Bruin Learn',baseUrl:'https://bruinlearn.ucla.edu'},
  ];
  for(const school of defaults)if(!listed.some(i=>i.baseUrl===school.baseUrl))listed.push({...school,enabled:false});
  return listed;
}
const tokenSchema=z.object({access_token:z.string().min(1).max(8000),token_type:z.string().refine(v=>v.toLowerCase()==='bearer'),refresh_token:z.string().min(1).max(8000).optional(),expires_in:z.number().positive().max(31_536_000),user:z.object({id:z.union([z.number().int().positive().safe(),z.string().regex(/^\d+$/)]),name:z.string().max(200).optional()}).optional()});
export type CanvasOAuthToken = z.infer<typeof tokenSchema>;
export type CanvasOAuthClient = {exchange:(institution:CanvasOAuthInstitution,code:string)=>Promise<CanvasOAuthToken>;refresh:(institution:CanvasOAuthInstitution,refreshToken:string)=>Promise<CanvasOAuthToken>};
async function tokenRequest(institution:CanvasOAuthInstitution,fields:Record<string,string>):Promise<CanvasOAuthToken>{
  await assertPublicHost(new URL(institution.baseUrl).hostname);
  try{
    const response=await fetch(`${institution.baseUrl}/login/oauth2/token`,{method:'POST',redirect:'manual',headers:{'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json'},body:new URLSearchParams({client_id:institution.clientId,client_secret:institution.clientSecret,redirect_uri:institution.redirectUri,...fields}),signal:AbortSignal.timeout(12_000)});
    if(!response.ok)throw new CanvasError(502,'Canvas could not authorize this connection. Try signing in with Canvas again.');
    const body=await response.text();if(body.length>64_000)throw new CanvasError(502,'Canvas returned an unreadable sign-in response.');
    const parsed=tokenSchema.safeParse(JSON.parse(body));if(!parsed.success)throw new CanvasError(502,'Canvas returned an incomplete sign-in response.');return parsed.data;
  }catch(error){if(error instanceof CanvasError)throw error;throw new CanvasError(502,'Canvas did not complete the connection. Try again.');}
}
export const liveCanvasOAuthClient:CanvasOAuthClient={exchange:(institution,code)=>tokenRequest(institution,{grant_type:'authorization_code',code}),refresh:(institution,refreshToken)=>tokenRequest(institution,{grant_type:'refresh_token',refresh_token:refreshToken})};
export const CANVAS_SCOPES=['url:GET|/api/v1/users/:id','url:GET|/api/v1/courses','url:GET|/api/v1/courses/:course_id/assignments'];

export function createCanvasOAuthRouter(store:TutorStore,institutions:CanvasOAuthInstitution[],secure:boolean,client:CanvasOAuthClient=liveCanvasOAuthClient){
  const router=Router();
  const cookieName='supertutor_canvas_oauth';const cookie={httpOnly:true,sameSite:'lax' as const,secure,path:'/api/auth/canvas',maxAge:10*60_000};
  router.get('/start',(req,res)=>{
    const institution=institutions.find(i=>i.id===req.query.institution);
    if(!institution)return res.status(503).json({error:'Canvas sign-in is not enabled for this school. Your workspace administrator must configure its Canvas OAuth registration.'});
    const connect=req.query.intent==='connect';if(connect&&!res.locals.ownerId)return res.status(401).json({error:'Sign in to SuperTutor before linking a Canvas account.'});
    const state=createSessionSecret();const nonce=createSessionSecret();
    store.beginCanvasOAuthFlow(state,{institutionId:institution.id,nonceHash:hashSecret(nonce),expires:Date.now()+cookie.maxAge,ownerId:connect?res.locals.ownerId:null});
    const url=new URL('/login/oauth2/auth',institution.baseUrl);url.search=new URLSearchParams({client_id:institution.clientId,response_type:'code',redirect_uri:institution.redirectUri,state,scope:CANVAS_SCOPES.join(' '),purpose:'SuperTutor: sign in and import your assignments'}).toString();
    res.cookie(cookieName,nonce,cookie).redirect(url.toString());
  });
  router.get('/callback',async(req,res)=>{
    const state=typeof req.query.state==='string'?req.query.state:'';
    // Invalid callbacks cannot choose a return origin or attach an account.
    let flow;try{flow=store.consumeCanvasOAuthFlow(state,req.cookies?.[cookieName]);}catch{return res.status(400).json({error:'Canvas sign-in expired or could not be verified. Start again from the website.'});}
    const institution=institutions.find(i=>i.id===flow.institutionId);
    if(!institution)return res.status(400).json({error:'This school’s Canvas sign-in configuration changed. Start again from the website.'});
    res.clearCookie(cookieName,{...cookie,maxAge:undefined});
    const returnUrl=new URL('/',institution.redirectUri);returnUrl.hash='sources';
    try{
      if(req.query.error)throw new CanvasError(400,'Canvas sign-in was canceled. You can try again or use email sign-in.');
      if(flow.ownerId&&res.locals.ownerId!==flow.ownerId)throw new CanvasError(409,'Your SuperTutor account changed during sign-in. Start the Canvas connection again.');
      if(typeof req.query.code!=='string'||!req.query.code||req.query.code.length>4096)throw new CanvasError(400,'Canvas did not return a sign-in code. Try again.');
      const tokens=tokenSchema.parse(await client.exchange(institution,req.query.code));
      if(!tokens.user||!tokens.refresh_token)throw new CanvasError(502,'Canvas did not grant the account access needed to connect. Ask your administrator to check the app permissions.');
      const result=store.signInWithCanvas({baseUrl:institution.baseUrl,userId:String(tokens.user.id),userName:tokens.user.name??'Canvas student',token:tokens.access_token,oauth:{refreshToken:tokens.refresh_token,expiresAt:Date.now()+tokens.expires_in*1000}},flow.ownerId??undefined);
      res.cookie(SESSION_COOKIE,result.sessionSecret,sessionCookieOptions(secure));returnUrl.searchParams.set('canvas_connected','1');res.redirect(returnUrl.toString());
    }catch(error){returnUrl.searchParams.set('canvas_error',error instanceof CanvasError||error instanceof StateError?error.message:'Canvas sign-in could not be completed. Please try again.');res.redirect(returnUrl.toString());}
  });
  return router;
}

/** Coalesce refreshes per account; reject a result if the student changed connections meanwhile. */
export function createCanvasCredentialResolver(store:TutorStore,institutions:CanvasOAuthInstitution[],client:CanvasOAuthClient=liveCanvasOAuthClient){
  const pending=new Map<string,Promise<{baseUrl:string;token:string}>>();
  return async(ownerId:string)=>{
    const credential=store.useCanvasCredential(ownerId);
    if(!credential.oauth||credential.oauth.expiresAt>Date.now()+60_000)return credential;
    const existing=pending.get(ownerId);if(existing)return existing;
    const refresh=(async()=>{
      const institution=institutions.find(i=>i.baseUrl===credential.baseUrl);if(!institution)throw new CanvasError(409,'Canvas sign-in for this school is no longer configured. Connect Canvas again.');
      const tokens=tokenSchema.parse(await client.refresh(institution,credential.oauth!.refreshToken));
      store.refreshCanvasCredential(ownerId,credential.token,{token:tokens.access_token,refreshToken:tokens.refresh_token??credential.oauth!.refreshToken,expiresAt:Date.now()+tokens.expires_in*1000});
      return {baseUrl:credential.baseUrl,token:tokens.access_token};
    })();pending.set(ownerId,refresh);try{return await refresh;}finally{pending.delete(ownerId);}
  };
}
