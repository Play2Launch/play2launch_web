import { useEffect, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import {
  ArrowDownRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  Copy,
  FlaskConical,
  Globe2,
  LayoutGrid,
  LogIn,
  Send,
  ShieldCheck,
  Trophy,
  Users,
  X,
} from "lucide-react";
import {
  Link,
  NavLink,
  Route,
  Routes,
  useLocation,
  useParams,
  useNavigate,
} from "react-router-dom";
import Discover from "./pages/Discover";
import LiveCatalog from "./pages/LiveCatalog";
import LiveTeams from "./pages/LiveTeams";
import CaptainPage, { CaptainDemoControls } from "./pages/Captain";
import VerificationPage, { ReviewDemoControls } from "./pages/Verification";
import {
  CampaignPage,
  LaunchPage,
  ProfilePage,
  TeamPage,
  MyTeamsPage,
  LeaderboardPage,
  NotFound,
} from "./pages/Campaign";
import { GamePage, ResultPage } from "./pages/Game";
import { LiveGame, LiveScore, LiveRankings } from "./pages/LiveGame";
import { TryGame } from './pages/TryGame';
import { AppProvider, useApp } from "./state";
import { liveAuth } from "./lib/api";
import { LiveAuthForm } from "./components/LiveAuthForm";
import { HeaderWallet } from "./components/HeaderWallet";
import { walletAllowed } from "./lib/walletPolicy";
import { shareLinks } from "./lib/entry";
import { campaigns, teams, type Stage } from "./data";
import { registerCampaignTools } from "./lib/webmcp";

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
function Shell() {
  const app = useApp();
  const navigate = useNavigate();
  const stageRef = useRef(app.getStage);
  stageRef.current = app.getStage;
  useEffect(
    () =>
      !liveAuth
        ? registerCampaignTools(
            document.modelContext,
            (id) => stageRef.current(id),
            (path) => flushSync(() => navigate(path)),
          )
        : undefined,
    [navigate],
  );
  const loc = useLocation();
  const cid =
    loc.pathname.match(/\/campaign\/([^/]+)/)?.[1] ||
    app.entry.campaignId ||
    "phood";
  const [preview, setPreview] = useState(false);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [loc.pathname]);
  useEffect(() => {
    const globalTitle = (
      {
        "/": "Discover",
        "/teams": "My teams",
        "/profile": "Profile",
        "/verification": "KOL verification",
        "/captain": "Captain studio",
        "/leaderboard": "Leaderboard",
      } as Record<string, string>
    )[loc.pathname];
    document.title = `${globalTitle || campaigns.find((c) => c.id === cid)?.name || "Discover"} · PLAY TO LAUNCH`;
  }, [cid, loc.pathname]);
  return (
    <div
      className={`app-shell runtime-${app.platform.runtime} ${loc.pathname.endsWith("/play") ? "game-route" : ""}`}
    >
      <header className="site-header">
        <Link to="/" className="brand">
          <span className="brand-icon">
            <img src="/brand-mark.svg" width="40" height="40" alt="" />
          </span>
          <span>
            PLAY TO
            <br />
            LAUNCH<span className="brand-dot">®</span>
          </span>
        </Link>
        <nav aria-label="Main navigation">
          <NavLink to="/" end>
            Discover
          </NavLink>
          <NavLink to="/teams">My teams</NavLink>
          <NavLink to="/leaderboard">Leaderboard</NavLink>
        </nav>
        <div className="header-right">
          {walletAllowed(app.platform.runtime) && <HeaderWallet />}
          <span className="network">
            <i />
            {app.platform.runtime === "telegram"
              ? "Telegram Mini App"
              : "Web experience"}
            <Globe2 size={13} />
          </span>
          {app.user ? (
            <Link to="/profile" className="profile-button">
              <span className="avatar tiny">{app.user.name[0]}</span>
              <span>{app.user.name}</span>
              {app.user.mode === "demo" && <small>DEMO</small>}
            </Link>
          ) : (
            <button
              className="btn btn-primary"
              onClick={() => app.setAuthOpen(true)}
            >
              <LogIn size={15} /> Sign in
            </button>
          )}
        </div>
      </header>
      <div className="demo-strip">
        {app.demoTools ? (
          <button
            onClick={() => setPreview(!preview)}
            className="preview-trigger"
            aria-expanded={preview}
          >
            <FlaskConical size={12} /> PROTOTYPE / SAMPLE DATA{" "}
            <ChevronDown size={12} />
          </button>
        ) : (
          <span className="sample-disclosure">
            {liveAuth
              ? "LIVE CAMPAIGNS & RANKINGS"
              : "TEST DATA · NO REAL TOKENS"}
          </span>
        )}
        <span className="strip-end">
          PLAY FIRST. LAUNCH TOGETHER. <ArrowUpRight size={13} />
        </span>
      </div>
      {app.demoTools && preview && (
        <div className="preview-panel">
          <div>
            <strong>Prototype controls</strong>
            <p>
              Campaigns, teams, scores and launch states are local examples. No
              token is issued or traded.
            </p>
          </div>
          <label>
            Campaign stage
            <select
              value={app.getStage(cid)}
              onChange={(e) => app.setStage(cid, e.target.value as Stage)}
            >
              <option value="prelaunch">Pre-launch / locked</option>
              <option value="ready">Requirement reached</option>
              <option value="countdown">Launch countdown</option>
              <option value="live">Launched</option>
            </select>
          </label>
          <div className="preview-context">
            <ReviewDemoControls />
            <CaptainDemoControls />
            <button
              className="btn btn-secondary"
              onClick={() => app.setCompetitionClosed(cid, true)}
            >
              Close demo scoring
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => app.setCompetitionClosed(cid, false)}
            >
              Reopen demo scoring for 7 days
            </button>
            <span>Runtime: {app.platform.runtime}</span>
            <span>Auth: {liveAuth ? "live API adapter" : "demo"}</span>
            <span>Source: {app.entry.source}</span>
            <span>Team source: {app.entry.teamId || "none"}</span>
            <span>Referrer: {app.entry.referrerId || "none"}</span>
          </div>
        </div>
      )}
      {app.notice && (
        <div className="notice" role="status">
          <span>{app.notice}</span>
          <button aria-label="Dismiss notice" onClick={() => app.setNotice("")}>
            <X size={16} />
          </button>
        </div>
      )}
      {app.authError && !app.authOpen && (
        <div className="notice">
          <span>{app.authError}</span>
          <button onClick={() => app.setAuthOpen(true)}>Retry sign in</button>
        </div>
      )}
      <main className="page-container">
        <Routes>
          <Route path="/" element={liveAuth ? <LiveCatalog /> : <Discover />} />
          <Route
            path="/campaign/:id"
            element={liveAuth ? <LiveCatalog /> : <CampaignPage />}
          />
          <Route path="/campaign/:id/play" element={<CampaignGame />} />
          {liveAuth && <Route path="/campaign/:id/compete" element={<LiveGame />} />}
          {liveAuth && <Route path="/campaign/:id/try" element={<TryGame />} />}
          {liveAuth && <Route path="/campaign/:id/session/:sessionId" element={<LiveScore />} />}
          <Route path="/campaign/:id/result/:runId" element={<ResultPage />} />
          <Route path="/campaign/:id/teams" element={liveAuth ? <LiveTeams/> : <TeamPage />} />
          <Route
            path="/campaign/:id/leaderboard"
            element={liveAuth ? <LiveRankings /> : <LeaderboardPage />}
          />
          <Route path="/campaign/:id/launch" element={walletAllowed(app.platform.runtime) ? <LaunchPage /> : <div className="empty-panel"><h1>This page is unavailable in this environment.</h1><Link to="/">Back to games</Link></div>} />
          <Route path="/teams" element={<MyTeamsPage />} />
          <Route path="/leaderboard" element={liveAuth ? <LiveRankings /> : <LeaderboardPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/verification" element={<VerificationPage />} />
          <Route path="/captain" element={<CaptainPage />} />
          <Route
            path="/entry/:channel/:to"
            element={<div className="empty-panel">Opening your campaign…</div>}
          />
          <Route path="/:slug/:team?" element={<NotFound />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <footer>
          <Link to="/" className="footer-brand">
            <img src="/brand-mark.svg" width="28" height="28" alt="" /> P2L
          </Link>
          <span>Ideas become games. Communities unlock tokens.</span>
          <span>
            <Globe2 size={14} /> PLAY IT BEFORE YOU TRADE IT.{" "}
            <ArrowDownRight size={15} />
          </span>
        </footer>
      </main>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        <NavLink to="/" end>
          <LayoutGrid size={19} />
          Discover
        </NavLink>
        <NavLink to="/teams">
          <Users size={19} />
          My teams
        </NavLink>
        <NavLink to="/leaderboard">
          <Trophy size={19} />
          Rankings
        </NavLink>
        <NavLink to="/profile">
          <ShieldCheck size={19} />
          Profile
        </NavLink>
      </nav>
      {app.authOpen && <AuthModal />}
      {app.shareCampaign && <ShareModal campaignId={app.shareCampaign} />}
      {app.toast && (
        <div className="toast" role="status">
          <Check size={18} />
          <span>{app.toast}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => app.setToast("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
function CampaignGame() {
  const { id } = useParams();
  if(liveAuth)return <LiveGame key={id}/>;
  return <GamePage key={id} />;
}
export function Modal({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const prev = document.activeElement as HTMLElement;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "Tab") {
        const nodes = [
          ...document.querySelectorAll<HTMLElement>(
            ".modal button:not(:disabled), .modal input, .modal a[href]",
          ),
        ];
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    document.querySelector<HTMLElement>(".modal button")?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = overflow;
      prev?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-heading">
          <h2>{title}</h2>
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={close}
          >
            <X size={21} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
function AuthModal() {
  const app = useApp();
  const [name, setName] = useState("Early player");
  return (
    <Modal title="Make your play count." close={app.closeAuth}>
      <div className="modal-emblem">
        <ShieldCheck size={32} />
      </div>
      <p className="modal-copy">
        {liveAuth
          ? "Sign in to your account. Your current campaign and invitation stay with you."
          : "Keep your scores, find your team, and follow the next launch. Your current campaign and invitation stay with you."}
      </p>
      {liveAuth ? (
        <LiveAuthForm />
      ) : (
        <>
          <div className="inline-note">
            <FlaskConical size={17} />
            <span>
              Demo profile · stored only on this browser. This is not a verified
              account or wallet.
            </span>
          </div>
          <form
            className="auth-form"
            onSubmit={(e) => {
              e.preventDefault();
              app.completeLogin({
                id: `demo_${app.local.guestId.slice(-12)}`,
                name: name.trim() || "Early player",
                mode: "demo",
              });
            }}
          >
            <label>
              Display name
              <input
                autoComplete="nickname"
                maxLength={24}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </label>
            <button className="btn btn-primary full">
              Continue with demo profile
              <ArrowUpRight size={16} />
            </button>
          </form>
        </>
      )}
      {app.authError && (
        <p className="form-error" role="alert">
          {app.authError}
        </p>
      )}
      <button className="text-link guest-link" onClick={app.closeAuth}>
        Keep playing as a guest <ArrowUpRight size={14} />
      </button>
    </Modal>
  );
}
function ShareModal({ campaignId }: { campaignId: string }) {
  const app = useApp();
  const c = campaigns.find((c) => c.id === campaignId)!;
  const membership = app.local.memberships[campaignId];
  const teamId =
    membership ||
    (app.entry.campaignId === campaignId ? app.entry.teamId : undefined);
  const [destination, setDestination] = useState<"web" | "telegram">("web");
  const links = shareLinks(
    window.location.origin,
    {
      campaignId,
      teamId,
      referrerId: app.user?.id,
      source: "share",
      target: "campaign",
    },
    {
      bot: import.meta.env.VITE_TELEGRAM_BOT_USERNAME,
      app: import.meta.env.VITE_TELEGRAM_APP_NAME,
    },
  );
  const link = destination === "web" ? links.web : links.telegram;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link!);
      app.setToast("Invite link copied.");
    } catch {
      app.setToast("Clipboard unavailable. Select and copy the link below.");
    }
  };
  return (
    <Modal
      title="Good finds deserve good company."
      close={() => app.setShareCampaign(null)}
    >
      <div className="share-preview">
        <span className="eyebrow">PLAY IT BEFORE YOU TRADE IT</span>
        <h3>
          {c.name}
          <ArrowUpRight size={28} />
        </h3>
        <p>
          {teamId
            ? `Play for ${app.standings(campaignId).teams.find((t) => t.id === teamId)?.name || "your team"}.`
            : "Play. Compete. Unlock together."}
        </p>
        <span>${c.ticker} · PLAY TO UNLOCK</span>
      </div>
      <div className="tabs share-tabs">
        <button
          className={destination === "web" ? "selected" : ""}
          onClick={() => setDestination("web")}
        >
          <Globe2 size={15} /> Web link
        </button>
        <button
          className={destination === "telegram" ? "selected" : ""}
          onClick={() => setDestination("telegram")}
        >
          <Send size={15} /> Mini App link
        </button>
      </div>
      {link ? (
        <>
          <label className="copy-field">
            <input
              aria-label="Invite link"
              readOnly
              value={link}
              onFocus={(e) => e.target.select()}
            />
            <button aria-label="Copy invite link" onClick={() => void copy()}>
              <Copy size={18} />
            </button>
          </label>
          <div className="modal-actions">
            <button className="btn btn-primary" onClick={() => void copy()}>
              <Copy size={15} /> Copy link
            </button>
            <a
              className="btn btn-secondary"
              target="_blank"
              rel="noreferrer"
              href={`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(`Play ${c.name} with me. Play it before you trade it.`)}`}
            >
              <Send size={15} /> Share
            </a>
          </div>
        </>
      ) : (
        <div className="inline-note">
          <Send size={20} />
          <span>
            The Telegram Mini App link will be available after the project’s Bot
            and app name are configured. The Web link is ready to use.
          </span>
        </div>
      )}
      {!app.user && (
        <p className="modal-copy small">
          Guest links include the campaign and team. Sign in to attach your
          personal referral.
        </p>
      )}
      {app.user?.mode === "demo" && (
        <p className="modal-copy small">
          Demo referrals preview the flow; they do not earn rewards.
        </p>
      )}
    </Modal>
  );
}
