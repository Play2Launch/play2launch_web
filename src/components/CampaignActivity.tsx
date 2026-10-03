import { Link } from 'react-router-dom';
import { ArrowUpRight, Clock } from 'lucide-react';
import type { Activity } from './ActivityFeed';

export type CampaignEvent = 'started' | 'ending_24h' | 'ending_1h' | 'scoring_ended';
const titles: Record<CampaignEvent, string> = {
 started: 'Campaign scoring is open.',
 ending_24h: 'The final 24 hours of scoring.',
 ending_1h: 'The final hour of scoring.',
 scoring_ended: 'Campaign scoring has ended.',
};
export function CampaignActivity({item}:{item:Activity}) {
 const ended=item.event==='scoring_ended';
 return <>
  <header><span className="eyebrow"><Clock size={15}/> CAMPAIGN UPDATE</span><time className="small muted" dateTime={item.at}>{new Date(item.at).toLocaleString()}</time></header>
  <Link className="activity-campaign" to={`/campaign/${encodeURIComponent(item.slug)}`}>{item.name}</Link>
  <h2>{titles[item.event!]}</h2>
  <p>{ended ? 'Scoring is closed. View the leaderboard; these are not confirmed final results or a reward announcement.' : 'Play, contribute your score and take part in the campaign.'}</p>
  <p className="small muted">{ended?'Scoring closed':'Scheduled scoring deadline'}: {new Date(item.scoring_ends_at!).toLocaleString()} · Schedule at time of posting</p>
  <Link className="text-link" to={`/campaign/${encodeURIComponent(item.slug)}${ended?'/leaderboard':''}`}>{ended?'View leaderboard':'View campaign'} <ArrowUpRight size={16}/></Link>
 </>;
}
