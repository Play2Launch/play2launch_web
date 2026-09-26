import {useEffect,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {api,ApiError} from '../lib/api';
import {notifyPointsChanged} from '../components/PointsProvider';
import {checkRunner,runnerMessage,runnerURL,RUNNER_RULES,type RunnerSession} from '../lib/runner';

export function RunnerFrame({slug}:{slug:string}) {
 const frame=useRef<HTMLIFrameElement>(null);
 const [error,setError]=useState(''),[status,setStatus]=useState('Waiting for the game…'),[result,setResult]=useState<RunnerSession>();
 const [attempt,setAttempt]=useState(0);
 const [launch,setLaunch]=useState<{game_id:string;entry_url:string;rules_version:string}>();
 useEffect(()=>{const ctrl=new AbortController();api.request<{game_id:string;entry_url:string;rules_version:string}>(`/campaigns/${encodeURIComponent(slug)}/game`,undefined,{signal:ctrl.signal}).then(v=>{if(!/^gx[0-9a-z]{1,13}$/.test(v.game_id)||v.rules_version!==RUNNER_RULES)throw Error('Invalid game configuration.');if(!ctrl.signal.aborted)setLaunch(v);}).catch(e=>{if(!ctrl.signal.aborted)setError(e.message);});return()=>ctrl.abort();},[slug,attempt]);
 let src='',configError='';
 try{if(launch)src=runnerURL(launch.entry_url,location.origin);}catch(e){configError=(e as Error).message;}
 useEffect(()=>{
  if(!src||!launch)return;
  const gameID=launch.game_id;
  const ctrl=new AbortController(),origin=new URL(src).origin;
  let instance='',session:RunnerSession|undefined,busy=false,started=false;
  const timer=setTimeout(()=>setError('Game connection timed out. Check game deployment and allowed parent origins.'),20000);
  const send=(type:string,data:Record<string,unknown>={})=>frame.current?.contentWindow?.postMessage({protocol:'p2l-game-v1',type,game_id:gameID,rules_version:RUNNER_RULES,instance_id:instance,session_id:session?.id??null,...data},origin);
  const init=()=>send('p2l:init',{session:{id:session!.id,seed:session!.seed,expires_at:Date.parse(session!.expires_at),duration_ms:90000,allow_pause:false}});
  async function startRound(){
   if(busy)return;busy=true;setError('');setStatus('Creating platform round…');
   try{
    const next=checkRunner(await api.authenticated<RunnerSession>(`/campaigns/${encodeURIComponent(slug)}/sessions`,{},ctrl.signal),slug,gameID);
    if(ctrl.signal.aborted)return;
    if(next.status!=='playing')throw Error('This round is no longer playable.');
    session=next;started=false;setResult(undefined);init();setStatus('Round ready · 90 seconds · No pause');
   }catch(e){if(!ctrl.signal.aborted){setError((e as Error).message);send('p2l:error',{code:'START_FAILED',message:(e as Error).message,retryable:true});}}
   finally{busy=false;}
  }
  async function receive(e:MessageEvent){
   if(!runnerMessage(e,frame.current?.contentWindow??null,origin,gameID))return;
   const d=e.data;
   if(d.type==='p2l:ready'){
    if(instance&&instance!==d.instance_id)return;
    clearTimeout(timer);instance=d.instance_id;
    if(session?.status==='playing'){init();return;}await startRound();return;
   }
   if(!instance||!session||!runnerMessage(e,frame.current?.contentWindow??null,origin,gameID,instance,session.id))return;
   if(d.type==='p2l:start'){started=true;setStatus('Round in progress');return;}
   if(d.type==='p2l:restart'){
    if(session.status==='accepted')await startRound();
    else {setError('The rejected round must expire before starting another. Return to the campaign.');send('p2l:error',{code:'ROUND_ACTIVE',message:'The rejected round must expire before starting another.',retryable:true});}
    return;
   }
   if(d.type==='p2l:exit'){setStatus('Game exited. Return to the campaign or reconnect.');return;}
   if(d.type!=='p2l:finish'||!started||busy||typeof d.submission_id!=='string'||!/^[a-f0-9]{32}$/.test(d.submission_id)||!d.report||JSON.stringify(d.report).length>500000)return;
   busy=true;setStatus('Checking score…');
   try{
    // Only the host has account credentials; never forward them to the iframe.
    const accepted=checkRunner(await api.authenticated<RunnerSession>(`/game/sessions/${session.id}/runner-submit`,{submission_id:d.submission_id,report:d.report},ctrl.signal),slug,gameID);
    if(ctrl.signal.aborted)return;
    if(accepted.id!==session.id||accepted.status!=='accepted')throw Error('Score was not accepted.');
    session=accepted;setResult(accepted);setError('');setStatus('Score accepted');
    notifyPointsChanged();
    send('p2l:result',{submission_id:d.submission_id,status:'accepted',score:accepted.score,message:'Score accepted by the platform.'});
   }catch(e){
    if(ctrl.signal.aborted)return;
    const permanent=e instanceof ApiError&&[10001,10003,14001,14003].includes(e.code);
    setError((e as Error).message);setStatus('Score not accepted');
    if(permanent)send('p2l:result',{submission_id:d.submission_id,status:'rejected',message:(e as Error).message});
    else send('p2l:error',{submission_id:d.submission_id,code:'SUBMIT_FAILED',message:(e as Error).message,retryable:true});
   }finally{busy=false;}
  }
  window.addEventListener('message',receive);
  return()=>{ctrl.abort();clearTimeout(timer);window.removeEventListener('message',receive);};
 },[src,slug,attempt,launch]);
 return <section className="game-embed" aria-label="Game mode">
  <div className="notice" role="status">{status}</div>
  {(error||configError)&&<p role="alert">{error||configError}</p>}
  {src&&<iframe className="game-embed-frame" key={attempt} ref={frame} src={src} title="PAPERHOOD game" sandbox="allow-scripts allow-same-origin" referrerPolicy="no-referrer"/>}
  <div className="game-embed-actions">
  {result&&<Link className="btn btn-primary" to={`/campaign/${slug}/session/${result.id}`}>View score & contribution</Link>}
  <Link className="btn btn-secondary" to={`/campaign/${slug}`}>Return to campaign</Link>
  {error&&<button className="btn btn-secondary" onClick={()=>{setError('');setAttempt(n=>n+1);}}>Reconnect game</button>}
  </div>
 </section>;
}
