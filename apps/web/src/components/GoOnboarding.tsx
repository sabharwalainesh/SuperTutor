import { useEffect, useRef, useState } from 'react';
import { getGoBrowser } from '../lib/go-browser.js';
import { GoSetup } from './GoSetup.js';
import { Icon } from './Icons.js';
import { shouldOfferGoSetup } from '../lib/go-connection.js';
const DISMISSED='supertutor:go-onboarding-dismissed:v1';
const isConfirmed=()=>{try{return localStorage.getItem('supertutor:go-user-confirmed:v1')==='yes';}catch{return false;}};
export function GoOnboarding({linked=false, autoPrompt=true}: {linked?:boolean; autoPrompt?:boolean}){
  const dialog=useRef<HTMLDialogElement>(null);
  const [confirmed,setConfirmed]=useState(isConfirmed);
  const nav=navigator as Navigator&{userAgentData?:{brands:{brand:string}[]};brave?:unknown};
  const browser=getGoBrowser(nav.userAgent,nav.maxTouchPoints,nav.userAgentData?.brands,Boolean(nav.brave));
  const needsSetup=shouldOfferGoSetup(browser.supported,confirmed,linked);
  useEffect(()=>{
    const sync=()=>{const ready=isConfirmed();setConfirmed(ready);if(!shouldOfferGoSetup(browser.supported,ready,linked))dialog.current?.close();};
    window.addEventListener('supertutor-go-confirmation',sync);
    let dismissed=false;try{dismissed=sessionStorage.getItem(DISMISSED)==='yes';}catch{/* Still offer setup. */}
    if(!needsSetup)dialog.current?.close();
    else if(autoPrompt&&!dismissed&&!new URLSearchParams(window.location.search).has('canvas_error'))dialog.current?.showModal();
    return()=>window.removeEventListener('supertutor-go-confirmation',sync);
  },[linked,autoPrompt,needsSetup]);
  const dismiss=()=>{try{sessionStorage.setItem(DISMISSED,'yes');}catch{/* Session preference only. */}};
  return <>
    {needsSetup&&<aside className="browser-notice" aria-label="Tutor browser setup"><span><Icon name="spark" size={17}/><strong>{browser.supported?'Use Go beside your work':'Switch to desktop Chrome for Superhuman Go'}</strong><span>{browser.supported?'Browser extension setup':'Edge also supports the Go extension.'}</span></span><button onClick={()=>dialog.current?.showModal()}>{browser.supported?'Go browser options':'Choose a supported browser'}</button></aside>}
    <dialog className="go-onboarding-dialog" ref={dialog} aria-label="Superhuman Go setup" onClose={dismiss}><div className="onboarding-dialog-head"><span><Icon name="spark" size={20}/> Go browser setup</span><button className="icon-button" aria-label="Close Go setup" onClick={()=>dialog.current?.close()}><Icon name="close"/></button></div><GoSetup initiallyExpanded linked={linked}/><div className="onboarding-dialog-footer"><p>Your workspace works while you finish setup.</p><button onClick={()=>dialog.current?.close()}>Continue to website</button></div></dialog>
  </>;
}
