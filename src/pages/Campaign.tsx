import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Check,
  ChevronRight,
  Clock3,
  Crown,
  Flag,
  Gamepad2,
  LockKeyhole,
  LogOut,
  Play,
  Radio,
  Rocket,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  UnlockKeyhole,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import { Link, NavLink, useParams, useSearchParams } from "react-router-dom";
import {
  campaigns,
  number,
  short,
  stageLabel,
  teams,
  type Campaign,
} from "../data";
import { useApp } from "../state";
import { liveAuth } from "../lib/api";
import { LiveMemberships } from "./LiveTeams";
import { CampaignArtwork } from "../components/CampaignArtwork";
import { launchCopy } from "../lib/launch";
import { LaunchTimer } from "../LaunchTimer";
import { CompetitionRules } from "../CompetitionRules";
import { KolBadge } from "./Verification";
import { TeamInvite } from "../components/TeamInvite";
import { WalletPanel } from "../components/WalletPanel";
import { walletAllowed } from "../lib/walletPolicy";
import { ProfileTools } from "../components/ProfileTools";
import { VerifiedKol } from "../components/VerifiedKol";
import { PublicProfileEditor } from "../components/PublicProfileEditor";
import { PlatformPoints } from "../components/PlatformPoints";
import { CampaignTeamsPreview } from "../components/CampaignTeamsPreview";
import { CommunityTeamCard } from "../components/CommunityTeamCard";

export function useCampaign() {
  const { id } = useParams();
  const app = useApp();
  return app.campaign(id || app.entry.campaignId || "phood");
}
export function CampaignNav({
  campaign,
  live = false,
}: {
  campaign: Campaign;
  live?: boolean;
}) {
  const app = useApp();
  return (
    <>
      <div className="breadcrumbs">
        <Link to="/">
          <ArrowLeft size={14} /> Discover
        </Link>
        <ChevronRight size={13} />
        <span>{campaign.name}</span>
        {!live && (
          <button
            className="text-link"
            onClick={() => app.setShareCampaign(campaign.id)}
          >
            <Send size={14} /> Share campaign
          </button>
        )}
      </div>
      <nav className="campaign-nav" aria-label="Campaign navigation">
        <NavLink end to={`/campaign/${campaign.id}`}>
          Overview
        </NavLink>
        {live ? (
          <>
            <NavLink to={`/campaign/${campaign.id}/teams`}>Teams</NavLink>
            <NavLink to={`/campaign/${campaign.id}/leaderboard`}>
              Leaderboard
            </NavLink>
          </>
        ) : (
          <>
            <NavLink to={`/campaign/${campaign.id}/teams`}>
              Teams <span>{campaign.teams}</span>
            </NavLink>
            <NavLink to={`/campaign/${campaign.id}/leaderboard`}>
              Leaderboard
            </NavLink>
            {walletAllowed(app.platform?.runtime) && (
              <NavLink to={`/campaign/${campaign.id}/launch`}>
                Launch <ArrowUpRight size={13} />
              </NavLink>
            )}
          </>
        )}
      </nav>
    </>
  );
}
export function CampaignPage({
  liveCampaign,
}: { liveCampaign?: Campaign } = {}) {
  const demoCampaign = useCampaign();
  const c = liveCampaign ?? demoCampaign;
  const live = liveCampaign !== undefined;
  const app = useApp();
  if (!c) return <NotFound />;
  const stage = live ? c.stage : app.getStage(c.id);
  const teams = live ? [] : app.standings(c.id).teams;
  const joined = teams.find((t) => t.id === app.local.memberships[c.id]);
  const invited =
    app.entry.campaignId === c.id
      ? teams.find((t) => t.id === app.entry.teamId)
      : undefined;
  const maxScore = Math.max(
    0,
    ...app.local.runs.filter((r) => r.campaignId === c.id).map((r) => r.score),
  );
  return (
    <>
      <CampaignNav campaign={c} live={live} />
      <div className="campaign-layout">
        <div>
          <section className={`campaign-hero art-${c.id}`}>
            <CampaignArtwork campaign={c} variant="hero" />
            <div className="campaign-hero-shade" />
            <div className="campaign-hero-content">
              <span className="pill acid">
                <Zap size={12} />{" "}
                {live ? (
                  "PLAY TO LAUNCH"
                ) : (
                  <>
                    P2L ORIGINAL #
                    {String(
                      campaigns.findIndex((item) => item.id === c.id) + 1,
                    ).padStart(3, "0")}
                  </>
                )}
              </span>
              <h1>{c.name}</h1>
              <p>{c.description}</p>
              <span className="pill neutral">
                <Gamepad2 size={13} />
                {c.category}
              </span>
            </div>
          </section>
          <div className="campaign-description">
            {!live && <CompetitionRules campaignId={c.id} />}
            <div>
              <span className="eyebrow">
                {c.id === "phood"
                  ? "THE ROBIN HOOD WHO GIVES BACK TO THE RICH."
                  : "YOUR NEXT COMMUNITY STARTS WITH A GAME."}
              </span>
              <h2>
                {c.id === "phood"
                  ? "Bad trades. Great company."
                  : "A little play. A bigger possibility."}
              </h2>
              <p>
                {live
                  ? c.description
                  : c.id === "phood"
                    ? "Meet Paperhood. Buy at the top, panic at the bottom, and turn your questionable market timing into a very respectable score. Every round is a chance to move your team up the leaderboard."
                    : "Get in early, discover the project, and find your crew. This campaign is part of the P2L Genesis preview."}
              </p>
            </div>
            <div className="how-play">
              {[
                ["01", "PLAY", "30 seconds. Zero setup."],
                ["02", "COMPETE", "Your score. Your community."],
                [
                  "03",
                  "UNLOCK",
                  `${short(c.target)} unlock points. One shared goal.`,
                ],
              ].map(([n, title, text]) => (
                <div key={n}>
                  <span>{n}</span>
                  <strong>{title}</strong>
                  <p>{text}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="section-heading">
            <h2>
              <Users size={22} className="accent" /> The teams behind the launch
            </h2>
            {live ? (
              <Link className="text-link" to={`/campaign/${c.id}/teams`}>
                View all <ArrowUpRight size={15} />
              </Link>
            ) : (
              <Link className="text-link" to={`/campaign/${c.id}/teams`}>
                View all <ArrowUpRight size={15} />
              </Link>
            )}
          </div>
          {live ? <CampaignTeamsPreview slug={c.id} /> : <div className="campaign-team-grid">
            {teams.slice(0, 3).map((t, i) => (
              <Link
                to={`/campaign/${c.id}/teams?selected=${t.id}`}
                className="team-tile"
                key={t.id}
              >
                <span className="eyebrow">#{i + 1} IN THE BATTLE</span>
                <span className="avatar large" style={{ background: t.color }}>
                  {t.initial}
                </span>
                <h3>{t.name}</h3>
                <span className="muted">{short(t.players)} players</span>
                <div className="team-tile-bottom">
                  <strong>{short(t.score)}</strong>
                  <ArrowUpRight size={18} />
                </div>
              </Link>
            ))}
          </div>}
        </div>
        <aside className="campaign-aside">
          <section className={`unlock-panel unlock-${stage}`}>
            <div className="panel-top">
              <span className={`pill stage-${stage}`}>
                <i />
                {stageLabel(stage)}
              </span>
              <span className="muted">${c.ticker}</span>
            </div>
            <div className="lock-emblem">
              {stage === "prelaunch" ? (
                <LockKeyhole size={29} />
              ) : stage === "live" ? (
                <Rocket size={29} />
              ) : (
                <UnlockKeyhole size={29} />
              )}
            </div>
            <h2>{launchCopy[stage].title}</h2>
            <p>{launchCopy[stage].detail}</p>
            {!live && stage === "countdown" && (
              <LaunchTimer campaignId={c.id} />
            )}
            <div className="unlock-number">
              <strong>
                {live
                  ? c.unlockPoints === undefined
                    ? "—"
                    : number(c.unlockPoints)
                  : number(c.unlockPoints ?? 0)}
              </strong>
              <span> / {number(c.target)}</span>
            </div>
            <div className="progress-track">
              <i
                style={{
                  width: `${Math.min(100, ((c.unlockPoints ?? 0) / Math.max(c.target, 1)) * 100)}%`,
                }}
              />
            </div>
            <div className="progress-caption">
              <span>
                {live ? "Unlock contribution" : "Unlock contribution · demo"}
              </span>
              <b>
                {live
                  ? c.unlockPoints === undefined
                    ? "—"
                    : c.unlockPoints >= c.target
                      ? "Community goal reached"
                      : `${number(c.target - c.unlockPoints)} to go`
                  : (c.unlockPoints ?? 0) < c.target
                    ? `${Math.max(c.target - (c.unlockPoints ?? 0), 0).toLocaleString()} to go`
                    : "Requirement reached"}
              </b>
            </div>
            {
              <p className="small muted">
                {(c.score_per_unlock_point ?? 0) > 0
                  ? `Every ${number(c.score_per_unlock_point!)} game points in your best accepted score adds 1 unlock point, rounded down. Only improvements add more.`
                  : "Unlock conversion is not configured yet."}
              </p>
            }
            {!live &&
              walletAllowed(app.platform?.runtime) &&
              stage !== "prelaunch" && (
                <Link
                  to={`/campaign/${c.id}/launch`}
                  className="btn btn-primary full big"
                >
                  {launchCopy[stage].action}
                  <ArrowUpRight size={18} />
                </Link>
              )}
            {!live && c.id === "phood" ? (
              <Link
                to={`/campaign/${c.id}/play`}
                className={`btn ${stage === "prelaunch" ? "btn-primary" : "btn-secondary"} full big`}
              >
                <Play size={18} fill="currentColor" />{" "}
                {live
                  ? "Practice game"
                  : stage === "prelaunch"
                    ? "Play to unlock"
                    : "Play again"}{" "}
                <ArrowUpRight size={18} />
              </Link>
            ) : !live ? (
              <div className="inline-note">
                <Clock3 size={16} />
                <span>
                  This game is coming soon. Try PAPERHOOD, our playable Genesis
                  demo.
                </span>
              </div>
            ) : null}
            {live &&
              ((c.game_key === "paperhood" && c.rules_version === "paperhood-v1") || (/^gx[0-9a-z]{1,13}$/.test(c.game_key||"") && c.rules_version === "paper-run-practice-v5")) && (
                <Link
                  className="btn btn-primary full"
                  to={`/campaign/${c.id}/compete`}
                >
                  Play ranked round <ArrowUpRight size={18} />
                </Link>
              )}
            {live && /^gx[0-9a-z]{1,13}$/.test(c.game_key||'') && (
              <Link className="btn btn-secondary full" to={`/campaign/${c.id}/try`}>Try it first · No sign-in needed <Play size={15}/></Link>
            )}
            {!live && c.id !== "phood" && (
              <Link to="/campaign/phood/play" className="btn btn-primary full">
                Try PAPERHOOD <Play size={15} />
              </Link>
            )}
            <div className="free-note">
              <Check size={12} /> Free to play <span>·</span> No wallet needed
            </div>
            {!live && stage !== "prelaunch" && (
              <Link to={`/campaign/${c.id}/leaderboard`} className="text-link">
                View leaderboard <Trophy size={15} />
              </Link>
            )}
            <div className="launch-score">
              <span>
                <ShieldCheck size={17} /> P2L Launch Score
              </span>
              <strong>
                {live ? "—" : c.score}
                <small>/100</small>
              </strong>
            </div>
            {walletAllowed(app.platform?.runtime) && !live && (
              <Link to={`/campaign/${c.id}/launch`} className="text-link">
                Explore launch details <ArrowRight size={15} />
              </Link>
            )}
          </section>
          <section className="your-team-panel">
            <span className="eyebrow">
              {joined
                ? "YOUR TEAM"
                : invited
                  ? "YOU’VE BEEN INVITED"
                  : "FIND YOUR PEOPLE"}
            </span>
            {joined || invited ? (
              <>
                <div className="your-team">
                  <span
                    className="avatar"
                    style={{ background: (joined || invited)!.color }}
                  >
                    {(joined || invited)!.initial}
                  </span>
                  <div>
                    <h3>{(joined || invited)!.name}</h3>
                    <small>
                      {joined
                        ? "You’re part of the crew."
                        : "Your invitation is saved."}
                    </small>
                  </div>
                  <BadgeCheck size={20} className="accent" />
                </div>
                {!joined && (
                  <button
                    className="btn btn-secondary full"
                    onClick={() => app.join(c.id, invited!.id)}
                  >
                    Join {invited!.name}
                    <ArrowUpRight size={15} />
                  </button>
                )}
                {joined && (
                  <Link to={`/campaign/${c.id}/teams`} className="text-link">
                    See your team <ArrowUpRight size={14} />
                  </Link>
                )}
              </>
            ) : (
              <>
                <h3>Better with a crew.</h3>
                <p>Choose a community and make every play count together.</p>
                {live ? (
                  <Link
                    to={`/campaign/${c.id}/teams`}
                    className="btn btn-secondary full"
                  >
                    <Users size={16} />
                    Choose your team
                  </Link>
                ) : (
                  <Link
                    to={`/campaign/${c.id}/teams`}
                    className="btn btn-secondary full"
                  >
                    <Users size={16} />
                    Choose your team
                  </Link>
                )}
              </>
            )}
          </section>
          {maxScore > 0 && (
            <section className="personal-best">
              <Trophy size={20} />
              <div>
                <span>Your practice best</span>
                <strong>{number(maxScore)}</strong>
              </div>
              <span className="pill neutral">LOCAL</span>
            </section>
          )}
        </aside>
      </div>
    </>
  );
}

export function MyTeams({ compact = false }: { compact?: boolean }) {
  const app = useApp();
  if (liveAuth) return <LiveMemberships />;
  const participating = campaigns.filter(
    (c) =>
      app.local.memberships[c.id] ||
      app.local.runs.some((r) => r.campaignId === c.id),
  );
  const list = compact ? participating : campaigns;
  return (
    <section className="section">
      <div className="section-heading">
        <h2>
          <Users size={20} className="accent" /> My teams by campaign
        </h2>
        <span className="pill neutral">LOCAL PREVIEW</span>
      </div>
      <p className="muted">
        Your team belongs to a campaign, not your whole account. You can choose
        a different team in every campaign.
      </p>
      <div className="membership-grid">
        {list.map((c) => {
          const team = app
            .standings(c.id)
            .teams.find((t) => t.id === app.local.memberships[c.id]);
          const rounds = app.local.runs.filter((r) => r.campaignId === c.id);
          const best = Math.max(0, ...rounds.map((r) => r.score));
          return (
            <article
              className="membership-card"
              key={c.id}
              aria-label={`${c.name} membership`}
            >
              <div className="section-heading">
                <Link to={`/campaign/${c.id}`}>
                  <h3>{c.name}</h3>
                </Link>
                <span className="pill neutral">
                  {stageLabel(app.getStage(c.id))}
                </span>
              </div>
              <span className="eyebrow">MY TEAM IN THIS CAMPAIGN</span>
              <h2>{team?.name || "No team yet"}</h2>
              <p className="muted">
                {team
                  ? `${team.handle} · ${c.name} chapter`
                  : "Joining here won’t change your other teams."}
              </p>
              <div className="team-stats">
                <div>
                  <strong>{rounds.length}</strong>
                  <span>Local rounds</span>
                </div>
                <div>
                  <strong>{number(best)}</strong>
                  <span>Practice best</span>
                </div>
              </div>
              <p className="small muted">
                Demo team contribution uses your highest accepted score, not the
                sum of practice rounds.
              </p>
              <Link
                className="btn btn-secondary full"
                to={`/campaign/${c.id}/teams${team ? `?selected=${team.id}` : ""}`}
              >
                {team ? "View my team" : "Choose a team"}
                <ArrowUpRight size={16} />
              </Link>
            </article>
          );
        })}
      </div>
      {!list.length && (
        <div className="empty-panel">
          <p>No campaign memberships yet.</p>
          <Link className="text-link" to="/teams">
            Explore campaign teams <ArrowRight size={16} />
          </Link>
        </div>
      )}
    </section>
  );
}

export function MyTeamsPage() {
  return (
    <>
      <div className={`page-heading ${liveAuth ? "my-teams-heading" : ""}`}>
        <div>
          <span className="eyebrow">YOUR COMMUNITIES</span>
          <h1>
            {liveAuth ? "My teams" : <>Different campaigns.<br />Your people<span>.</span></>}
          </h1>
          <p>One account. An independent team choice in every campaign.</p>
        </div>
      </div>
      <MyTeams />
    </>
  );
}

export function TeamPage({
  live,
}: {
  live?: {
    campaign: Campaign;
    teams: Array<{
	  team_type?: string;
	  activity?: {active_today:number;rounds_today:number;as_of:string};
      owner_id?: string;
      status?: "active" | "paused";
      id: string;
      name: string;
      handle: string;
      initial: string;
      color: string;
      description: string;
      players: number;
      score: number;
      referrals: number;
    }>;
    member?: string;
    closed: boolean;
    busy: boolean;
    canJoin?: (team: string) => boolean;
    join: (team: string) => void;
  };
} = {}) {
  const demoCampaign = useCampaign();
  const c = live?.campaign ?? demoCampaign;
  const app = useApp();
  const [search, setSearch] = useState("");
  const [params] = useSearchParams();
  const [selected, setSelected] = useState(
    params.get("selected") || app.entry.teamId || "alice",
  );
  if (!c) return <NotFound />;
  const member = live ? live.member : app.local.memberships[c.id];
  const community = live?.teams.find(t=>t.team_type==='system_community');
  const communityMember = !!community && member===community.id;
  const teams = live ? live.teams.filter(t=>t.team_type!=='system_community') : app.standings(c.id).teams;
  const communityCard = live && <CommunityTeamCard slug={c.id} team={community} joined={communityMember}/>;
  const current = teams.find((t) => t.id === selected) || teams[0];
  const ownsTeam = !!app.user?.id && live?.teams.some(t => t.owner_id === app.user!.id);
  const captainAction = live && (
    <Link
      className="btn btn-secondary"
      style={{ gridColumn: "1 / -1" }}
      to={`/captain?campaign=${encodeURIComponent(c.id)}`}
    >
      {ownsTeam ? `Manage my team in ${c.name}` : `Create my team in ${c.name}`}
    </Link>
  );
  if (!current)
    return (
      <>
        <CampaignNav campaign={c} live={!!live} />
        {communityCard}
        <div className="empty-panel">
          <h2>No teams available yet</h2>
          {live && <p>Be the first captain to create a team for this campaign. Approved KOL verification is required.</p>}
          {captainAction}
        </div>
      </>
    );
  return (
    <>
      <CampaignNav campaign={c} live={!!live} />
      <section
        className="team-campaign-strip"
        aria-label={`${c.name} campaign`}
        style={{ "--campaign-color": c.color } as React.CSSProperties}
      >
        <div className="team-campaign-strip-art">
          <CampaignArtwork campaign={c} variant="hero" />
        </div>
        <div className="team-campaign-strip-content">
          <div className="team-campaign-strip-meta">
            <span className={`pill ${c.stage}`}>
              {stageLabel(live ? c.stage : app.getStage(c.id))}
            </span>
            <span>${c.ticker} / COMMUNITY BATTLE</span>
          </div>
          <h1>{c.name}</h1>
          <p>
            Pick your people.{" "}
            <span>Your team choice stays in this campaign.</span>
          </p>
          <span className="team-campaign-strip-count">
            <Users size={16} /> {teams.length} teams
          </span>
        </div>
      </section>
      <div className="team-page-layout">
        {communityCard}
        {captainAction}
        <section>
          <div className="filter-row">
            <div className="tabs">
              <button className="selected">All teams</button>
            </div>
            <label className="search-field">
              <Search size={16} />
              <input
                aria-label="Search teams"
                placeholder="Find a team"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
          </div>
          <div className="team-directory">
            {teams
              .filter((t) =>
                `${t.name} ${t.handle}`
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .map((t, i) => (
                <button
                  key={t.id}
                  className={`team-directory-item ${selected === t.id ? "is-selected" : ""}`}
                  onClick={() => setSelected(t.id)}
                >
                  <span className="rank">0{i + 1}</span>
                  <span
                    className="avatar large"
                    style={{ background: t.color }}
                  >
                    {t.initial}
                  </span>
                  <span className="team-name">
                    <strong>
                      {t.name}
                      {live?.teams.find((team) => team.id === t.id)?.status ===
                        "paused" && (
                        <span className="pill neutral">PAUSED</span>
                      )}
                      {member === t.id && (
                        <span className="pill acid">YOUR TEAM</span>
                      )}
                    </strong>
                    <small>{t.handle}</small>
                    <span>
                      {number(t.players)} players ·{" "}
                      {live ? "—" : short(t.score)} points
                    </span>
                  </span>
                  <ChevronRight size={20} />
                </button>
              ))}
          </div>
          {teams.every(
            (t) =>
              !`${t.name} ${t.handle}`
                .toLowerCase()
                .includes(search.toLowerCase()),
          ) && (
            <div className="empty-panel">
              <Search />
              <h3>No teams found</h3>
              <button className="text-link" onClick={() => setSearch("")}>
                Clear search
              </button>
            </div>
          )}
        </section>
        <section className="team-detail">
          <div
            className="team-detail-banner"
            style={{ "--team-color": current.color } as React.CSSProperties}
          >
            <span className="eyebrow">
              THE {current.initial} SIDE OF THE STORY
            </span>
            <span
              className="avatar jumbo"
              style={{ background: current.color }}
            >
              {current.initial}
            </span>
            <span className="team-detail-rank">
              <Crown size={16} />{" "}
              {live
                ? "TEAM"
                : `RANK #${teams.findIndex((t) => t.id === current.id) + 1}`}
            </span>
          </div>
          <div className="team-detail-body">
            <h2>{current.name}</h2>
            {live &&
              member === current.id &&
              current &&
              live.teams.find((t) => t.id === current.id)?.status !==
                "paused" && (
                <TeamInvite
                  key={current.id}
                  slug={c.id}
                  team={current.id}
                  name={current.name}
                  referrer={app.user?.id}
                />
              )}
            <p>
              {current.handle} · {c.name} chapter
            </p>
            <div className="team-stats">
              <div>
                <strong>{short(current.players)}</strong>
                <span>Players</span>
              </div>
              <div>
                <strong>{live ? "—" : short(current.score)}</strong>
                <span>Campaign team score</span>
              </div>
              <div>
                <strong>{short(current.referrals)}</strong>
                <span>Referrals</span>
              </div>
            </div>
            <blockquote>
              {live
                ? live.teams.find((t) => t.id === current.id)?.description
                : app.local.captainTeams.find(
                    (t) => t.id === current.id && t.campaignId === c.id,
                  )?.description ||
                  "We’re early. We’re together. Let’s make this launch ours."}
            </blockquote>
            {live?.teams.find((t) => t.id === current.id)?.status ===
            "paused" ? (
              <div className="notice" role="status">
                Team paused · Joining and new games are unavailable. Past scores
                are preserved.
              </div>
            ) : live && member === current.id ? (
              <div className="btn btn-primary full">
                <Check size={18} /> Your team · Joined
              </div>
            ) : member === current.id ? (
              <Link
                to={`/campaign/${c.id}/play`}
                className="btn btn-primary full"
              >
                <Check size={18} /> Play for your team
              </Link>
            ) : (
              <button
                className="btn btn-primary full"
                onClick={() =>
                  live ? live.join(current.id) : app.join(c.id, current.id)
                }
                disabled={
                  (Boolean(member) && !communityMember) ||
                  (live
                    ? live.closed || live.busy || live.canJoin?.(current.id) === false
                    : Date.now() >= app.local.competition.deadlines[c.id])
                }
              >
                <Users size={17} />
                {live?.busy
                  ? "Joining"
                  : member && !communityMember
                    ? "Team locked ·"
                    : (
                          live
                            ? live.closed
                            : Date.now() >=
                              app.local.competition.deadlines[c.id]
                        )
                      ? "Joining closed ·"
                      : live?.canJoin?.(current.id) === false ? "Invitation required ·" : "Join"}{" "}
                {current.name}
                <ArrowUpRight size={17} />
              </button>
            )}
            <p className="small muted">
              {live ? (
                `Your membership applies only to ${c.name}. Accepted scores count toward the team you played for. Historical contributions stay with that team; referrals do not add points.`
              ) : (
                <>
                  This membership applies only to {c.name}. Team stats are
                  samples; your first team choice is permanent in this campaign.
                  Team scores sum members’ highest accepted scores.
                </>
              )}
            </p>
          </div>
        </section>
      </div>
    </>
  );
}

export function LeaderboardPage() {
  const c = useCampaign();
  const app = useApp();
  const [view, setView] = useState<"teams" | "global" | "team">("teams");
  if (!c) return <NotFound />;
  const snapshot = app.standings(c.id);
  const teams = snapshot.teams;
  const member = teams.find((t) => t.id === app.local.memberships[c.id]);
  const runs = app.local.runs.filter((r) => r.campaignId === c.id);
  const mine = snapshot.players.find((p) => p.userId === app.user?.id);
  const best = mine?.best || 0;
  const players = snapshot.players
    .filter((p) => view !== "team" || p.teamId === member?.id)
    .slice(0, 20);
  return (
    <>
      <CampaignNav campaign={c} />
      <div className="page-heading">
        <div>
          <span className="eyebrow">{c.name} / THE RACE IS ON</span>
          <h1>
            Proof of play<span>.</span>
          </h1>
          <p>Big scores. Bigger communities. Who’s making the next move?</p>
        </div>
        <span className="season-tag">
          <Radio size={15} /> SAMPLE RANKINGS
        </span>
      </div>
      <div className="podium">
        {[teams[1], teams[0], teams[2]].map((t) => (
          <div
            key={t.id}
            className={`podium-card place-${teams.indexOf(t) + 1}`}
          >
            <span className="podium-place">
              {teams.indexOf(t) === 0 ? (
                <Crown size={23} />
              ) : (
                <>0{teams.indexOf(t) + 1}</>
              )}
            </span>
            <span className="avatar jumbo" style={{ background: t.color }}>
              {t.initial}
            </span>
            <h3>{t.name}</h3>
            <strong>{short(t.score)}</strong>
            <span>TEAM POINTS</span>
          </div>
        ))}
      </div>
      <div className="filter-row ranking-filters">
        <div className="tabs">
          {(
            [
              ["teams", "Team battle"],
              ["global", "Global players"],
              ["team", "My team"],
            ] as const
          ).map(([key, label]) => (
            <button
              className={view === key ? "selected" : ""}
              onClick={() => setView(key)}
              key={key}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="muted">
          Demo standings · Top 20 · Closes{" "}
          {new Date(app.local.competition.deadlines[c.id]).toLocaleString()}
        </span>
      </div>
      {view === "teams" ? (
        <div className="table-scroll">
          <table className="ranking-table">
            <thead>
              <tr>
                <th>RANK</th>
                <th>TEAM</th>
                <th>PLAYERS</th>
                <th>REFERRALS</th>
                <th>TEAM SCORE</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((t, i) => (
                <tr key={t.id} className={member?.id === t.id ? "my-row" : ""}>
                  <td>
                    <span className="rank">0{i + 1}</span>
                  </td>
                  <td>
                    <Link
                      to={`/campaign/${c.id}/teams?selected=${t.id}`}
                      className="table-team"
                    >
                      <span className="avatar" style={{ background: t.color }}>
                        {t.initial}
                      </span>
                      <span>
                        {t.name}
                        {member?.id === t.id && <small>YOUR TEAM</small>}
                      </span>
                    </Link>
                  </td>
                  <td>{number(t.players)}</td>
                  <td>{number(t.referrals)}</td>
                  <td>
                    {short(t.score)}{" "}
                    <ArrowUpRight size={14} className="accent" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : view === "team" && !member ? (
        <div className="empty-panel">
          <Users size={34} />
          <h3>Your crew is waiting.</h3>
          <p>Join a team to explore its player leaderboard.</p>
          <Link to={`/campaign/${c.id}/teams`} className="btn btn-primary">
            Find your team
            <ArrowUpRight size={16} />
          </Link>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="ranking-table">
            <thead>
              <tr>
                <th>RANK</th>
                <th>PLAYER</th>
                <th>TEAM</th>
                <th>BEST SCORE</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p, i) => (
                <tr key={p.userId}>
                  <td>{String(i + 1).padStart(2, "0")}</td>
                  <td>
                    <span className="table-team">
                      <span
                        className="avatar"
                        style={{ background: teams[i % 4].color }}
                      >
                        {p.name[0].toUpperCase()}
                      </span>
                      {p.name}
                    </span>
                  </td>
                  <td>
                    {teams.find((t) => t.id === p.teamId)?.name || "Solo"}
                  </td>
                  <td>{number(p.best)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="your-ranking">
        <span className="avatar">{app.user?.name[0] || "?"}</span>
        <div>
          <strong>{app.user?.name || "Your next great bad trade"}</strong>
          <p>
            {mine
              ? `Demo rank #${snapshot.players.indexOf(mine) + 1} · Accepted best: ${number(best)} · No live ranking submission.`
              : "Save a valid round before the deadline to enter the demo standings."}
          </p>
        </div>
        <Link to={`/campaign/${c.id}/play`} className="btn btn-primary">
          <Play size={16} />
          Play now
        </Link>
      </div>
    </>
  );
}

export function LaunchPage() {
  const c = useCampaign();
  const app = useApp();
  if (!c) return <NotFound />;
  const stage = app.getStage(c.id);
  const unlocked = stage !== "prelaunch";
  return (
    <>
      <CampaignNav campaign={c} />
      <section className={`launch-surface ${unlocked ? "unlocked" : ""}`}>
        <span className={`pill stage-${stage}`}>
          <i />
          {stageLabel(stage)}
        </span>
        <div className="launch-orbit">
          {stage === "prelaunch" ? (
            <LockKeyhole size={52} />
          ) : stage === "live" ? (
            <Rocket size={52} />
          ) : (
            <UnlockKeyhole size={52} />
          )}
        </div>
        <span className="eyebrow">${c.ticker} / THE COMMUNITY DID THIS</span>
        <h1>{launchCopy[stage].title}</h1>
        <p>{launchCopy[stage].detail}</p>
        <p>
          {stage === "prelaunch"
            ? `${number(Math.max(c.target - (c.unlockPoints ?? 0), 0))} more unlock points to unlock the next chapter.`
            : `${number(c.unlockPoints ?? 0)} unlock points made it happen. This is what together looks like.`}
        </p>
        {stage === "countdown" ? (
          <LaunchTimer campaignId={c.id} />
        ) : stage === "prelaunch" ? (
          <div className="launch-progress">
            <div>
              <strong>{number(c.unlockPoints ?? 0)}</strong>
              <span> / {number(c.target)} unlock points · sample</span>
            </div>
            <div className="progress-track">
              <i
                style={{
                  width: `${Math.min(((c.unlockPoints ?? 0) / Math.max(c.target, 1)) * 100, 100)}%`,
                }}
              />
            </div>
          </div>
        ) : (
          <div className="launch-check">
            <Check size={18} />
            {stage === "live"
              ? "Launch state preview · no live token"
              : "Launch requirement reached · preview"}
          </div>
        )}
        <div className="launch-actions">
          <Link to={`/campaign/${c.id}/play`} className="btn btn-primary">
            <Play size={17} />
            {unlocked ? "Keep playing" : "Play to unlock"}
            <ArrowUpRight size={17} />
          </Link>
          {unlocked ? (
            <Link
              to={`/campaign/${c.id}/leaderboard`}
              className="btn btn-secondary"
            >
              <Trophy size={16} />
              View leaderboard
            </Link>
          ) : (
            <button
              className="btn btn-secondary"
              onClick={() => app.setShareCampaign(c.id)}
            >
              <Send size={16} />
              Rally your team
            </button>
          )}
        </div>
        {stage === "live" && (
          <div className="inline-note">
            <Wallet size={18} />
            <span>
              Trading becomes available after a verified token address, network
              and trading provider are configured. Trading is not
              available yet.
            </span>
          </div>
        )}
      </section>
      <div className="launch-milestones">
        {[
          ["PLAY", "Build real participation", Gamepad2],
          ["COMPETE", "Bring your community", Trophy],
          ["UNLOCK", "Reach the requirement", UnlockKeyhole],
          ["LAUNCH", "Begin the next chapter", Rocket],
        ].map(([title, text, Icon], i) => {
          const I = Icon as typeof Play;
          return (
            <div
              key={i}
              className={
                i < 2 || (i === 2 && unlocked) || (i === 3 && stage === "live")
                  ? "milestone-done"
                  : ""
              }
            >
              <span className="milestone-icon">
                <I size={22} />
              </span>
              <span className="micro">0{i + 1}</span>
              <h3>{title as string}</h3>
              <p>{text as string}</p>
            </div>
          );
        })}
      </div>
      <div className="transparency">
        <ShieldCheck size={22} />
        <div>
          <h3>Know what you’re unlocking.</h3>
          <p>
            Launch Score measures participation, not future returns. Genesis
            metrics are illustrative. Token economics, platform interests and
            launch requirements must be published before a real launch.
          </p>
        </div>
      </div>
    </>
  );
}

export function ProfilePage() {
  const app = useApp();
  const [kolIdentity,setKolIdentity] = useState<{id?:string;approved:boolean}>({approved:false});
  const verified = !!app.user && kolIdentity.id === app.user.id && kolIdentity.approved;
  const total = app.local.runs.length;
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR EARLY DAYS, ON RECORD</span>
          <h1>
            {app.user
              ? `Hey, ${app.user.name}`
              : "Every player starts somewhere"}
            <span>.</span>
          </h1>
          <p>
            {app.user
              ? "Your scores, communities and discoveries."
              : "Play freely. Create a profile when you’re ready."}
          </p>
        </div>
        {app.user && (
          <button
            className="btn btn-secondary"
            onClick={() => void app.logout()}
          >
            <LogOut size={16} />
            Sign out
          </button>
        )}
      </div>
      <div className="profile-grid">
        <section className="profile-identity">
          <span className="avatar jumbo kol-avatar-host">{app.user?.name[0] || "?"}{verified && <VerifiedKol avatar />}</span>
          <h2>{app.user?.name || "Guest player"} {verified && <VerifiedKol />}</h2>
          {app.user?.handle && <div className="profile-username">@{app.user.handle}</div>}
          <KolBadge />
          <span className="pill neutral">
            {app.user?.mode === "live"
              ? "SIGNED IN"
              : app.user
                ? "DEMO PROFILE"
                : liveAuth
                  ? "GUEST"
                  : "LOCAL GUEST"}
          </span>
          <p>
            {app.demoToolsAvailable
              ? "Your preview progress stays on this device."
              : "Signed-in identity and team memberships are saved by the server. Accepted game scores appear on campaign leaderboards. The practice history below is stored only on this device."}
          </p>
          <ProfileTools onVerified={setKolIdentity} />
          {app.demoToolsAvailable && (
            <details className="demo-settings">
              <summary>Prototype settings</summary>
              <label>
                <input
                  type="checkbox"
                  checked={app.demoTools}
                  onChange={(e) => app.toggleDemoTools(e.target.checked)}
                />
                Enable demo controls
              </label>
              <p className="small muted">
                Shows test-only review, stage and recruit controls. Applies to
                this tab session; does not reset your data or grant real
                permissions.
              </p>
            </details>
          )}
          {!app.user && (
            <button
              className="btn btn-primary"
              onClick={() => app.setAuthOpen(true)}
            >
              Save your identity
              <ArrowUpRight size={16} />
            </button>
          )}
          <div className="profile-stats">
            <div>
              <strong>{total}</strong>
              <span>
                {liveAuth ? "Practice rounds on this device" : "Rounds played"}
              </span>
            </div>
            {!liveAuth && (
              <div>
                <strong>{Object.keys(app.local.memberships).length}</strong>
                <span>Campaign teams joined</span>
              </div>
            )}
          </div>
          {walletAllowed(app.platform?.runtime) && <WalletPanel />}
        </section>
        <section>
          {liveAuth && app.user && <PublicProfileEditor key={app.user.id} userId={app.user.id} />}
          {liveAuth && app.user && <PlatformPoints key={`points-${app.user.id}`} />}
          <MyTeams compact />
          <div className="section-heading">
            <h2>
              <Trophy size={20} className="accent" />
              {liveAuth
                ? "Practice history on this device"
                : "Your recent plays"}
            </h2>
            <span className="pill neutral">LOCAL SCORES</span>
          </div>
          {total ? (
            <div className="run-history">
              {[...app.local.runs]
                .reverse()
                .slice(0, 10)
                .map((r) => (
                  <Link
                    to={`/campaign/${r.campaignId}/result/${r.id}`}
                    className="history-row"
                    key={r.id}
                  >
                    <span className="avatar">
                      <Gamepad2 size={20} />
                    </span>
                    <div>
                      <strong>
                        {campaigns.find((c) => c.id === r.campaignId)?.name}
                      </strong>
                      <span>
                        {new Date(r.created).toLocaleDateString()} ·{" "}
                        {app.local.competition.submitted.includes(r.id)
                          ? "Accepted · demo"
                          : r.saved
                            ? "Saved · practice only"
                            : "Not submitted"}
                      </span>
                    </div>
                    <b>{number(r.score)}</b>
                    <ChevronRight size={18} />
                  </Link>
                ))}
            </div>
          ) : (
            <div className="empty-panel">
              <Gamepad2 size={36} />
              <h3>
                {liveAuth
                  ? "No practice history on this device."
                  : "Your first round is waiting."}
              </h3>
              <p>
                {liveAuth
                  ? "Accepted game scores are shown on campaign leaderboards, not in this local practice history."
                  : "Try PAPERHOOD and set a score to beat."}
              </p>
              <Link to={liveAuth ? "/" : "/campaign/phood/play"} className="btn btn-primary">
                <Play size={16} />
                {liveAuth ? "Explore games" : "Play PAPERHOOD"}
              </Link>
              {liveAuth && (
                <Link className="text-link" to="/leaderboard">
                  View campaign rankings <ArrowUpRight size={16} />
                </Link>
              )}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
export function NotFound() {
  return (
    <div className="empty-panel not-found">
      <Flag size={38} />
      <span className="eyebrow">OFF THE CHART</span>
      <h1>This page hasn’t launched.</h1>
      <p>
        The campaign or page may not exist. There’s still plenty to discover.
      </p>
      <Link to="/" className="btn btn-primary">
        Back to discover
        <ArrowUpRight size={17} />
      </Link>
    </div>
  );
}
