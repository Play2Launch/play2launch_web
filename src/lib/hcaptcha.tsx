import {useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';

type Widget={render:(el:HTMLElement,options:Record<string,unknown>)=>string;remove:(id:string)=>void};
export type CaptchaFailure='load_failed'|'widget_error'|'expired'|'timeout'|'cancelled';
declare global {interface Window {hcaptcha?:Widget;p2lHCaptchaReady?:()=>void}}
let loading:Promise<Widget>|undefined;
function load():Promise<Widget>{
 if(loading)return loading;
 loading=new Promise((resolve,reject)=>{
  const script=document.createElement('script');
  const fail=()=>{clearTimeout(timer);script.remove();delete window.p2lHCaptchaReady;loading=undefined;reject(new Error('Verification could not load.'));};
  const timer=window.setTimeout(fail,15000);
  window.p2lHCaptchaReady=()=>{if(!window.hcaptcha){fail();return}clearTimeout(timer);delete window.p2lHCaptchaReady;resolve(window.hcaptcha)};
  script.src='https://js.hcaptcha.com/1/api.js?onload=p2lHCaptchaReady&render=explicit&recaptchacompat=off';script.async=true;script.onerror=fail;
  document.head.appendChild(script);
 });
 return loading;
}
function Challenge({siteKey,finish,report}:{siteKey:string;finish:(token?:string,reason?:CaptchaFailure)=>void;report:(reason:CaptchaFailure)=>void}){
 const el=useRef<HTMLDivElement>(null),cancel=useRef<HTMLButtonElement>(null);
 const [error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 useEffect(()=>{cancel.current?.focus();const escape=(e:KeyboardEvent)=>{if(e.key==='Escape')finish(undefined,'cancelled')};window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape)},[finish]);
 useEffect(()=>{
  let closed=false,id:string|undefined,widget:Widget|undefined;
  setError('');
  const fail=(reason:CaptchaFailure)=>{if(!closed){report(reason);setError('Verification could not complete. Please retry.')}};
  void load().then(api=>{
   if(closed||!el.current)return;widget=api;
   id=api.render(el.current,{sitekey:siteKey,theme:'dark',size:'normal',callback:(token:string)=>{if(!closed)finish(token)},'error-callback':()=>fail('widget_error'),'expired-callback':()=>fail('expired'),'chalexpired-callback':()=>fail('timeout')});
  }).catch(()=>fail('load_failed'));
  return()=>{closed=true;if(id!==undefined)widget?.remove(id)};
 },[siteKey,attempt,finish,report]);
 // hCaptcha mounts challenge frames outside the widget. A native modal dialog
 // would make those frames inert, so use an accessible overlay instead.
 return <div style={{position:'fixed',inset:0,zIndex:1000,background:'#000b',display:'grid',placeItems:'center',overflow:'auto'}}>
  <section role="dialog" aria-modal="true" aria-labelledby="hcaptcha-title" style={{background:'var(--panel, #141713)',color:'var(--text, #f4f5ef)',padding:20,borderRadius:12,width:'min(400px, calc(100vw - 16px))'}}>
   <h3 id="hcaptcha-title">Verify your registration</h3><p>Please complete the security check to continue.</p><div ref={el}/>
   {error&&<p role="alert">{error}</p>}
   <div style={{display:'flex',gap:12,marginTop:16}}>{error&&<button className="btn btn-primary" onClick={()=>setAttempt(n=>n+1)}>Retry verification</button>}<button ref={cancel} className="btn btn-secondary" onClick={()=>finish(undefined,'cancelled')}>Cancel</button></div>
  </section>
 </div>;
}
let queue:Promise<unknown>=Promise.resolve();
export function acquireHCaptcha(siteKey:string,signal?:AbortSignal,onFailure?:(reason:CaptchaFailure)=>void):Promise<string>{
 const run=async()=>{
  if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
  return new Promise<string>((resolve,reject)=>{
   const host=document.createElement('div');document.body.appendChild(host);const root=createRoot(host),previous=document.activeElement;
   let settled=false;const reported=new Set<CaptchaFailure>();
   const report=(reason:CaptchaFailure)=>{if(!reported.has(reason)){reported.add(reason);try{onFailure?.(reason)}catch{/* Telemetry must not block verification. */}}};
   const abort=()=>finish(undefined,'cancelled');
   const timer=window.setTimeout(()=>finish(undefined,'timeout'),180000);
   const finish=(token?:string,reason?:CaptchaFailure)=>{
    if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);if(reason)report(reason);
    queueMicrotask(()=>{root.unmount();host.remove();if(previous instanceof HTMLElement&&previous.isConnected)previous.focus()});
    if(token)resolve(token);else reject(signal?.aborted?new DOMException('Cancelled','AbortError'):new Error('Verification did not complete. Please try again.'));
   };
   signal?.addEventListener('abort',abort,{once:true});root.render(<Challenge siteKey={siteKey} finish={finish} report={report}/>);
  });
 };
 const result=queue.then(run,run);queue=result.catch(()=>{});return result;
}
