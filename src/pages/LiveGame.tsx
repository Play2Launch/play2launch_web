import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { getCampaign } from "../lib/catalog";
import { myMembership, listTeams } from "../lib/teams";
import { useApp } from "../state";
import { GamePage } from "./Game";
import type { Campaign } from "../data";
import { RunnerFrame } from './RunnerFrame';
import { RUNNER_RULES } from '../lib/runner';
type Operation = { buy_tick: number; sell_tick: number };
type Session = {
  game_key?: string;
  protocol_version?: string;
  id: string;
  slug: string;
  seed: number;
  rules: string;
  status: string;
  score: number;
  team_id: string;
};
function check(s: Session, slug: string) {
  if (
    !s ||
    !/^gs[0-9a-z]+$/.test(s.id) ||
    s.slug !== slug ||
    !((s.rules === "paperhood-v1" && (!s.game_key || s.game_key === "paperhood")) || (s.rules === RUNNER_RULES && /^gx[0-9a-z]{1,13}$/.test(s.game_key||""))) ||
    (s.protocol_version !== undefined && s.protocol_version !== "" && s.protocol_version !== "p2l-game-v1") ||
    !Number.isFinite(s.seed) ||
    s.seed < 0 ||
    (/^gx[0-9a-z]{1,13}$/.test(s.game_key||'') ? (!Number.isInteger(s.seed)||s.seed>0xffffffff) : s.seed>=6) ||
    !Number.isSafeInteger(s.score) ||
    s.score < 0 ||
    !["playing", "accepted", "expired"].includes(s.status)
  )
    throw new Error("Invalid game session response.");
  return s;
}
export function LiveGame() {
  const app = useApp();
  const { id = "" } = useParams();
  return <Round key={`${id}:${app.user?.id || "guest"}`} slug={id} />;
}
function Round({ slug }: { slug: string }) {
  const app = useApp();
  const nav = useNavigate();
  const [campaign, setCampaign] = useState<Campaign>();
  const [team, setTeam] = useState("");
  const [session, setSession] = useState<Session>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [actions, setActions] = useState<Operation[] | null>(null);
  const lock = useRef(false);
  const alive = useRef(true);
  const ctrl = useRef(new AbortController());
  useEffect(() => {
    alive.current = true;
    ctrl.current = new AbortController();
    const signal = ctrl.current.signal;
    getCampaign(slug, signal)
      .then((c) => {
        if (!signal.aborted)
          setCampaign({
            ...c,
            id: c.slug,
            players: 0,
            teams: 0,
            growth: 0,
            score: 0,
          });
      })
      .catch((e) => {
        if (!signal.aborted) setError(e.message);
      });
    if (app.user)
      Promise.all([myMembership(slug, signal), listTeams(slug, signal)])
        .then(([m, t]) => {
          if (!signal.aborted)
            setTeam(t.find((v) => v.id === m?.team_id)?.name || "");
        })
        .catch((e) => {
          if (!signal.aborted) setError(e.message);
        });
    return () => {
      alive.current = false;
      ctrl.current.abort();
    };
  }, [slug, app.user?.id]);
  async function start() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const run = check(
        await api.authenticated<Session>(
          `/campaigns/${encodeURIComponent(slug)}/sessions`,
          {},
          ctrl.current.signal,
        ),
        slug,
      );
      if (alive.current) setSession(run);
    } catch (e) {
      if (alive.current)
        setError(e instanceof Error ? e.message : "Could not start.");
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  async function submit(input: Operation[]) {
    if (!session || lock.current) return;
    lock.current = true;
    setActions(input);
    setBusy(true);
    setError("");
    try {
      const run = check(
        await api.authenticated<Session>(
          `/game/sessions/${session.id}/submit`,
          { trades: input },
          ctrl.current.signal,
        ),
        slug,
      );
      if (run.status !== "accepted") throw new Error("Score was not accepted.");
      window.dispatchEvent(new Event('p2l:points-changed'));
      if (alive.current)
        nav(`/campaign/${slug}/session/${run.id}`, { replace: true });
    } catch (e) {
      if (alive.current)
        setError(
          e instanceof Error
            ? e.message
            : "Submission failed. Retry the same record.",
        );
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  if (!app.user)
    return (
      <div className="empty-panel">
        <h1>Sign in to play for your team</h1>
        {campaign && /^gx[0-9a-z]{1,13}$/.test(campaign.game_key||'') && <Link className="btn btn-secondary" to={`/campaign/${slug}/try`}>Try it first</Link>}
        <button
          className="btn btn-primary"
          onClick={() => app.setAuthOpen(true)}
        >
          Sign in
        </button>
      </div>
    );
  if(campaign && /^gx[0-9a-z]{1,13}$/.test(campaign.game_key||'') && campaign.rules_version===RUNNER_RULES) {
    if(!team)return <div className="empty-panel"><Link className="btn btn-primary" to={`/campaign/${slug}/teams`}>Choose a team first</Link><Link className="btn btn-secondary" to={`/campaign/${slug}/try`}>Try it first</Link></div>;
    return <RunnerFrame slug={slug}/>;
  }
  return (
    <>
      {error && (
        <div role="alert" className="notice">
          {error}
          {actions && (
            <button disabled={busy} onClick={() => submit(actions)}>
              Retry submission
            </button>
          )}
        </div>
      )}
      {busy && (
        <p role="status">
          {actions
            ? "Submitting operations for server validation…"
            : "Starting server round…"}
        </p>
      )}
      {session && campaign ? (
        <GamePage
          key={session.id}
          live={{ campaign, seed: session.seed, team, finish: submit }}
        />
      ) : (
        <div className="empty-panel">
          <h1>{campaign?.name || "Loading campaign…"}</h1>
          <p>Ranked round · 30 seconds · No pause or real rewards.</p>
          {campaign?.game_key !== "paperhood" || campaign?.rules_version !== "paperhood-v1" ? (
            <p>This game is not available yet.</p>
          ) : team ? (
            <>
              <p>
                Playing for {team}. Your score is recalculated by the server.
              </p>
              <button
                disabled={busy || !campaign}
                className="btn btn-primary"
                onClick={start}
              >
                Start ranked round
              </button>
            </>
          ) : (
            <Link className="btn btn-primary" to={`/campaign/${slug}/teams`}>
              Choose a team first
            </Link>
          )}
        </div>
      )}
    </>
  );
}
export function LiveScore() {
  const { id = "", sessionId = "" } = useParams();
  const app = useApp();
  return (
    <Score
      key={`${sessionId}:${app.user?.id || "guest"}`}
      slug={id}
      sessionId={sessionId}
    />
  );
}
type Summary = {
  unlock_contribution?: number | null;
  round_unlock_improvement?: number | null;
  score_per_unlock_point?: number;
  session_id: string;
  personal_best: number;
  previous_best: number;
  round_improvement: number;
  team_contribution: number;
  team_total: number;
  as_of: string;
};
function Score({ slug, sessionId }: { slug: string; sessionId: string }) {
  const app = useApp();
  const [run, setRun] = useState<Session>();
  const [summary, setSummary] = useState<Summary>();
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!app.user) return;
    const ctrl = new AbortController();
    setError("");
    setSummary(undefined);
    api
      .authenticated<Session>(
        `/game/sessions/${encodeURIComponent(sessionId)}`,
        undefined,
        ctrl.signal,
      )
      .then(async (s) => {
        if (ctrl.signal.aborted) return;
        setRun(check(s, slug));
        if (s.status !== "accepted") return;
        const d = await api.authenticated<Summary>(
          `/game/sessions/${encodeURIComponent(sessionId)}/summary`,
          undefined,
          ctrl.signal,
        );
        if (
          !d ||
          d.session_id !== sessionId ||
          ![
            d.personal_best,
            d.previous_best,
            d.round_improvement,
            d.team_contribution,
            d.team_total,
          ].every((v) => Number.isSafeInteger(v) && v >= 0) ||
          d.team_contribution !== d.personal_best ||
          d.team_total < d.team_contribution ||
          d.personal_best < s.score ||
          d.round_improvement !== Math.max(0, s.score - d.previous_best) ||
          !Number.isFinite(Date.parse(d.as_of))
        )
          throw new Error(
            "Contribution details are unavailable. Retry to reload them.",
          );
        if (!ctrl.signal.aborted) setSummary(d);
      })
      .catch((e) => {
        if (!ctrl.signal.aborted) setError(e.message);
      });
    return () => ctrl.abort();
  }, [sessionId, slug, app.user?.id, retry]);
  return (
    <section className="empty-panel">
      <span className="pill acid">SERVER RESULT</span>
      <h1>
        {run?.status === "accepted"
          ? "Score accepted"
          : run
            ? "Round not submitted"
            : "Your result"}
      </h1>
      {run?.status === "accepted" && (
        <h2>{run.score.toLocaleString()} points</h2>
      )}
      {summary && (
        <>
          <div className="membership-grid server-result-stats">
            <article className="membership-card">
              <span>Current personal best</span>
              <h2>{summary.personal_best.toLocaleString()}</h2>
              <p>
                Your contribution to the team:{" "}
                {summary.team_contribution.toLocaleString()} points.
              </p>
            </article>
            <article className="membership-card">
              <span>This round’s improvement</span>
              <h2>+{summary.round_improvement.toLocaleString()}</h2>
              <p>
                {summary.round_improvement > 0
                  ? "Improved your previous best."
                  : "No extra team points from this round."}{" "}
                Previous best: {summary.previous_best.toLocaleString()}.
              </p>
            </article>
            <article className="membership-card">
              <span>Current team total (game points)</span>
              <h2>{summary.team_total.toLocaleString()}</h2>
              <p>Sum of each member’s best accepted score, not all rounds.</p>
            </article>
          </div>
          {Number.isSafeInteger(summary.unlock_contribution) &&
            Number.isSafeInteger(summary.round_unlock_improvement) &&
            (summary.score_per_unlock_point ?? 0) > 0 && (
              <div className="membership-card">
                <span>Unlock contribution</span>
                <h2>
                  {summary.unlock_contribution?.toLocaleString()} unlock points
                </h2>
                <p>
                  This round added +{summary.round_unlock_improvement} unlock
                  points. Every {summary.score_per_unlock_point} game points in
                  your personal best converts to 1 unlock point, rounded down.
                </p>
              </div>
            )}
          <p className="muted">
            Current totals may increase after later rounds. This round’s
            improvement stays tied to its acceptance order.
          </p>
        </>
      )}
      {!app.user && (
        <button
          className="btn btn-primary"
          onClick={() => app.setAuthOpen(true)}
        >
          Sign in to view result
        </button>
      )}
      {error && (
        <p role="alert">
          {error}
          <button onClick={() => setRetry((n) => n + 1)}>Retry</button>
        </p>
      )}
      <p>
        Only server-accepted rounds count toward the leaderboard. No tokens or
        rewards.
      </p>
      <Link className="btn btn-primary" to={`/campaign/${slug}/leaderboard`}>
        View leaderboard
      </Link>
      <Link to={`/campaign/${slug}/compete`}>Play again</Link>
    </section>
  );
}
export {default as LiveRankings} from "./LiveRankings";
