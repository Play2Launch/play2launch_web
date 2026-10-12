import {useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';

type Widget = {render:(element:HTMLElement, options:Record<string,unknown>)=>string; remove:(id:string)=>void};
declare global {interface Window {turnstile?:Widget}}
let loading:Promise<Widget>|undefined;
function loadWidget():Promise<Widget> {
  if(window.turnstile)return Promise.resolve(window.turnstile);
  if(loading)return loading;
  loading=new Promise<Widget>((resolve,reject)=>{
    const script=document.createElement('script');
    const fail=()=>{clearTimeout(timer);script.remove();loading=undefined;reject(new Error('Verification could not load. Check your connection and retry.'));};
    const timer=window.setTimeout(fail,15000);
    script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async=true;
    script.onload=()=>{if(!window.turnstile){fail();return;}clearTimeout(timer);resolve(window.turnstile);};
    script.onerror=fail;
    document.head.appendChild(script);
  });
  return loading;
}

function Challenge({siteKey,action,finish}:{siteKey:string;action:string;finish:(token?:string,error?:Error)=>void}) {
  const dialog=useRef<HTMLDialogElement>(null);
  const container=useRef<HTMLDivElement>(null);
  const [error,setError]=useState('');
  const [attempt,setAttempt]=useState(0);
  useEffect(()=>{dialog.current?.showModal();},[]);
  useEffect(()=>{
    let closed=false;let widget:Widget|undefined;let id:string|undefined;
    setError('');
    void loadWidget().then(api=>{
      if(closed||!container.current)return;
      widget=api;
      id=api.render(container.current,{
        sitekey:siteKey,action,theme:'dark',size:'flexible',
        callback:(token:string)=>{if(!closed)finish(token);},
        'error-callback':()=>{if(!closed)setError('Verification failed to load or complete. Please retry.');return true;},
        'expired-callback':()=>{if(!closed)setError('Verification expired. Please retry.');},
        'timeout-callback':()=>{if(!closed)setError('Verification timed out. Please retry.');},
      });
    }).catch(()=>{if(!closed)setError('Verification could not load. Check your connection and retry.');});
    return ()=>{closed=true;if(id!==undefined)widget?.remove(id);};
  },[siteKey,action,attempt,finish]);
  return <dialog ref={dialog} aria-labelledby="human-verification-title" onCancel={event=>{event.preventDefault();finish(undefined,new Error('Verification cancelled. Please try again.'));}}
    style={{background:'var(--panel, #141713)',color:'var(--text, #f4f5ef)',border:'1px solid #454b3c',borderRadius:12,padding:24,width:'min(400px, calc(100vw - 32px))',maxHeight:'90dvh',overflow:'auto'}}>
    <h3 id="human-verification-title">Quick security check</h3>
    <p>Please complete verification to continue.</p>
    <div ref={container}/>
    {error&&<p role="alert">{error}</p>}
    <div style={{display:'flex',gap:12,marginTop:16}}>
      {error&&<button type="button" className="btn btn-primary" onClick={()=>setAttempt(v=>v+1)}>Retry verification</button>}
      <button type="button" className="btn btn-secondary" onClick={()=>finish(undefined,new Error('Verification cancelled. Please try again.'))}>Cancel</button>
    </div>
  </dialog>;
}

// Concurrent protected requests receive separate widgets/tokens, never a shared token.
let queue:Promise<unknown>=Promise.resolve();
export function acquireTurnstile(siteKey:string,action:string,signal?:AbortSignal):Promise<string> {
  const run=async()=>{
    if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
    return new Promise<string>((resolve,reject)=>{
      const host=document.createElement('div');document.body.appendChild(host);
      const previous=document.activeElement;
      const root=createRoot(host);
      let settled=false;
      const abort=()=>finish(undefined,new DOMException('Cancelled','AbortError'));
      const timer=window.setTimeout(()=>finish(undefined,new Error('Verification timed out. Please try again.')),120000);
      const finish=(token?:string,error?:Error)=>{
        if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);
        queueMicrotask(()=>{root.unmount();host.remove();if(previous instanceof HTMLElement&&previous.isConnected)previous.focus();});
        if(token)resolve(token);else reject(error||new Error('Verification failed. Please retry.'));
      };
      signal?.addEventListener('abort',abort,{once:true});
      root.render(<Challenge siteKey={siteKey} action={action} finish={finish}/>);
    });
  };
  const result=queue.then(run,run);queue=result.catch(()=>{});return result;
}
