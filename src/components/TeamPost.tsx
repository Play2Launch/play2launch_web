import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Users } from 'lucide-react';
import { api } from '../lib/api';
import { joinTeam } from '../lib/teams';
import type { Activity } from './ActivityFeed';
export type TeamChoice = { campaign_id: string; slug: string; name: string; team_name: string; membership: { team_id: string } };
export type TeamAttachment = { id: string; name: string; color: string; players: number; score: number; rank: number; contribution: number; member_rank: number; invite_token: string; as_of: string };
export type TeamEntryAction = 'join' | 'own' | 'none' | 'expired' | 'closed' | 'guest';

export function TeamPostPicker({ select }: { select: (t: TeamChoice) => void }) {
 const [rows,setRows]=useState<TeamChoice[]>([]),[next,setNext]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[loaded,setLoaded]=useState(false);
 const lock=useRef(false),ctrl=useRef<AbortController>(),retry=useRef('');
 async function load(after=''){
  if(lock.current)return;lock.current=true;retry.current=after;setBusy(true);setError('');const c=new AbortController();ctrl.current=c;
  try{const p=await api.authenticated<{items:TeamChoice[];next_cursor:string}>(`/social/teams${after?'?after='+encodeURIComponent(after):''}`,undefined,c.signal);
   if(!p||!Array.isArray(p.items)||typeof p.next_cursor!=='string'||!p.items.every(t=>/^cp[0-9a-z]+$/.test(t.campaign_id)&&/^tm[0-9a-z]+$/.test(t.membership?.team_id)&&/^[a-z0-9][a-z0-9-]{0,63}$/.test(t.slug)&&typeof t.team_name==='string'))throw new Error('Could not read your teams.');
   if(!c.signal.aborted){setRows(old=>after?[...old,...p.items.filter(t=>!old.some(o=>o.campaign_id===t.campaign_id))]:p.items);setNext(p.next_cursor);setLoaded(true);}
  }catch(e){if(!c.signal.aborted)setError(e instanceof Error?e.message:'Could not load teams.');}finally{if(!c.signal.aborted){lock.current=false;setBusy(false);}}
 }
 useEffect(()=>{void load();return()=>ctrl.current?.abort();},[]);
 return <div className="post-picker" aria-label="Choose your team"><p className="small muted">Choose one of your teams. Your personal invitation is included automatically. Community and teams with invitations paused are not available.</p>
 {rows.map(t=><button className="post-result post-result-choice" key={t.campaign_id} onClick={()=>select(t)}><strong>{t.team_name}</strong><span>{t.name}</span></button>)}
 {busy&&<p role="status">Loading teams…</p>}{loaded&&!rows.length&&<p>No eligible teams on this page.</p>}
 {error&&<p role="alert">{error} <button className="text-link" onClick={()=>void load(retry.current)}>Retry teams</button></p>}
 {next&&<button className="btn btn-secondary" disabled={busy} onClick={()=>void load(next)}>Load more teams</button>}
 </div>;
}
export function TeamPostCard({ item }: { item: Activity }) {
 const t=item.team!,navigate=useNavigate();
 const [busy,setBusy]=useState(false),[error,setError]=useState('');const lock=useRef(false);
 async function join(){
  if(lock.current)return;lock.current=true;setBusy(true);setError('');
  try{await joinTeam(item.slug,t.id,undefined,undefined,t.invite_token);navigate(`/campaign/${encodeURIComponent(item.slug)}/teams?selected=${encodeURIComponent(t.id)}`);}
  catch(e){setError(e instanceof Error?e.message:'Could not join team.');}finally{lock.current=false;setBusy(false);}
 }
 return <div className="post-result team-post-card">
  <div className="team-post-heading"><div className="following-identity"><span className="avatar team-avatar" style={{background:/^#[0-9a-f]{6}$/i.test(t.color)?t.color:undefined}}><Users size={18}/></span><div><strong>{t.name}</strong><p className="small muted">{item.name} · {t.players.toLocaleString()} players</p></div></div><span className="eyebrow">TEAM REPORT</span></div>
  <div className="team-post-stats"><div><small>Team rank</small><strong>{t.rank>0?`#${t.rank}`:'—'}</strong></div><div><small>Team game points</small><strong>{t.score.toLocaleString()}</strong></div><div><small>Author’s contribution</small><strong>{t.contribution.toLocaleString()}</strong></div><div><small>Author’s team rank</small><strong>{t.member_rank>0?`#${t.member_rank}`:'—'}</strong></div></div>
  <div className="team-post-footer"><small className="muted">Snapshot · {new Date(t.as_of).toLocaleString()}</small>
  {item.team_action==='join'&&<button className="btn btn-primary" disabled={busy} onClick={()=>void join()}>{busy?'Joining…':'Join team'}</button>}
  {item.team_action==='guest'&&<Link className="btn btn-primary" to={`/invite/${encodeURIComponent(t.invite_token)}`}>Sign in to join team</Link>}
  {item.team_action==='own'&&<Link className="btn btn-secondary" to={`/campaign/${encodeURIComponent(item.slug)}/teams?selected=${encodeURIComponent(t.id)}`}>View my team</Link>}
  {item.team_action==='expired'&&<small className="muted">Invitation no longer available.</small>}
  </div>
  {error&&<p role="alert">{error}</p>}
 </div>;
}
