import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { api } from "../lib/api";
import { useApp } from "../state";
import { CampaignPicker } from "../components/CampaignPicker";
import { LeaderboardScope } from "../components/LeaderboardScope";
import { UserAvatar } from "../components/UserAvatar";

export type PointsRank = { id: string; rank: number; points: number; display_name: string; avatar_url?: string };
export type PointsLeaderboardData = { players: PointsRank[]; mine?: PointsRank; as_of: string };

export function validPointsLeaderboard(data: PointsLeaderboardData): boolean {
  return !!data && Array.isArray(data.players) && data.players.length <= 100 &&
    Number.isFinite(Date.parse(data.as_of)) &&
    [...data.players, ...(data.mine ? [data.mine] : [])].every((row) =>
      row && typeof row.id === "string" && typeof row.display_name === "string" &&
      Number.isSafeInteger(row.rank) && row.rank > 0 &&
      Number.isSafeInteger(row.points) && row.points > 0 &&
      (row.avatar_url === undefined || typeof row.avatar_url === "string"));
}

export default function PointsLeaderboard() {
  const app = useApp();
  const navigate = useNavigate();
  const [picker, setPicker] = useState(false);
  const [data, setData] = useState<PointsLeaderboardData>();
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const userId = app.user?.id;
  const refresh = useCallback(() => setRetry((n) => n + 1), []);

  useEffect(() => {
    document.title = "P2L Points leaderboard · PLAY TO LAUNCH";
    setData(undefined);
  }, [userId]);
  useEffect(() => {
    const ctrl = new AbortController();
    let inFlight = false;
    async function load() {
      if (inFlight || document.visibilityState === "hidden") return;
      inFlight = true;
      setBusy(true);
      try {
        const result = userId
          ? await api.authenticated<PointsLeaderboardData>("/points/leaderboard/me", undefined, ctrl.signal)
          : await api.request<PointsLeaderboardData>("/points/leaderboard", undefined, { signal: ctrl.signal });
        if (!validPointsLeaderboard(result)) throw new Error("Invalid points leaderboard response.");
        if (!ctrl.signal.aborted) { setData(result); setError(""); }
      } catch (e) {
        if (!ctrl.signal.aborted) setError(e instanceof Error ? e.message : "Points leaderboard unavailable.");
      } finally {
        inFlight = false;
        if (!ctrl.signal.aborted) setBusy(false);
      }
    }
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    const resume = () => void load();
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    return () => { ctrl.abort(); window.clearInterval(timer); window.removeEventListener("focus", resume); document.removeEventListener("visibilitychange", resume); };
  }, [userId, retry]);

  return <section className="rankings-page points-leaderboard-page">
    {picker && <CampaignPicker purpose="leaderboard" close={() => setPicker(false)} choose={(campaign) => { setPicker(false); navigate(`/campaign/${campaign.slug}/leaderboard`); }} />}
    <div className="rankings-heading">
      <div>
        <span className="eyebrow">PLATFORM-WIDE STANDINGS</span>
        <h1>P2L Points leaderboard</h1>
        <p className="rankings-rule">Points earned across P2L. Separate from every campaign's game score and team score.</p>
      </div>
      <div className="rankings-update">
        <button className="btn btn-secondary" disabled={busy} onClick={refresh}><RefreshCw size={16} className={busy ? "rankings-spinning" : ""} aria-hidden="true" />Refresh</button>
        <small>{data ? `Updated ${new Date(data.as_of).toLocaleString()}` : "Waiting for standings"}</small>
      </div>
    </div>
    <LeaderboardScope chooseCampaign={() => setPicker(true)} />
    <div className="points-board-summary"><strong>P2L Points · Top 100</strong><span>Platform participation points—not a token allocation or campaign score.</span></div>
    {app.user ? <div className="rankings-own"><span>Your P2L Points standing</span><strong>{data?.mine ? `#${data.mine.rank} · ${data.mine.points.toLocaleString()} P2L Points` : busy && !data ? "Loading standing…" : "Not ranked yet"}</strong></div>
      : <div className="rankings-own"><span>See your standing</span><button className="text-link" onClick={() => app.setAuthOpen(true)}>Sign in</button></div>}
    {error && <div className="notice" role="alert">{error}{data ? " Showing the last successful snapshot." : ""}<button className="text-link" onClick={refresh}>Retry</button></div>}
    {busy && !data && <p className="rankings-loading" role="status">Loading P2L Points leaderboard…</p>}
    {!busy && !data && <div className="empty-panel"><p>Could not load the leaderboard.</p><button className="btn btn-secondary" onClick={refresh}>Retry</button></div>}
    {data && <ol className="points-rank-list" aria-label="P2L Points standings">
      {data.players.map((row) => <li key={row.id} className={`points-rank-row${row.rank <= 3 ? ` place-${row.rank}` : ""}${row.id === userId ? " is-mine" : ""}`}>
        <span className="points-rank-place">#{row.rank}</span>
        <Link to={`/players/${encodeURIComponent(row.id)}`} className="points-rank-player">
          <span className="avatar player-avatar" aria-hidden="true"><UserAvatar name={row.display_name} src={row.avatar_url} /></span>
          <span>{row.display_name}{row.id === userId && <small>You</small>}</span>
        </Link>
        <strong>{row.points.toLocaleString()} <small>pts</small></strong>
      </li>)}
      {!data.players.length && <li className="points-rank-empty">No P2L Points have been earned yet. <Link to="/tasks">Explore points tasks</Link></li>}
    </ol>}
  </section>;
}
