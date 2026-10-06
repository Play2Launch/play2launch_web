import {useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {memberships,type MyTeam} from '../lib/teams';
import {api} from '../lib/api';
import {number} from '../data';

export function CaptainTeams({create}:{create:()=>void}) {
 const [items,setItems]=useState<MyTeam[]>([]);
 const [after,setAfter]=useState('');const [next,setNext]=useState('');
 const [busy,setBusy]=useState(true);const [error,setError]=useState('');const [retry,setRetry]=useState(0);
 useEffect(()=>{const ctrl=new AbortController();setBusy(true);setError('');
 memberships(after,ctrl.signal,{q:'',status:'all',role:'captain'}).then(v=>{if(ctrl.signal.aborted)return;setItems(prev=>after?[...prev,...v.items.filter(m=>!prev.some(p=>p.campaign_id===m.campaign_id))]:v.items);setNext(v.next_cursor===after?'':v.next_cursor);}).catch(e=>{if(!ctrl.signal.aborted)setError(e.message);}).finally(()=>{if(!ctrl.signal.aborted)setBusy(false);});return()=>ctrl.abort();},[after,retry]);
 return <section className="captain-directory" aria-label="My captain teams">
  <div className="captain-directory-heading"><h2>My teams</h2><button className="btn btn-primary" onClick={create}>Create team</button></div>
  {error&&<div className="notice" role="alert">{error}<button onClick={()=>setRetry(v=>v+1)}>Retry teams</button></div>}
  <div className="captain-team-grid">{items.map(m=><CaptainTeam key={m.campaign_id} item={m}/>)}</div>
  {busy&&<p role="status">Loading your teams…</p>}
  {!busy&&!error&&!items.length&&<div className="empty-panel"><h3>Your community starts here</h3><p>Choose a campaign and create your first team.</p><button className="btn btn-primary" onClick={create}>Create your first team</button></div>}
  {next&&!error&&<button className="btn btn-secondary" disabled={busy} onClick={()=>setAfter(next)}>Load more teams</button>}
 </section>;
}
function CaptainTeam({item:m}:{item:MyTeam}) {
 const [stats,setStats]=useState<{total:number;team_score:number}>();
 const [error,setError]=useState(false);const [retry,setRetry]=useState(0);
 useEffect(()=>{const ctrl=new AbortController();setError(false);
 api.request<{total:number;team_score:number}>(`/campaigns/${encodeURIComponent(m.slug)}/teams/${encodeURIComponent(m.membership.team_id)}/members`,undefined,{signal:ctrl.signal}).then(v=>{if(!v||![v.total,v.team_score].every(n=>Number.isSafeInteger(n)&&n>=0))throw new Error('Invalid stats');if(!ctrl.signal.aborted)setStats(v);}).catch(()=>{if(!ctrl.signal.aborted)setError(true);});return()=>ctrl.abort();},[m.slug,m.membership.team_id,retry]);
 const manage=`/captain?campaign=${encodeURIComponent(m.slug)}`;
 const detail=`/campaign/${encodeURIComponent(m.slug)}/teams?selected=${encodeURIComponent(m.membership.team_id)}#selected-team`;
 return <article className="captain-team-card">
  <div className="captain-team-identity"><h3>{m.team_name}</h3><div className="captain-team-meta"><Link to={`/campaign/${m.slug}`}>{m.name}</Link><span className="pill neutral">{m.activity_status==='ended'?'ENDED':m.activity_status==='upcoming'?'UPCOMING':'ONGOING'}</span></div></div>
  <div className="captain-team-metrics"><div><strong>{stats?number(stats.total):'—'}</strong><span>Members</span></div><div><strong>{stats?number(stats.team_score):'—'}</strong><span>Team score</span></div>{error&&<button className="text-link" onClick={()=>setRetry(v=>v+1)}>Retry team stats</button>}</div>
  <div className="captain-team-controls"><div className="captain-team-buttons"><Link className="btn btn-primary" to={manage}>Manage team</Link><Link className="btn btn-secondary" to={`${manage}&panel=invite`}>Invite players</Link></div>
  <div className="captain-team-links"><Link className="text-link" to={`${detail.replace('#selected-team','#team-members')}`}>View members →</Link><Link className="text-link" to={detail}>Public team page →</Link></div>
  </div>
 </article>;
}
