import { formatTicker } from "../lib/ticker";
import { CampaignStatus } from "../components/CampaignStatus";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  Flame,
  Globe2,
  Layers3,
  LockKeyhole,
  Play,
  Search,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  campaigns,
  number,
  short,
  stageLabel,
  type Campaign,
} from "../data";
import { useEffect, useState } from "react";
import { useApp } from "../state";
import { CampaignArtwork } from "../components/CampaignArtwork";
import { PlatformVision } from "../components/PlatformVision";
import { ProfileTools } from "../components/ProfileTools";
import { walletAllowed } from "../lib/walletPolicy";
import { launchCopy, launchPlayers, launchPoints } from "../lib/launch";
import { api } from "../lib/api";

export default function Discover({
  liveCatalog,
  loading = false,
  failed = false,
}: { liveCatalog?: Campaign[]; loading?: boolean; failed?: boolean } = {}) {
  const [filter, setFilter] = useState(
    liveCatalog ? "All projects" : "Trending",
  );
  const [search, setSearch] = useState("");
  const app = useApp();
  const live = liveCatalog !== undefined;
  const catalog = liveCatalog ?? campaigns.map((c) => app.campaign(c.id)!);
  const getStage = (id: string) =>
    live
      ? catalog.find((c) => c.id === id)?.stage || "prelaunch"
      : app.getStage(id);
  const featured = catalog.find((c) => c.featured) || catalog[0];
  const [participation, setParticipation] = useState<{ players: number; teams: number }>();
  useEffect(() => {
    if (!live || !featured) return;
    const controller = new AbortController();
    const refresh = async () => {
      try {
        const data = await api.request<{ players: number; teams: number; campaign: string }>(
          `/campaigns/${encodeURIComponent(featured.id)}/participation`,
          undefined,
          { signal: controller.signal },
        );
        if (!Number.isSafeInteger(data.players) || data.players < 0 ||
            !Number.isSafeInteger(data.teams) || data.teams < 0 ||
            data.campaign !== featured.id) throw new Error("Invalid participation stats");
        if (!controller.signal.aborted) setParticipation({ players: data.players, teams: data.teams });
      } catch {
        if (!controller.signal.aborted) setParticipation(undefined);
      }
    };
    setParticipation(undefined);
    void refresh();
    const timer = window.setInterval(() => void refresh(), 3 * 60 * 1000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [live, featured?.id]);
  const featuredStage = featured ? getStage(featured.id) : "prelaunch";
  const filtered = catalog.filter(
    (c) =>
      `${c.name} ${c.ticker}`.toLowerCase().includes(search.toLowerCase()) &&
      (filter === "Launching soon"
        ? ["countdown", "ready"].includes(getStage(c.id))
        : filter === "Launched"
          ? getStage(c.id) === "live"
          : true),
  );
  const items = filter === "New arrivals" ? [...filtered].reverse() : filtered;
  return (
    <div className="discover-page">
      <div className="page-heading discover-heading">
        <div>
          <div className="eyebrow">THE NEXT WAVE STARTS HERE</div>
          <h1>
            Early looks good on you<span>.</span>
          </h1>
          <p>
            P2L is the social layer for discovering, validating, launching and trading new on-chain assets.
          </p>
          <a href="#campaigns" className="btn btn-primary discover-explore">
            Explore campaigns <ArrowRight size={18} aria-hidden="true" />
          </a>
        </div>
      </div>
      <section className="feature-grid">
        {featured ? (
          <Link
            to={
              live ||
              !walletAllowed(app.platform?.runtime) ||
              featuredStage === "prelaunch"
                ? `/campaign/${featured.id}`
                : `/campaign/${featured.id}/launch`
            }
            className="genesis-card"
          >
            <CampaignArtwork campaign={featured} variant="hero" />
            <div className="hero-shade" />
            <div className="genesis-content">
              <span className="eyebrow featured-label">
                <Zap size={12} />{" "}
                {live ? "FEATURED CAMPAIGN" : "P2L ORIGINAL #001"}
              </span>
              <div className="hero-title">
                {featured.id === "phood" ? (
                  <>
                    PAPER
                    <br />
                    HOOD<span>↘</span>
                  </>
                ) : (
                  featured.name
                )}
              </div>
              <p>
                {featured.id === "phood" ? (
                  <>
                    Buy high. Sell low.
                    <br />
                    Your worst trade is your best move.
                  </>
                ) : (
                  featured.description
                )}
              </p>
              <div className="btn btn-primary">
                {live
                  ? "Explore campaign"
                  : featuredStage === "prelaunch"
                    ? "Play to unlock"
                    : launchCopy[featuredStage].action}{" "}
                <ArrowUpRight size={18} />
              </div>
            </div>
            <div className="genesis-bottom">
              <div>
                <div className="featured-campaign-status">
                  <span className="micro">{formatTicker(featured.ticker)}</span>
                  <CampaignStatus stage={featuredStage} />
                </div>
                <div>
                  <strong>
                    {live
                      ? featured.unlockPoints === undefined
                        ? "—"
                        : number(featured.unlockPoints)
                      : number(launchPoints(featured))}
                  </strong>
                  <span> / {number(featured.target)} unlock points</span>
                </div>
              </div>
              <div className="hero-progress">
                <div className="progress-track">
                  <i
                    style={{
                      width: live
                        ? `${Math.min(100, ((featured.unlockPoints ?? 0) / Math.max(featured.target, 1)) * 100)}%`
                        : `${Math.min((launchPoints(featured) / Math.max(featured.target, 1)) * 100, 100)}%`,
                    }}
                  />
                </div>
                <span>
                  {live
                    ? featured.unlockPoints === undefined
                      ? "PARTICIPATION —"
                      : featured.unlockPoints >= featured.target
                        ? "COMMUNITY GOAL REACHED"
                        : `${Math.floor((featured.unlockPoints / Math.max(featured.target, 1)) * 100)}% COMPLETE`
                    : featuredStage === "prelaunch"
                      ? `${Math.round(((featured.unlockPoints ?? 0) / Math.max(featured.target, 1)) * 100)}% TO LAUNCH`
                      : stageLabel(featuredStage)}{" "}
                  {featuredStage === "prelaunch" ? (
                    <LockKeyhole size={12} />
                  ) : (
                    <Sparkles size={12} />
                  )}
                </span>
              </div>
            </div>
          </Link>
        ) : (
          <div className="genesis-card catalog-placeholder">
            <div className="genesis-content">
              <span className="eyebrow">PLAY FIRST. LAUNCH TOGETHER.</span>
              <h2>
                {loading
                  ? "Loading campaigns…"
                  : failed
                    ? "Campaigns unavailable"
                    : "The next wave is coming."}
              </h2>
              <p>Discover new projects as they go live.</p>
            </div>
          </div>
        )}
        <div className="side-feature">
          <div className="eyebrow">
            <Flame size={16} /> THE COMMUNITY IS THE CATALYST
          </div>
          <h2>
            Don’t just watch
            <br />
            the next launch.
            <br />
            <em>Make it happen.</em>
          </h2>
          <p>
            Every play brings a project closer.
            <br />
            Every team makes the difference.
          </p>
          <div className="steps">
            <span>01 / PLAY</span>
            <ArrowRight size={14} />
            <span>02 / TEAM UP</span>
            <ArrowRight size={14} />
            <span>03 / LAUNCH</span>
          </div>
          <div className="side-stats">
            <div>
              <strong>{live ? participation ? number(participation.players) : "—" : "48.5K"}</strong>
              <span>Early players</span>
            </div>
            <div>
              <strong>{live ? participation ? number(participation.teams) : "—" : "115"}</strong>
              <span>Teams in motion</span>
            </div>
          </div>
          {live ? (
            <Link to="/teams" className="text-link">
              Find your people <ArrowUpRight size={16} />
            </Link>
          ) : (
            <Link to="/teams" className="text-link">
              Find your people <ArrowUpRight size={16} />
            </Link>
          )}
        </div>
      </section>
      <PlatformVision />
      <section className="section" id="campaigns" aria-label="Campaigns">
        <div className="section-heading">
          <h2>
            <Flame size={22} className="accent" /> Pre-launch radar{" "}
            <span className="count">
              {String(items.length).padStart(2, "0")}
            </span>
          </h2>
          <span className="muted">Attention before liquidity.</span>
        </div>
        <div className="filter-row">
          <div className="tabs">
            {[
              ...(live ? ["All projects"] : ["Trending", "New arrivals"]),
              "Launching soon",
              "Launched",
            ].map((t) => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={filter === t ? "selected" : ""}
                aria-pressed={filter === t}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="search-field">
            <Search size={16} />
            <input
              aria-label="Search campaigns"
              placeholder={live ? "Search loaded projects" : "Search projects"}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <span>⌕</span>
          </div>
        </div>
        <div className="campaign-grid">
          {items.map((c) => (
            <Link key={c.id} to={`/campaign/${c.id}`} className="campaign-card">
              <div className={`card-art art-${c.id}`}>
                <CampaignArtwork campaign={c} variant="cover" />
                <CampaignStatus stage={getStage(c.id)} />
                <span className="art-index">
                  0{catalog.findIndex((item) => item.id === c.id) + 1} / GENESIS
                </span>
              </div>
              <div className="card-body">
                <div className="card-title">
                  <h3>{c.name}</h3>
                  <span>{formatTicker(c.ticker)}</span>
                </div>
                <div className="card-category">{c.category}</div>
                <div className="card-metrics">
                  <span>
                    <Users size={14} />
                    {live
                      ? c.unlockPoints === undefined
                        ? "—"
                        : number(c.unlockPoints)
                      : short(launchPlayers(c, getStage(c.id)))}{" "}
                    {live ? "unlock points" : "players"}
                  </span>
                  <span className="accent">
                    {live ? "—" : `+${c.growth}%`} <ArrowUpRight size={12} />
                  </span>
                </div>
                <div className="progress-track">
                  <i
                    style={{
                      width: live
                        ? `${Math.min(100, ((c.unlockPoints ?? 0) / Math.max(c.target, 1)) * 100)}%`
                        : `${Math.min((launchPoints(c) / Math.max(c.target, 1)) * 100, 100)}%`,
                      background: c.color,
                    }}
                  />
                </div>
                <div className="card-bottom">
                  <span>
                    {live
                      ? c.unlockPoints === undefined
                        ? "Participation —"
                        : c.unlockPoints >= c.target
                          ? "Community goal reached"
                          : `${Math.floor((c.unlockPoints / Math.max(c.target, 1)) * 100)}% complete`
                      : getStage(c.id) !== "prelaunch"
                        ? "Community unlocked"
                        : `${Math.round(((c.unlockPoints ?? 0) / Math.max(c.target, 1)) * 100)}% to launch`}
                  </span>
                  <span>
                    Launch score <b>{live ? "—" : c.score}</b>
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
        {!items.length && !loading && !failed && (
          <div className="empty-panel">
            <Search />
            <h3>
              {live && !catalog.length
                ? "No published campaigns yet"
                : "No projects found"}
            </h3>
            <p>Try a different name or explore all campaigns.</p>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setSearch("");
                setFilter(live ? "All projects" : "Trending");
              }}
            >
              Clear filters
            </button>
          </div>
        )}
      </section>
      <ProfileTools compact />
    </div>
  );
}
