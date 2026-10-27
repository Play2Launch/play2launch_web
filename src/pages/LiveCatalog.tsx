import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import {
  getCampaign,
  listCampaigns,
  type PublicCampaign,
} from "../lib/catalog";
import type { Campaign } from "../data";
import Discover from "./Discover";
import { CampaignPage } from "./Campaign";

// Numeric compatibility fields are never displayed in Live views.
function presentation(c: PublicCampaign): Campaign {
  return {
    ...c,
    target: c.unlock_target ?? 0,
    id: c.slug,
    players: 0,
    teams: 0,
    growth: 0,
    score: 0,
  };
}
export default function LiveCatalog() {
  const { id } = useParams();
  return <CatalogContent key={id || "list"} slug={id} />;
}
function CatalogContent({ slug }: { slug?: string }) {
  const [items, setItems] = useState<PublicCampaign[]>([]);
  const [after, setAfter] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [statsError, setStatsError] = useState(false);
  const [statsRetry, setStatsRetry] = useState(0);
  const slugs = items.filter(c => !c.campaign_type || c.campaign_type === "play_to_launch").map((c) => c.slug).join(",");
  useEffect(() => {
    const controller = new AbortController();
    setStatsError(false);
    setCounts({});
    const visible = slugs ? slugs.split(",") : [];
    Promise.all(
      visible.map(async (id) => {
        try {
          const d = await api.request<{ unlock_points: number }>(
            `/campaigns/${id}/rankings`,
            undefined,
            { signal: controller.signal },
          );
          if (
            !d ||
            !Number.isSafeInteger(d.unlock_points) ||
            d.unlock_points < 0
          )
            throw new Error("Invalid count");
          if (!controller.signal.aborted)
            setCounts((prev) => ({ ...prev, [id]: d.unlock_points }));
        } catch {
          if (!controller.signal.aborted) setStatsError(true);
        }
      }),
    );
    return () => controller.abort();
  }, [slugs, statsRetry]);
  const present = (c: PublicCampaign): Campaign => ({
    ...presentation(c),
    unlockPoints: counts[c.slug],
  });
  useEffect(() => {
    const controller = new AbortController();
    setBusy(true);
    setError("");
    const request = slug
      ? getCampaign(slug, controller.signal).then((c) => ({
          items: [c],
          next_cursor: "",
        }))
      : listCampaigns(after, controller.signal);
    request
      .then((page) => {
        if (controller.signal.aborted) return;
        setItems((previous) =>
          after
            ? [
                ...previous,
                ...page.items.filter(
                  (c) => !previous.some((p) => p.id === c.id),
                ),
              ]
            : page.items,
        );
        setNext(page.next_cursor === after ? "" : page.next_cursor);
      })
      .catch((err) => {
        if (!controller.signal.aborted)
          setError(
            err instanceof ApiError && err.status === 404
              ? "This campaign is unavailable or no longer published."
              : "Campaigns could not be loaded. Check the server connection and retry.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [slug, after, retry]);
  const visibleIDs = items.map(c=>c.slug).join(',');
  useEffect(()=>{
    if(!visibleIDs)return;
    const controller=new AbortController();
    let refreshing=false;
    const timer=setInterval(()=>{
      if(refreshing)return;
      refreshing=true;
      void Promise.all(visibleIDs.split(',').map(id=>getCampaign(id,controller.signal).catch(()=>null))).then(rows=>{
        if(!controller.signal.aborted)setItems(previous=>previous.map(c=>rows.find(r=>r?.id===c.id) ?? c));
      }).finally(()=>{refreshing=false});
    },20000);
    return()=>{controller.abort();clearInterval(timer)};
  },[visibleIDs]);
  const selected = slug ? items[0] : undefined;
  useEffect(() => {
    if (selected) document.title = `${selected.name} · PLAY TO LAUNCH`;
  }, [selected]);
  return (
    <section aria-busy={busy}>
      {busy && <p role="status">Loading campaigns…</p>}
      {statsError && (
        <div className="notice" role="status">
          Some campaign progress is unavailable.{" "}
          <button onClick={() => setStatsRetry((n) => n + 1)}>
            Retry progress
          </button>
        </div>
      )}
      {error && (
        <div className="notice" role="alert">
          <span>{error}</span>
          <button onClick={() => setRetry((n) => n + 1)}>
            Retry campaigns
          </button>
        </div>
      )}
      {slug ? (
        selected ? (
          <CampaignPage liveCampaign={present(selected)} liveCampaignId={selected.id} />
        ) : (
          <div className="empty-panel">
            <Link to="/">All campaigns</Link>
            {!busy && <h1>Campaign unavailable</h1>}
          </div>
        )
      ) : (
        <Discover
          liveCatalog={items.map(present)}
          loading={busy}
          failed={!!error}
        />
      )}
      {!slug && next && !error && (
        <button
          className="btn btn-secondary"
          disabled={busy}
          onClick={() => setAfter(next)}
        >
          Load more campaigns
        </button>
      )}
    </section>
  );
}
