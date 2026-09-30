import {useEffect,useRef,useState} from 'react';
import {Link,useParams} from 'react-router-dom';
import {api} from '../lib/api';
import {VerifiedKol} from '../components/VerifiedKol';

type PlayedGame={game_key:string;name:string;rules:string;best:number;rounds:number;last_played:string|null};
type Participation={id:string;slug:string;name:string;stage:string;team:{id:string;name:string;type?:string}|null;games:PlayedGame[]};
export type PublicPlayerData={id:string;display_name:string;handle:string;avatar_url:string;kol_verified:boolean;campaigns:Participation[];next_cursor:string};
export default function PublicPlayer(){
 const {userId=''}=useParams();
 return <Player key={userId} userId={userId}/>;
}
function Player({userId}:{userId:string}){
 const [data,setData]=useState<PublicPlayerData>();
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 const [failedImage,setFailedImage]=useState(false);
 const request=useRef<AbortController>();
 const loading=useRef(false);
 async function load(after=''){
  if(loading.current)return;
  loading.current=true;setBusy(true);setError('');
  const ctrl=new AbortController();request.current=ctrl;
  try{
   const page=await api.request<PublicPlayerData>(`/players/${encodeURIComponent(userId)}${after?'?after='+encodeURIComponent(after):''}`,undefined,{signal:ctrl.signal});
   if(ctrl.signal.aborted)return;
   if(page.id!==userId||!Array.isArray(page.campaigns))throw new Error('Invalid player profile response.');
   setData(old=>after&&old?{...page,campaigns:[...old.campaigns,...page.campaigns.filter(c=>!old.campaigns.some(o=>o.id===c.id))]}:page);
   document.title=`${page.display_name||page.handle||'Player'} · PLAY TO LAUNCH`;
  }catch(e){if(!ctrl.signal.aborted)setError(e instanceof Error?e.message:'Could not load player profile.');}
  finally{if(!ctrl.signal.aborted){loading.current=false;setBusy(false);}}
 }
 useEffect(()=>{void load();return()=>{request.current?.abort();loading.current=false;};},[userId]);
 const name=data?.display_name||data?.handle||'Player';
 return <section className="public-player-page">
  <Link className="muted" to="/leaderboard">← Leaderboard</Link>
  <header className="public-player-header membership-card">
   <span className="avatar large public-player-avatar player-avatar">
    {data?.avatar_url?.startsWith('https://')&&!failedImage?<img src={data.avatar_url} alt="" referrerPolicy="no-referrer" onError={()=>setFailedImage(true)}/>:name.charAt(0).toUpperCase()}
    {data?.kol_verified&&<VerifiedKol avatar/>}
   </span>
   <div><span className="eyebrow">PLAYER PROFILE</span><h1>{data?name:'Player profile'}</h1>{data?.handle&&<p className="accent">@{data.handle}</p>}{data?.kol_verified&&<VerifiedKol/>}</div>
  </header>
  <h2>Campaigns & games</h2>
  <p className="muted">Published campaigns only. Best scores are separate for each campaign, game and rules version. Trial rounds are not included.</p>
  {error&&<div className="notice" role="alert">{error} <button className="btn btn-secondary" onClick={()=>void load(data?.next_cursor||'')}>Retry</button></div>}
  {busy&&<p role="status">Loading player activity…</p>}
  {data&&!data.campaigns.length&&<div className="empty-panel">No public campaign activity yet.</div>}
  <div className="public-player-campaigns">
   {data?.campaigns.map(c=><article key={c.id} className="membership-card">
    <div className="public-player-campaign-title"><h3><Link to={`/campaign/${encodeURIComponent(c.slug)}`}>{c.name}</Link></h3><span className="pill">{c.stage}</span></div>
    <p>Current team: {c.team?<Link className="accent" to={`/campaign/${encodeURIComponent(c.slug)}/teams?selected=${encodeURIComponent(c.team.id)}`}>{c.team.name}</Link>:<span className="muted">Not currently in a team</span>}</p>
    {!c.games.length?<p className="muted">No accepted game rounds yet.</p>:c.games.map(g=><div className="public-player-game" key={`${g.game_key}:${g.rules}`}>
     <div><strong>{g.name||g.game_key||'Game'}</strong><p className="small muted">Rules: {g.rules||'Legacy'}</p></div>
     <dl><div><dt>Personal best</dt><dd className="accent">{g.best.toLocaleString()} <small>pts</small></dd></div><div><dt>Accepted rounds</dt><dd>{g.rounds.toLocaleString()}</dd></div><div><dt>Last played</dt><dd>{g.last_played?new Date(g.last_played).toLocaleString():'—'}</dd></div></dl>
    </div>)}
   </article>)}
  </div>
  {data?.next_cursor&&<button className="btn btn-secondary" disabled={busy} onClick={()=>void load(data.next_cursor)}>Load more campaigns</button>}
 </section>;
}
