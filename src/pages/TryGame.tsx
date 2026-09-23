import {useEffect,useState} from 'react';
import {Link,useParams} from 'react-router-dom';
import {api} from '../lib/api';
import {runnerURL} from '../lib/runner';

export function TryGame(){
 const {id=''}=useParams();
 return <Trial key={id} slug={id}/>;
}
function Trial({slug}:{slug:string}){
 const [src,setSrc]=useState(''),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 useEffect(()=>{
  const ctrl=new AbortController();setSrc('');setError('');
  // Public configuration only. No authentication, session creation, or score submission.
  api.request<{game_id:string;entry_url:string}>(`/campaigns/${encodeURIComponent(slug)}/game`,undefined,{signal:ctrl.signal}).then(config=>{
   if(ctrl.signal.aborted)return;
   if(!/^gx[0-9a-z]{1,13}$/.test(config.game_id))throw Error('Invalid game configuration.');
   setSrc(runnerURL(config.entry_url,location.origin,'demo'));
  }).catch(e=>{if(!ctrl.signal.aborted)setError(e.message);});
  return()=>ctrl.abort();
 },[slug,attempt]);
 return <section className="game-embed" aria-label="Game mode">
  <div className="notice"><strong>FREE TRIAL</strong><span> · Trial scores stay local, not ranked.</span></div>
  {error?<p role="alert">{error}</p>:!src?<p role="status">Loading game…</p>:null}
  {src&&<iframe className="game-embed-frame" key={attempt} src={src} title="Game trial" sandbox="allow-scripts allow-same-origin" referrerPolicy="no-referrer"/>}
  <div className="notice"><p>Ready to compete? Join a team and start a new ranked round. Trial scores cannot be transferred.</p>
   <Link className="btn btn-primary" to={`/campaign/${slug}/compete`}>Play for your team</Link>
   <Link className="btn btn-secondary" to={`/campaign/${slug}`}>Return to campaign</Link>
   <button className="btn btn-secondary" onClick={()=>setAttempt(n=>n+1)}>Reload trial</button>
  </div>
 </section>;
}
