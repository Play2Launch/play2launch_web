import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Users } from "lucide-react";
import { api } from "../lib/api";
import { listTeams, type ServerTeam } from "../lib/teams";
import { number, short } from "../data";
import { TeamBadge } from './TeamBadge';
import { TeamAvatarImage } from './TeamAvatarImage';

type Entry = { id: string; score: number; team?: ServerTeam };

export function FeaturedTeams({ slug, name }: { slug: string; name: string }) {
  const [rows, setRows] = useState<Entry[]>();
  const [automated,setAutomated]=useState(false);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const ctrl = new AbortController();
    let busy = false;
    async function refresh() {
      if (busy || ctrl.signal.aborted || document.visibilityState === "hidden")
        return;
      busy = true;
      try {
        const [snapshot, teams] = await Promise.all([
          api.request<{ teams: Entry[]; includes_auto_players?: boolean }>(
            `/campaigns/${encodeURIComponent(slug)}/rankings`,
            undefined,
            { signal: ctrl.signal },
          ),
          listTeams(slug, ctrl.signal),
        ]);
        if (
          !snapshot ||
          !Array.isArray(snapshot.teams) ||
          snapshot.teams.length > 100 ||
          !snapshot.teams.every(
            (r) =>
              r &&
              /^tm[0-9a-z]{1,13}$/.test(r.id) &&
              Number.isSafeInteger(r.score) &&
              r.score >= 0,
          )
        )
          throw new Error("Invalid rankings");
        if (!ctrl.signal.aborted) {
          setAutomated(snapshot.includes_auto_players===true);
          setRows(
            snapshot.teams
              .slice(0, 3)
              .map((r) => ({ ...r, team: teams.find((t) => t.id === r.id) })),
          );
          setError(false);
        }
      } catch {
        if (!ctrl.signal.aborted) setError(true);
      } finally {
        busy = false;
      }
    }
    void refresh();
    const timer = setInterval(() => void refresh(), 10000);
    const resume = () => void refresh();
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      ctrl.abort();
      clearInterval(timer);
      window.removeEventListener("focus", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [slug, retry]);
  return (
    <>
      <div className="mini-table-head">
        <span>TOP TEAMS / {name}</span>
        <span>TEAM SCORE</span>
      </div>
      {automated && <p className="small muted">Includes platform automated players. Simulated scores do not earn rewards or unlock progress.</p>}
      {error && (
        <div className="notice" role="alert">
          <span>
            {rows
              ? "Could not refresh. Showing last standings."
              : "Team rankings unavailable."}
          </span>
          <button className="text-link" onClick={() => setRetry((n) => n + 1)}>
            Retry team rankings
          </button>
        </div>
      )}
      {!rows && !error && (
        <div className="empty-panel" role="status">
          Loading top teams…
        </div>
      )}
      {rows?.length === 0 && (
        <div className="empty-panel">
          <Users />
          <h3>No scores yet</h3>
          <p>Play for your team to make the first move.</p>
        </div>
      )}
      {rows?.map((r, i) => (
        <Link
          to={`/campaign/${slug}/teams?selected=${encodeURIComponent(r.id)}`}
          key={r.id}
          className="mini-team"
        >
          <span className="rank">0{i + 1}</span>
          <span className="avatar team-avatar" style={{ background: r.team?.color }}>
            <TeamAvatarImage url={r.team?.avatar_url} initial={r.team?.initial || "T"}/>
            <TeamBadge />
          </span>
          <span className="team-name">
            <strong>{r.team?.name || r.id}</strong>
            <small>
              {r.team
                ? `${number(r.team.players)} players`
                : "Team details unavailable"}
            </small>
          </span>
          <span
            className="team-total"
            title={`${r.score.toLocaleString()} points`}
          >
            {short(r.score)}
          </span>
          <ArrowUpRight size={16} className="accent" />
        </Link>
      ))}
      <Link className="text-link" to={`/campaign/${slug}/leaderboard`}>
        View full leaderboard <ArrowUpRight size={16} />
      </Link>
    </>
  );
}
