import { Link, useSearchParams } from 'react-router-dom';
import { Users } from 'lucide-react';
import type { ServerTeam } from '../lib/teams';
import { number } from '../data';
import { useEffect, useState } from 'react';
import { TeamMembers } from './TeamMembers';
import { api } from '../lib/api';

type DailyActivity = { active_today:number; rounds_today:number; as_of:string };

export function CommunityTeamCard({slug,team,joined}:{slug:string;team?:ServerTeam;joined:boolean}) {
  const [params]=useSearchParams();
  const myTeam=joined&&!!team&&team.team_type!=='system_community';
  const [showMembers,setShowMembers]=useState(!myTeam&&!!team&&params.get('selected')===team.id);
  const [activity,setActivity]=useState<DailyActivity>();
  const [activityError,setActivityError]=useState(false);
  const [retry,setRetry]=useState(0);
  useEffect(()=>{
    if(!myTeam||!team)return;
    const ctrl=new AbortController();setActivity(undefined);setActivityError(false);
    api.request<DailyActivity>(`/campaigns/${encodeURIComponent(slug)}/teams/${encodeURIComponent(team.id)}/activity`,undefined,{signal:ctrl.signal})
      .then(value=>{if(!value||![value.active_today,value.rounds_today].every(n=>Number.isSafeInteger(n)&&n>=0)||!Number.isFinite(Date.parse(value.as_of)))throw Error('Invalid team activity.');if(!ctrl.signal.aborted)setActivity(value);})
      .catch(()=>{if(!ctrl.signal.aborted)setActivityError(true);});
    return()=>ctrl.abort();
  },[myTeam,slug,team?.id,retry]);
  const today=myTeam?activity:team?.activity;
  return <section className="membership-card community-team-card" aria-label={myTeam?'My team activity':'P2L Community activity'}>
    <span className="eyebrow"><Users size={16}/>{myTeam?'MY TEAM · TODAY':<>OPEN COMMUNITY {joined&&'· YOUR COMMUNITY'}</>}</span>
    <h2>{myTeam?team.name:'P2L Community'}</h2>
    <p>{myTeam?'Your team’s activity in this campaign. See how many players scored for this team today and how many valid rounds they completed.':'Start playing without choosing a team. Your scores count toward your personal ranking, campaign progress and eligible P2L Points tasks. Join a captain’s team when you’re ready.'}</p>
    <div className="team-stats">
      <div><strong>{number(team?.players??0)}</strong><span>{myTeam?'Team players':'Community players'}</span></div>
      <div><strong>{today?number(today.active_today):'—'}</strong><span>Active today</span></div>
      <div><strong>{today?number(today.rounds_today):'—'}</strong><span>Valid rounds today</span></div>
    </div>
    <p className="small muted">{myTeam?'Today uses UTC and accepted rounds with a positive score. Team ranking score is based on members’ best accepted scores, not today’s round count.':'Activity only · Outside team rankings and team ranking rewards. Daily activity uses UTC and accepted rounds with a positive score.'}</p>
    {myTeam&&activityError&&<p className="small muted" role="status">Today’s activity is unavailable. <button className="text-link" onClick={()=>setRetry(v=>v+1)}>Retry</button></p>}
    <div className="community-team-actions">
    <Link className="btn btn-primary" to={`/campaign/${slug}/compete`}>Play ranked round</Link>
    {team&&<button className="btn btn-secondary" aria-expanded={showMembers} onClick={()=>setShowMembers(v=>!v)}>{showMembers?'Hide members':'View members'}</button>}
    </div>
    {team&&showMembers&&<TeamMembers key={team.id} slug={slug} team={team.id} community/>}
  </section>;
}
