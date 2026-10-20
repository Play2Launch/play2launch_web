import {useEffect,useRef,useState} from 'react';
import {Link,useParams} from 'react-router-dom';
import {getCampaign} from '../lib/catalog';
import {api} from '../lib/api';
import {runnerURL} from '../lib/runner';
import {recordInviteEvent,trialMessage} from '../lib/inviteAnalytics';
import {trackGameEvent} from '../lib/firebaseAnalytics';

export function TryGame(){
 const {id=''}=useParams();
 return <Trial key={id} slug={id}/>;
}
function Trial({slug}:{slug:string}){
 const [ranked,setRanked]=useState(false);
 const frame=useRef<HTMLIFrameElement>(null);
 const [src,setSrc]=useState(''),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 useEffect(()=>{
  const ctrl=new AbortController();setSrc('');setError('');
  getCampaign(slug,ctrl.signal).then(c=>{if(!ctrl.signal.aborted)setRanked(c.availability?.scoring_open===true);}).catch(()=>setRanked(false));
  // Public configuration only. No authentication, session creation, or score submission.
  api.request<{game_id:string;entry_url:string}>(`/campaigns/${encodeURIComponent(slug)}/game`,undefined,{signal:ctrl.signal}).then(config=>{
   if(ctrl.signal.aborted)return;
   if(!/^gx[0-9a-z]{1,13}$/.test(config.game_id))throw Error('Invalid game configuration.');
   setSrc(runnerURL(config.entry_url,location.origin,'demo'));
  }).catch(e=>{if(!ctrl.signal.aborted)setError(e.message);});
  return()=>ctrl.abort();
 },[slug,attempt]);
 useEffect(()=>{const receive=(e:MessageEvent)=>{const item=trialMessage(e,frame.current,src);if(item){trackGameEvent(item.event==='trial_start'?'game_start':'game_effective',slug,'trial',item.runID);void recordInviteEvent(slug,item.runID,item.event).catch(()=>{});}};window.addEventListener('message',receive);return()=>window.removeEventListener('message',receive);},[src,slug]);
 return <section className="game-embed" aria-label="Game mode">
  <div className="notice"><strong>{ranked ? "FREE TRIAL" : "PLAY FOR FUN"}</strong><span> · Trial scores stay local, not ranked.</span></div>
  {error?<p role="alert">{error}</p>:!src?<p role="status">Loading game…</p>:null}
  {src&&<iframe ref={frame} className="game-embed-frame" key={attempt} src={src} title="Game trial" sandbox="allow-scripts allow-same-origin" referrerPolicy="no-referrer"/>}
  <div className="notice">{ranked && <><p>Ready to compete? Sign in and start a ranked round. Players without a team join P2L Community automatically. Trial scores cannot be transferred.</p>
   <Link className="btn btn-primary" to={`/campaign/${slug}/compete`}>Play for your team</Link></>}
   {!ranked && <p>Practice is always available. Scores, rewards and team membership are unchanged.</p>}
   <Link className="btn btn-secondary" to={`/campaign/${slug}`}>Return to campaign</Link>
   <button className="btn btn-secondary" onClick={()=>setAttempt(n=>n+1)}>Reload trial</button>
  </div>
 </section>;
}
