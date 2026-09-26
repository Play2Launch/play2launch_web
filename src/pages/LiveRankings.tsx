import { useEffect, useRef, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { CampaignPicker } from "../components/CampaignPicker";
import { Trophy, RefreshCw, Users, ArrowUpRight } from "lucide-react";
import { api } from "../lib/api";
import {
  getCampaign,
  listCampaigns,
  type PublicCampaign,
} from "../lib/catalog";
import { listTeams, myMembership, type ServerTeam } from "../lib/teams";
import { useApp } from "../state";
import { safeImageSource } from "../components/CampaignArtwork";
import { stageLabel } from "../data";
import { VerifiedKol } from "../components/VerifiedKol";
type Rank = {
  id: string;
  score: number;
  team_id?: string;
  display_name?: string;
  handle?: string;
  kol_verified?: boolean;
  avatar_url?: string;
};
type Snapshot = {
  players: Rank[];
  teams: Rank[];
  qualified_players: number;
  unlock_points: number | null;
  as_of: string;
};
export function validRankings(d: Snapshot) {
  return (
    d &&
    Array.isArray(d.players) &&
    Array.isArray(d.teams) &&
    d.players.length <= 100 &&
    d.teams.length <= 100 &&
    [...d.players, ...d.teams].every(
      (r) =>
        r &&
        typeof r.id === "string" &&
        (r.display_name === undefined || typeof r.display_name === "string") &&
        (r.kol_verified === undefined || typeof r.kol_verified === "boolean") &&
        (r.handle === undefined ||
          (typeof r.handle === "string" &&
            (!r.handle || /^[a-z][a-z0-9_]{2,23}$/.test(r.handle)))) &&
        (r.avatar_url === undefined || typeof r.avatar_url === "string") &&
        Number.isSafeInteger(r.score) &&
        r.score >= 0,
    ) &&
    Number.isSafeInteger(d.qualified_players) &&
    d.qualified_players >= 0 &&
    Number.isFinite(Date.parse(d.as_of)) &&
    (d.unlock_points === null ||
      (Number.isSafeInteger(d.unlock_points) && d.unlock_points >= 0))
  );
}
export default function LiveRankings() {
  const { id } = useParams();
  return <Selection key={id || "catalog"} slug={id} />;
}
const missing = (e: unknown) =>
  typeof e === "object" && e !== null && "status" in e && e.status === 404;
function Selection({ slug }: { slug?: string }) {
  const [campaign, setCampaign] = useState<PublicCampaign>(),
    [busy, setBusy] = useState(true),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0),
    [picker, setPicker] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    if (!campaign) document.title = "Rankings · PLAY TO LAUNCH";
  }, [campaign]);
  useEffect(() => {
    const ctrl = new AbortController();
    setBusy(true);
    setError("");
    setCampaign(undefined);
    (slug
      ? getCampaign(slug, ctrl.signal)
      : listCampaigns("", ctrl.signal).then((p) => p.items[0])
    )
      .then((c) => {
        if (!ctrl.signal.aborted) setCampaign(c);
      })
      .catch((e) => {
        if (!ctrl.signal.aborted)
          setError(
            missing(e)
              ? "This campaign is unavailable or no longer published."
              : e.message || "Campaigns could not be loaded.",
          );
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setBusy(false);
      });
    return () => ctrl.abort();
  }, [slug, retry]);
  const unavailable = useRef(() => {});
  unavailable.current = () => {
    setCampaign(undefined);
    setError("This campaign is unavailable or no longer published.");
  };
  if (campaign)
    return (
      <Board
        key={campaign.slug}
        slug={campaign.slug}
        campaign={campaign}
        unavailable={() => unavailable.current()}
      />
    );
  return (
    <section className="rankings-page">
      <h1>Rankings</h1>
      {busy ? (
        <p role="status">Loading campaigns…</p>
      ) : (
        <div className="empty-panel">
          <p role={error ? "alert" : undefined}>
            {error || "No published campaigns yet."}
          </p>
          <button
            className="btn btn-secondary"
            onClick={() => setRetry((n) => n + 1)}
          >
            Retry
          </button>
          <button className="btn btn-secondary" onClick={() => setPicker(true)}>
            Switch campaign
          </button>
          <Link to="/">Discover campaigns</Link>
        </div>
      )}
      {picker && (
        <CampaignPicker
          purpose="leaderboard"
          close={() => setPicker(false)}
          choose={(c) => navigate(`/campaign/${c.slug}/leaderboard`)}
        />
      )}
    </section>
  );
}
function Board({
  slug,
  campaign,
  unavailable,
}: {
  slug: string;
  campaign: PublicCampaign;
  unavailable: () => void;
}) {
  const navigate = useNavigate();
  const [picker, setPicker] = useState(false);
  const app = useApp();
  const [teams, setTeams] = useState<ServerTeam[]>([]);
  const [data, setData] = useState<Snapshot>(),
    [kind, setKind] = useState<"players" | "teams">("players");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [metaError, setMetaError] = useState(""),
    [retry, setRetry] = useState(0);
  const [membership, setMembership] = useState<string>(),
    [memberError, setMemberError] = useState(false),
    [memberReady, setMemberReady] = useState(false);
  const [artFailed, setArtFailed] = useState(false);
  const reload = useRef<() => void>(() => {});
  const onUnavailable = useRef(unavailable);
  onUnavailable.current = unavailable;
  useEffect(() => {
    document.title = `${campaign.name} · Rankings · PLAY TO LAUNCH`;
  }, [campaign.name]);
  useEffect(() => {
    const ctrl = new AbortController();
    setMetaError("");
    listTeams(slug, ctrl.signal)
      .then((t) => {
        if (ctrl.signal.aborted) return;
        setTeams(t);
      })
      .catch((e) => {
        if (!ctrl.signal.aborted && missing(e)) {
          onUnavailable.current();
          return;
        }
        if (!ctrl.signal.aborted) setMetaError(e.message);
      });
    return () => ctrl.abort();
  }, [slug, retry]);
  useEffect(() => {
    const ctrl = new AbortController();
    setMembership(undefined);
    setMemberError(false);
    setMemberReady(false);
    if (app.user)
      myMembership(slug, ctrl.signal)
        .then((m) => {
          if (!ctrl.signal.aborted) {
            setMembership(m?.team_id);
            setMemberReady(true);
          }
        })
        .catch((e) => {
          if (!ctrl.signal.aborted && missing(e)) {
            onUnavailable.current();
            return;
          }
          if (!ctrl.signal.aborted) {
            setMemberError(true);
            setMemberReady(true);
          }
        });
    return () => ctrl.abort();
  }, [slug, app.user?.id, retry]);
  useEffect(() => {
    let stopped = false,
      inFlight = false;
    const ctrl = new AbortController();
    async function fetchRanks() {
      if (stopped || inFlight || document.visibilityState === "hidden") return;
      inFlight = true;
      setBusy(true);
      try {
        const d = await api.request<Snapshot>(
          `/campaigns/${encodeURIComponent(slug)}/rankings`,
          undefined,
          { signal: ctrl.signal },
        );
        if (!validRankings(d))
          throw new Error("Invalid rankings response. Please retry.");
        if (!stopped) {
          setData(d);
          setError("");
        }
      } catch (e) {
        if (!stopped && missing(e)) {
          stopped = true;
          ctrl.abort();
          onUnavailable.current();
          return;
        }
        if (!stopped)
          setError(
            e instanceof Error ? e.message : "Rankings could not be updated.",
          );
      } finally {
        inFlight = false;
        if (!stopped) setBusy(false);
      }
    }
    reload.current = () => {
      void fetchRanks();
    };
    void fetchRanks();
    const timer = setInterval(() => void fetchRanks(), 10000);
    const resume = () => void fetchRanks();
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("focus", resume);
    return () => {
      stopped = true;
      ctrl.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("focus", resume);
    };
  }, [slug]);
  const rows = data?.[kind] || [];
  const ownId = kind === "players" ? app.user?.id : membership;
  const ownIndex = ownId ? rows.findIndex((r) => r.id === ownId) : -1;
  const teamName = (id?: string) =>
    teams.find((t) => t.id === id)?.name || id || "No team";
  const label = (r: Rank) =>
    kind === "teams"
      ? teamName(r.id)
      : r.id === app.user?.id
        ? app.user.name
        : r.display_name || `Player #${r.id}`;
  const art = safeImageSource(campaign?.hero_image || campaign?.cover_image);
  const username = (r: Rank) => {
    const h = r.id === app.user?.id ? (app.user.handle ?? r.handle) : r.handle;
    return kind === "players" && h && /^[a-z][a-z0-9_]{2,23}$/.test(h)
      ? h
      : undefined;
  };
  function refresh() {
    setRetry((n) => n + 1);
    reload.current();
  }
  return (
    <section className="rankings-page">
      {picker && (
        <CampaignPicker
          purpose="leaderboard"
          close={() => setPicker(false)}
          choose={(c) => {
            setPicker(false);
            navigate(`/campaign/${c.slug}/leaderboard`);
          }}
        />
      )}
      <nav className="rankings-breadcrumb">
        <Link to="/">Discover</Link>
        <span>/</span>
        <Link to={`/campaign/${slug}`}>{campaign?.name || slug}</Link>
        <span>/ Leaderboard</span>
        <button className="btn btn-secondary" onClick={() => setPicker(true)}>
          Switch campaign
        </button>
      </nav>
      <header className="rankings-hero">
        <div className="rankings-art">
          {art && !artFailed ? (
            <img
              src={art}
              alt={campaign?.image_alt || ""}
              onError={() => setArtFailed(true)}
            />
          ) : (
            <Trophy size={48} />
          )}
        </div>
        <div>
          <span className="eyebrow">
            {campaign ? stageLabel(campaign.stage) : "CAMPAIGN"} / COMMUNITY
            STANDINGS
          </span>
          <h1>
            {campaign?.name || slug}
            <span>.</span>
          </h1>
          <p>Every best score counts. Every team moves together.</p>
        </div>
        <Link className="btn btn-secondary" to={`/campaign/${slug}/teams`}>
          Find your team <ArrowUpRight size={16} />
        </Link>
      </header>
      <nav className="campaign-tabs">
        <Link to={`/campaign/${slug}`}>Overview</Link>
        <Link to={`/campaign/${slug}/teams`}>Teams</Link>
        <span aria-current="page">Leaderboard</span>
      </nav>
      {(error || metaError) && (
        <div className="notice" role="alert">
          <span>
            {error || metaError}
            {data ? " Showing the last successful snapshot." : ""}
          </span>
          <button className="text-link" disabled={busy} onClick={refresh}>
            Retry
          </button>
        </div>
      )}
      <div className="rankings-heading">
        <div>
          <span className="eyebrow">THE COMMUNITY, IN MOTION</span>
          <h2>
            Climb together<span>.</span>
          </h2>
        </div>
        <div className="rankings-update">
          <button
            className="btn btn-secondary"
            disabled={busy}
            onClick={refresh}
            aria-label="Refresh rankings"
          >
            <RefreshCw size={16} className={busy ? "rankings-spinning" : ""} />
            Refresh
          </button>
          <small>
            {data
              ? `Updated ${new Date(data.as_of).toLocaleTimeString()}`
              : "Waiting for first update"}{" "}
            · Every 10s
          </small>
        </div>
      </div>
      <div className="rankings-stats">
        <div>
          <span>Scoring players</span>
          <strong>
            {data ? data.qualified_players.toLocaleString() : "—"}
          </strong>
        </div>
        <div>
          <span>Community unlock points</span>
          <strong>{data?.unlock_points?.toLocaleString() ?? "—"}</strong>
        </div>
        <div>
          <span>Rankings shown</span>
          <strong>Top 100</strong>
        </div>
      </div>
      <div className="tabs rankings-tabs" aria-label="Leaderboard type">
        <button
          aria-pressed={kind === "players"}
          className={kind === "players" ? "selected" : ""}
          onClick={() => setKind("players")}
        >
          <Trophy size={16} />
          Players
        </button>
        <button
          aria-pressed={kind === "teams"}
          className={kind === "teams" ? "selected" : ""}
          onClick={() => setKind("teams")}
        >
          <Users size={16} />
          Teams
        </button>
      </div>
      <p className="rankings-rule">
        {kind === "players"
          ? "Highest accepted score per player. Team labels show where that best score was earned."
          : "Each team’s score is the sum of its players’ best scores earned for that team. Historical contributions stay with their original team."}
      </p>
      {app.user ? (
        <div className="rankings-own">
          <span>
            {kind === "players" ? "Your standing" : "Your current team"}
          </span>
          <strong>
            {kind === "teams" && !memberReady
              ? "Loading membership…"
              : memberError && kind === "teams"
                ? "Membership unavailable"
                : ownIndex >= 0
                  ? `#${ownIndex + 1} · ${rows[ownIndex].score.toLocaleString()} pts`
                  : !data
                    ? "Loading standings…"
                    : kind === "teams" && !membership
                      ? "You have not joined a team"
                      : "Not in the top 100 · No ranked score or outside this list"}
          </strong>
        </div>
      ) : (
        <div className="rankings-own">
          <span>See where you stand</span>
          <button className="text-link" onClick={() => app.setAuthOpen(true)}>
            Sign in
          </button>
        </div>
      )}
      {!data && !error && (
        <div className="rankings-loading" role="status">
          Loading community standings…
        </div>
      )}
      {data && !rows.length && (
        <div className="empty-panel">
          <Trophy size={36} />
          <h3>A fresh start. Make the first move.</h3>
          <p>No accepted scores yet.</p>
          <Link className="btn btn-primary" to={`/campaign/${slug}`}>
            Explore campaign <ArrowUpRight size={16} />
          </Link>
        </div>
      )}
      {!!rows.length && (
        <>
          <div className="rankings-podium">
            {rows.slice(0, 3).map((r, i) => (
              <article
                key={r.id}
                className={`rankings-podium-card place-${i + 1}`}
              >
                <span className="rankings-place">
                  <Trophy size={18} />0{i + 1}
                </span>
                <span
                  className="rankings-avatar"
                  style={{
                    background:
                      kind === "teams"
                        ? teams.find((t) => t.id === r.id)?.color
                        : undefined,
                  }}
                >
                  {kind === "teams" ? (
                    teams.find((t) => t.id === r.id)?.initial || "T"
                  ) : (
                    <PlayerAvatar
                      key={r.avatar_url || r.id}
                      rank={r}
                      name={label(r)}
                    />
                  )}
                </span>
                <h3>
                  {label(r)}{" "}
                  {kind === "players" && r.kol_verified === true && (
                    <VerifiedKol />
                  )}
                </h3>
                {username(r) && (
                  <span className="rankings-username">@{username(r)}</span>
                )}
                <small>
                  {kind === "players"
                    ? teamName(r.team_id)
                    : `${teams.find((t) => t.id === r.id)?.players ?? "—"} members`}
                </small>
                <strong>
                  {r.score.toLocaleString()}
                  <span> pts</span>
                </strong>
              </article>
            ))}
          </div>
          <div className="rankings-table-wrap">
            <table className="rankings-table">
              <caption>
                {kind === "players" ? "Player" : "Team"} standings · Top{" "}
                {rows.length}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Rank</th>
                  <th scope="col">{kind === "players" ? "Player" : "Team"}</th>
                  <th scope="col">
                    {kind === "players" ? "Best-score team" : "Members"}
                  </th>
                  <th scope="col">Score</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id} className={r.id === ownId ? "is-mine" : ""}>
                    <td>#{i + 1}</td>
                    <th scope="row">
                      {kind === "teams" ? (
                        <Link to={`/campaign/${slug}/teams?selected=${r.id}`}>
                          {label(r)}
                        </Link>
                      ) : (
                        <span className="rankings-player-name">
                          <span className="rankings-avatar rankings-avatar-small">
                            <PlayerAvatar
                              key={r.avatar_url || r.id}
                              rank={r}
                              name={label(r)}
                            />
                          </span>
                          <span className="rankings-player-label">
                            <span>
                              {label(r)}{" "}
                              {r.kol_verified === true && <VerifiedKol />}
                            </span>
                            {username(r) && (
                              <span className="rankings-username">
                                @{username(r)}
                              </span>
                            )}
                          </span>
                        </span>
                      )}
                      {r.id === ownId && (
                        <span className="pill acid">
                          {kind === "players" ? "YOU" : "YOUR TEAM"}
                        </span>
                      )}
                    </th>
                    <td>
                      {kind === "players"
                        ? teamName(r.team_id)
                        : (teams.find((t) => t.id === r.id)?.players ?? "—")}
                    </td>
                    <td>{r.score.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <p className="rankings-disclaimer">
        Server-accepted scores · Up to 2s cache delay · Scores update
        automatically do not distribute tokens or rewards.
      </p>
    </section>
  );
}

function PlayerAvatar({ rank, name }: { rank: Rank; name: string }) {
  const [failed, setFailed] = useState(false);
  const src = safeImageSource(rank.avatar_url);
  return (
    <>
      {src && !failed ? (
        <img
          src={src}
          alt=""
          referrerPolicy="no-referrer"
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <>{name.trim().charAt(0).toUpperCase() || "P"}</>
      )}
      {rank.kol_verified === true && <VerifiedKol avatar />}
    </>
  );
}
