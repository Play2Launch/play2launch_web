import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useApp } from "../state";
import { UserAvatar } from "./UserAvatar";
import { number } from "../data";

type Member = {id:string;display_name?:string;handle?:string;avatar_url?:string;kol_verified?:boolean;captain:boolean;position:number;score:number;contribution:number};
type Page = {items:Member[];total:number;team_score:number;next_cursor:string};
export type TeamScoreSummary = {slug:string;team:string;score:number|undefined};
export function TeamMembers({slug,team,community=false,onSummary}:{slug:string;team:string;community?:boolean;onSummary?:(summary:TeamScoreSummary)=>void}) {
  const app=useApp();
  const [rows,setRows]=useState<Member[]>([]);
  const [page,setPage]=useState<Page>();
  const [after,setAfter]=useState("");
  const [busy,setBusy]=useState(true);
  const [error,setError]=useState("");
  const [retry,setRetry]=useState(0);
  useEffect(()=>{onSummary?.({slug,team,score:page?.team_score});},[slug,team,page,onSummary]);
  useEffect(()=>{
    const ctrl=new AbortController(); setBusy(true);setError("");
    api.request<Page>(`/campaigns/${encodeURIComponent(slug)}/teams/${encodeURIComponent(team)}/members?after=${encodeURIComponent(after)}`,undefined,{signal:ctrl.signal})
      .then(v=>{if(ctrl.signal.aborted)return;if(!v||!Array.isArray(v.items)||![v.total,v.team_score].every(n=>Number.isSafeInteger(n)&&n>=0)||typeof v.next_cursor!=="string"||!v.items.every(m=>/^ur[0-9a-z]+$/.test(m.id)&&[m.position,m.score,m.contribution].every(n=>Number.isSafeInteger(n)&&n>=0)))throw new Error("Invalid member response.");setPage(v);setRows(prev=>after?[...prev,...v.items.filter(m=>!prev.some(p=>p.id===m.id))]:v.items);})
      .catch(e=>{if(!ctrl.signal.aborted)setError(e.message);})
      .finally(()=>{if(!ctrl.signal.aborted)setBusy(false);});
    return ()=>ctrl.abort();
  },[slug,team,after,retry]);
  return <section className="team-members" aria-label="Team members">
    <div className="section-heading"><h3>Members {page&&<span className="count">{number(page.total)}</span>}</h3>{page&&!community&&<span className="small muted">Team score <strong>{number(page.team_score)}</strong></span>}</div>
    <p className="small muted">Current members · Sorted by team contribution. Best score is personal; contribution is your best score played for this team. Historical contributions remain after a member leaves.</p>
    {error&&<div role="alert" className="notice">{error}<button onClick={()=>setRetry(n=>n+1)}>Retry members</button></div>}
    <div className="team-member-list">{rows.map(m=><Link key={m.id} to={`/players/${m.id}`} className={`team-member-row ${m.id===app.user?.id?"is-you":""}`}>
      <span className="muted">{m.position}</span>
      <span className="avatar player-avatar"><UserAvatar name={m.display_name||m.handle||"Player"} src={m.avatar_url}/></span>
      <span className="team-member-name"><strong>{m.display_name||m.handle||"Player"}</strong><span className="team-member-badges">{m.captain&&<small>CAPTAIN</small>}{m.kol_verified&&<small>KOL</small>}{m.id===app.user?.id&&<small>YOU</small>}</span>{m.handle&&<small className="muted">@{m.handle}</small>}</span>
      <span className="team-member-score"><small>Best score</small><strong>{number(m.score)}</strong></span>
      <span className="team-member-score"><small>Contribution</small><strong>{number(m.contribution)}</strong></span>
    </Link>)}</div>
    {busy&&<p role="status">Loading members…</p>}
    {!busy&&!error&&!rows.length&&<p className="muted">No members yet.</p>}
    {page?.next_cursor&&!error&&<button className="btn btn-secondary full" disabled={busy} onClick={()=>setAfter(page.next_cursor)}>Load more members</button>}
  </section>;
}
