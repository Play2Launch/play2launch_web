import { Link } from "react-router-dom";
import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, Trophy } from "lucide-react";

import { listCampaigns, recentCampaigns, type PublicCampaign } from "../lib/catalog";
import { safeImageSource } from "./CampaignArtwork";

type CampaignLink = Pick<PublicCampaign, "slug" | "name"> & Partial<Pick<PublicCampaign, "cover_image" | "hero_image" | "symbol" | "color">>;

function CampaignMenuItem({ item, current, onSelect }: { item: CampaignLink; current: boolean; onSelect: () => void }) {
  const source = safeImageSource(item.cover_image) ?? safeImageSource(item.hero_image);
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [source]);
  return <Link className={`leaderboard-campaign-option${current ? " is-current" : ""}`} aria-current={current ? "page" : undefined} to={`/campaign/${encodeURIComponent(item.slug)}/leaderboard`} onClick={onSelect}>
    <span className="leaderboard-campaign-option-fallback" style={{ color: item.color || "#d2fa69" }} aria-hidden="true">{item.symbol || item.name.charAt(0).toUpperCase()}</span>
    {source && !imageFailed && <img className="leaderboard-campaign-option-art" src={source} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setImageFailed(true)} />}
    <span className="leaderboard-campaign-option-shade" aria-hidden="true" />
    <span className="leaderboard-campaign-option-name">{item.name}</span>
    {current && <Check size={17} className="leaderboard-campaign-option-check" aria-hidden="true" />}
  </Link>;
}

function CampaignPicker({ campaign, recent, mobile }: { campaign?: CampaignLink; recent: PublicCampaign[]; mobile: boolean }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [after, setAfter] = useState("");
  const [next, setNext] = useState("");
  const [rows, setRows] = useState<PublicCampaign[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const wrapper = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const ctrl = new AbortController();
    setBusy(true);
    setError("");
    const timer = window.setTimeout(() => {
      listCampaigns(after, ctrl.signal, query).then((page) => {
        if (ctrl.signal.aborted) return;
        setRows((old) => after ? [...old, ...page.items.filter((item) => !old.some((previous) => previous.id === item.id))] : page.items);
        setNext(page.next_cursor);
      }).catch((reason) => {
        if (!ctrl.signal.aborted) setError(reason instanceof Error ? reason.message : "Could not load campaigns.");
      }).finally(() => {
        if (!ctrl.signal.aborted) setBusy(false);
      });
    }, 150);
    return () => { window.clearTimeout(timer); ctrl.abort(); };
  }, [open, query, after]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);

  const activeRecent = recent.some((item) => item.slug === campaign?.slug);
  const featured: CampaignLink[] = mobile && !query.trim()
    ? [...(campaign && !activeRecent ? [rows.find((item) => item.slug === campaign.slug) || campaign] : []), ...recent]
    : [];
  const visible = [...featured, ...rows.filter((item) =>
    !featured.some((featuredItem) => featuredItem.slug === item.slug)
    && (mobile || !recent.some((recentItem) => recentItem.slug === item.slug)))];
  const label = mobile ? campaign?.name || "Campaign scores" : "Other campaigns";

  return <div className={mobile ? "leaderboard-scope-mobile-switch" : "leaderboard-scope-more"} ref={wrapper}>
    <button ref={trigger} type="button" className={`leaderboard-scope-option${(mobile ? !!campaign : !!campaign && !activeRecent) ? " is-current" : ""}`} aria-current={mobile && campaign ? "page" : undefined} aria-expanded={open} aria-controls={menuId} onClick={() => setOpen((value) => !value)}>
      <span>{label}</span><ChevronDown size={16} aria-hidden="true" />
    </button>
    {open && <div id={menuId} className="leaderboard-scope-menu">
      <label>Find a campaign<input autoFocus={!mobile} type="search" value={query} placeholder="Name or symbol" onChange={(event) => { setQuery(event.target.value); setAfter(""); setNext(""); setRows([]); }} /></label>
      <div className="leaderboard-scope-results" aria-busy={busy}>
        {visible.map((item) => <CampaignMenuItem key={item.slug} item={item} current={item.slug === campaign?.slug} onSelect={() => setOpen(false)} />)}
        {busy && <p role="status">Loading campaigns…</p>}
        {error && <p role="alert">{error}</p>}
        {!busy && !error && !visible.length && <p>{mobile ? "No campaigns found." : "No other campaigns found."}</p>}
        {next && !error && <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setAfter(next)}>Load more</button>}
      </div>
    </div>}
  </div>;
}

export function LeaderboardScope({ campaign }: { campaign?: CampaignLink }) {
  const [recent, setRecent] = useState<PublicCampaign[]>([]);
  const [hasMore, setHasMore] = useState(false);
  useEffect(() => {
    const ctrl = new AbortController();
    recentCampaigns(ctrl.signal).then((result) => {
      if (!ctrl.signal.aborted) {
        setRecent(result.items.slice(0, 3));
        setHasMore(result.hasMore);
      }
    }).catch(() => { /* The searchable mobile campaign list remains available. */ });
    return () => ctrl.abort();
  }, []);

  return <nav className="leaderboard-scope" aria-label="Leaderboard scope">
    <div className="leaderboard-scope-main">
      {campaign
        ? <Link to="/leaderboard" className="leaderboard-scope-option"><Trophy size={16} aria-hidden="true" /><span>P2L Points</span></Link>
        : <span className="leaderboard-scope-option is-current" aria-current="page"><Trophy size={16} aria-hidden="true" /><span>P2L Points</span></span>}
      <CampaignPicker campaign={campaign} recent={recent} mobile />
    </div>
    <div className="leaderboard-scope-campaigns">
      {recent.map((item) => item.slug === campaign?.slug
        ? <span key={item.slug} className="leaderboard-scope-option is-current" aria-current="page" title={item.name}><span>{item.name}</span></span>
        : <Link key={item.slug} className="leaderboard-scope-option" to={`/campaign/${encodeURIComponent(item.slug)}/leaderboard`} title={item.name}><span>{item.name}</span></Link>)}
      {hasMore && <CampaignPicker campaign={campaign} recent={recent} mobile={false} />}
    </div>
  </nav>;
}
