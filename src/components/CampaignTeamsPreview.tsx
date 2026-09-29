import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Users } from 'lucide-react';
import { api } from '../lib/api';
import { listTeams, type ServerTeam } from '../lib/teams';
import { number, short } from '../data';

type Ranking = { id: string; score: number };
type Preview = { team: ServerTeam; score?: number; rank?: number };

export function CampaignTeamsPreview({ slug }: { slug: string }) {
  return <PreviewContent key={slug} slug={slug} />;
}

function PreviewContent({ slug }: { slug: string }) {
  const [rows, setRows] = useState<Preview[]>();
  const [error, setError] = useState(false);
  const [automated, setAutomated] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const ctrl = new AbortController();
    let busy = false;
    async function refresh() {
      if (busy || ctrl.signal.aborted || document.visibilityState === 'hidden') return;
      busy = true;
      try {
        const [teams, snapshot] = await Promise.all([
          listTeams(slug, ctrl.signal),
          api.request<{ teams: Ranking[]; includes_auto_players?: boolean }>(
            `/campaigns/${encodeURIComponent(slug)}/rankings`, undefined, { signal: ctrl.signal },
          ),
        ]);
        if (!snapshot || !Array.isArray(snapshot.teams) || !snapshot.teams.every(r =>
          r && typeof r.id === 'string' && Number.isSafeInteger(r.score) && r.score >= 0,
        ) || new Set(snapshot.teams.map(r => r.id)).size !== snapshot.teams.length) throw new Error('Invalid rankings');
        const available = new Map(teams.filter(t=>t.team_type!=='system_community').map(t => [t.id, t]));
        const preview: Preview[] = [];
        snapshot.teams.forEach((r, i) => {
          const team = available.get(r.id);
          if (team) { preview.push({ team, score: r.score, rank: i + 1 }); available.delete(r.id); }
        });
        for (const team of available.values()) preview.push({ team });
        if (!ctrl.signal.aborted) {
          setRows(preview.slice(0, 3));
          setAutomated(snapshot.includes_auto_players === true);
          setError(false);
        }
      } catch {
        if (!ctrl.signal.aborted) setError(true);
      } finally { busy = false; }
    }
    void refresh();
    const resume = () => void refresh();
    const timer = window.setInterval(resume, 30000);
    window.addEventListener('focus', resume);
    document.addEventListener('visibilitychange', resume);
    return () => {
      ctrl.abort(); window.clearInterval(timer);
      window.removeEventListener('focus', resume);
      document.removeEventListener('visibilitychange', resume);
    };
  }, [slug, retry]);
  return <>
    {automated && <p className="small muted">Includes platform automated players. Simulated scores do not earn rewards or unlock progress.</p>}
    {error && <div className="notice" role="alert">
      <span>{rows ? 'Could not refresh. Showing last team snapshot.' : 'Campaign teams unavailable.'}</span>
      <button className="text-link" onClick={() => setRetry(n => n + 1)}>Retry teams</button>
    </div>}
    <div className="campaign-team-grid">
      {!rows && !error && <div className="empty-panel" role="status">Loading campaign teams…</div>}
      {rows?.length === 0 && <div className="empty-panel"><Users /><h3>No teams yet</h3><Link to={`/campaign/${slug}/teams`}>Explore team options</Link></div>}
      {rows?.map(({ team, score, rank }) => <Link key={team.id} className="team-tile" to={`/campaign/${slug}/teams?selected=${encodeURIComponent(team.id)}`}>
        <span className="eyebrow">{rank ? `#${rank} IN THE BATTLE` : 'JOIN THE BATTLE'}</span>
        <span className="avatar large" style={{ background: team.color }}>{team.initial}</span>
        <h3>{team.name}</h3>
        <span className="muted">{number(team.players)} players</span>
        <div className="team-tile-bottom"><strong title={score === undefined ? undefined : `${number(score)} points`}>{score === undefined ? 'No scores yet' : short(score)}</strong><ArrowUpRight size={18} /></div>
      </Link>)}
    </div>
  </>;
}
