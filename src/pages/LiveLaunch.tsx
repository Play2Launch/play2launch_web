import { CampaignStatus } from "../components/CampaignStatus";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getCampaign, type PublicCampaign } from "../lib/catalog";
import { api } from "../lib/api";


export default function LiveLaunch() {
  const { id = "" } = useParams();
  return <Launch key={id} slug={id} />;
}
function Launch({ slug }: { slug: string }) {
  const [campaign, setCampaign] = useState<PublicCampaign>(),
    [points, setPoints] = useState<number>(),
    [busy, setBusy] = useState(true),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    const ctrl = new AbortController();
    setBusy(true);
    setError("");
    setPoints(undefined);
    setCampaign(undefined);
    async function load() {
      try {
        const c = await getCampaign(slug, ctrl.signal);
        if (ctrl.signal.aborted) return;
        setCampaign(c);
        document.title = `${c.name} · Launch · PLAY TO LAUNCH`;
        const stats = await api.request<{ unlock_points: number | null }>(
          `/campaigns/${encodeURIComponent(slug)}/rankings`,
          undefined,
          { signal: ctrl.signal },
        );
        if (ctrl.signal.aborted) return;
        if (
          stats.unlock_points !== null &&
          (!Number.isSafeInteger(stats.unlock_points) ||
            stats.unlock_points < 0)
        )
          throw new Error("Invalid campaign progress.");
        setPoints(stats.unlock_points ?? undefined);
      } catch (e) {
        if (!ctrl.signal.aborted) {
          const unavailable =
            typeof e === "object" &&
            e !== null &&
            "status" in e &&
            e.status === 404;
          if (unavailable) setCampaign(undefined);
          setError(
            unavailable
              ? "This campaign is unavailable or no longer published."
              : e instanceof Error
                ? e.message
                : "Could not load campaign.",
          );
        }
      } finally {
        if (!ctrl.signal.aborted) setBusy(false);
      }
    }
    void load();
    return () => ctrl.abort();
  }, [slug, retry]);
  return (
    <section className="launch-surface">
      <Link to="/">Discover campaigns</Link>
      {busy && <p role="status">Loading launch status…</p>}
      {error && (
        <div className="notice" role="alert">
          {error}
          <button onClick={() => setRetry((n) => n + 1)}>Retry</button>
        </div>
      )}
      {campaign && (
        <>
          <CampaignStatus stage={campaign.stage} campaign={campaign}/>
          <h1>{campaign.name}</h1>
          <p>Play to Launch · Community goal</p>
          <div className="launch-progress">
            <strong>
              {points === undefined
                ? "Progress unavailable"
                : `${points.toLocaleString()} / ${(campaign.unlock_target ?? campaign.target).toLocaleString()} unlock points`}
            </strong>
          </div>
          <p>
            Unlock progress and the current stage come from the campaign.
            The goal is confirmed by the campaign administrator.
          </p>
          <p>
            Airdrop details will follow. See the
            campaign's official announcements.
          </p>
          <div className="launch-actions">
            <Link className="btn btn-primary" to={`/campaign/${campaign.slug}`}>
              View campaign
            </Link>
            <Link
              className="btn btn-secondary"
              to={`/campaign/${campaign.slug}/leaderboard`}
            >
              View leaderboard
            </Link>
          </div>
        </>
      )}
    </section>
  );
}
