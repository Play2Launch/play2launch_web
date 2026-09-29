import { Link } from 'react-router-dom';
import { Users } from 'lucide-react';
import type { ServerTeam } from '../lib/teams';
import { number } from '../data';

export function CommunityTeamCard({slug,team,joined}:{slug:string;team?:ServerTeam;joined:boolean}) {
  return <section className="membership-card community-team-card" aria-label="P2L Community activity">
    <span className="eyebrow"><Users size={16}/> OPEN COMMUNITY {joined&&'· YOUR COMMUNITY'}</span>
    <h2>P2L Community</h2>
    <p>Start playing without choosing a team. Your scores count toward your personal ranking, campaign progress and eligible P2L Points tasks. Join a captain’s team when you’re ready.</p>
    <div className="team-stats">
      <div><strong>{number(team?.players??0)}</strong><span>Community players</span></div>
      <div><strong>{number(team?.activity?.active_today??0)}</strong><span>Active today</span></div>
      <div><strong>{number(team?.activity?.rounds_today??0)}</strong><span>Valid rounds today</span></div>
    </div>
    <p className="small muted">Activity only · Outside team rankings and team ranking rewards. Daily activity uses UTC and accepted rounds with a positive score.</p>
    <Link className="btn btn-primary" to={`/campaign/${slug}/compete`}>Play ranked round</Link>
  </section>;
}
