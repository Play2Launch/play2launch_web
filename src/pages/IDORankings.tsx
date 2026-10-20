import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import type { PublicCampaign } from "../lib/catalog";
import { CampaignNav, CampaignIdentityCard } from "../components/CampaignHeader";
import { LeaderboardScope } from "../components/LeaderboardScope";
import { useApp } from "../state";

export const rankingMetrics = [
  ["total_score", "Highest score", "Score"],
  ["winning_combo", "Winning combo", "Longest winning combo"],
  ["losing_combo", "Losing combo", "Longest losing combo"],
] as const;
type Row = { id: string; score: number; display_name?: string; achieved_at: string };
type Rankings = { metric: { key: string }; players: Row[]; as_of: string };
export default function IDORankings({ campaign }: { campaign: PublicCampaign }) {
  const { user } = useApp();
  const [metric, setMetric] = useState<string>("total_score");
  const [data, setData] = useState<Rankings>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);
  const selected = rankingMetrics.find(m => m[0] === metric)!;
  useEffect(() => {
    document.title = `${campaign.name} · Rankings · PLAY TO LAUNCH`;
    const ctrl = new AbortController();
    let pending = false;
    setData(undefined); setError("");
    async function refresh() {
      if (pending || document.visibilityState === "hidden") return;
      pending = true; setBusy(true);
      try {
        const result = await api.request<Rankings>(`/campaigns/${encodeURIComponent(campaign.slug)}/metric-rankings/${metric}`, undefined, { signal: ctrl.signal });
        if (result.metric?.key !== metric || !Array.isArray(result.players) || result.players.length > 100 ||
            !result.players.every(r => typeof r.id === "string" && Number.isSafeInteger(r.score) && r.score >= 0) || !Number.isFinite(Date.parse(result.as_of))) throw new Error("Invalid rankings response.");
        if (!ctrl.signal.aborted) { setData(result); setError(""); }
      } catch (e) { if (!ctrl.signal.aborted) setError(e instanceof Error ? e.message : "Could not load rankings."); }
      finally { pending = false; if (!ctrl.signal.aborted) setBusy(false); }
    }
    void refresh();
    const timer = setInterval(() => void refresh(), 10000);
    const resume = () => void refresh();
    document.addEventListener("visibilitychange", resume);
    return () => { ctrl.abort(); clearInterval(timer); document.removeEventListener("visibilitychange", resume); };
  }, [campaign.slug, campaign.name, metric, version]);
  const identity = { ...campaign, id: campaign.slug };
  const rows = data?.players || [];
  const own = rows.findIndex(r => r.id === user?.id);
  const value = (n: number) => metric === "total_score" ? `${n.toLocaleString()} pts` : `×${n}`;
  return <section className="rankings-page">
    <CampaignNav campaign={identity} live activeTab="leaderboard" />
    <CampaignIdentityCard campaign={identity} />
    <LeaderboardScope campaign={campaign} />
    <div className="tabs rankings-tabs ido-ranking-tabs" aria-label="Leaderboard metric">
      {rankingMetrics.map(([key, label]) => <button key={key} aria-pressed={metric === key} className={metric === key ? "selected" : ""} onClick={() => setMetric(key)}>{label}</button>)}
    </div>
    <div className="rankings-heading"><div><span className="eyebrow">MARKET COMBO</span><h2>{selected[2]}</h2></div><button className="btn btn-secondary" disabled={busy} onClick={() => setVersion(v => v + 1)}>Refresh rankings</button></div>
    <p className="rankings-rule">Each leaderboard uses your best valid result for that metric. Your highest score determines your rebate, independently of rank.</p>
    {error && <p role="alert">{error}</p>}
    {busy && !data && <p role="status">Loading rankings…</p>}
    {user && <div className="rankings-own"><span>Your standing</span><strong>{!data ? "—" : own >= 0 ? `#${own + 1} · ${value(rows[own].score)}` : "Not in the top 100"}</strong></div>}
    {data && !rows.length && <div className="empty-panel">No valid completed games yet.</div>}
    {!!rows.length && <>
      <div className="rankings-podium ido-podium">{rows.slice(0,3).map((r,i) => <article key={r.id} className={`rankings-podium-card place-${i+1}`}><span className="rankings-place">#{i+1}</span><span className="rankings-avatar player-avatar">{(r.display_name || "P").charAt(0).toUpperCase()}</span><h3><Link to={`/players/${encodeURIComponent(r.id)}`}>{r.display_name || `Player #${r.id}`}</Link></h3><strong>{value(r.score)}</strong></article>)}</div>
      <div className="rankings-table-wrap"><table className="rankings-table ido-rankings-table"><caption>{selected[2]} · Top {rows.length}</caption><thead><tr><th>Rank</th><th>Player</th><th>{metric === "total_score" ? "Score" : "Combo"}</th></tr></thead><tbody>{rows.map((r,i) => <tr key={r.id} className={r.id === user?.id ? "is-mine" : ""}><td>#{i+1}</td><th scope="row"><Link to={`/players/${encodeURIComponent(r.id)}`}>{r.display_name || `Player #${r.id}`}</Link>{r.id === user?.id && <span className="pill acid">YOU</span>}</th><td>{value(r.score)}</td></tr>)}</tbody></table></div>
    </>}
    {data && <p className="rankings-disclaimer">Updated {new Date(data.as_of).toLocaleTimeString()} · Refreshes every 10s · Server-verified results only.</p>}
  </section>;
}
