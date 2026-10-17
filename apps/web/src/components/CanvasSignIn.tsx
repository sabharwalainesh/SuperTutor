import { useEffect, useState } from 'react';
import type { DeploymentConfig } from '../../../../packages/types.js';
import { getConfig, canvasSignInUrl } from '../lib/api.js';

export function CanvasSignIn({intent='signin'}:{intent?:'signin'|'connect'}){
  const [config,setConfig]=useState<DeploymentConfig|null>(null);
  const [school,setSchool]=useState('');
  const [customHost,setCustomHost]=useState('');
  const [error,setError]=useState('');
  useEffect(()=>{let canceled=false;getConfig().then(value=>{if(canceled)return;setConfig(value);setSchool(value.canvasOAuth?.institutions.find(i=>i.enabled)?.baseUrl??value.canvasOAuth?.institutions[0]?.baseUrl??'other');}).catch(()=>{if(!canceled)setError('School sign-in options could not load. Please try again.');});return()=>{canceled=true;};},[]);
  const institutions=config?.canvasOAuth?.institutions??[];
  let customBase='';try{customBase=new URL(customHost.includes('://')?customHost:`https://${customHost}`).origin;}catch{/* Not a complete hostname yet. */}
  const selected=institutions.find(i=>i.baseUrl===(school==='other'?customBase:school));
  const enabled=selected?.enabled??false;
  return <div className="canvas-signin">
    <div className="canvas-signin-title"><span className="canvas-mini">C</span><div><strong>{intent==='connect'?'Connect with your school':'Sign in with Canvas'}</strong><p>{intent==='connect'?'Authorize Canvas and import your assignments.':'Your Canvas account connects automatically.'}</p></div></div>
    <label>School<select value={school} disabled={!config} onChange={event=>setSchool(event.target.value)}>{!config&&<option value="">Loading schools…</option>}{institutions.map(i=><option key={i.baseUrl} value={i.baseUrl}>{i.name}{i.enabled?'':' (not enabled yet)'}</option>)}<option value="other">Another Canvas school</option></select></label>
    {school==='other'&&<label>Your school’s Canvas address<input value={customHost} placeholder="canvas.yourschool.edu" onChange={event=>setCustomHost(event.target.value)}/></label>}
    {enabled&&selected?<a className="button canvas-signin-button" href={canvasSignInUrl(selected.id,intent)}>{intent==='connect'?'Connect Canvas':'Continue with Canvas'}</a>:<button className="canvas-signin-button" disabled>{intent==='connect'?'Connect Canvas':'Continue with Canvas'}</button>}
    {config&&!enabled&&<p className="fineprint">{school==='other'?'Your school’s Canvas sign-in must be enabled for this workspace.':'This school’s Canvas sign-in has not been enabled for this workspace yet.'} {intent==='signin'?'You can use email below.':'Use an access token below in the meantime.'}</p>}
    {error&&<p className="banner error" role="alert">{error}</p>}
  </div>;
}
