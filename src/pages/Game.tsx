import { useEffect, useRef, useState } from "react";
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  Check,
  Clock3,
  Gamepad2,
  LockKeyhole,
  Pause,
  Play,
  RotateCcw,
  Save,
  Send,
  Sparkles,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { number, teams, type Campaign } from "../data";
import { useApp } from "../state";
import { CompetitionRules } from "../CompetitionRules";
import { priceAt, scoreTrade, totalScore, type Trade } from "../lib/game";
import { NotFound, useCampaign } from "./Campaign";
import { trackGameEvent } from "../lib/firebaseAnalytics";

export function GamePage({
  live,
}: {
  live?: {
    campaign: Campaign;
    seed: number;
    sessionId: string;
    team: string;
    finish: (trades: { buy_tick: number; sell_tick: number }[]) => void;
  };
} = {}) {
  const demoCampaign = useCampaign();
  const c = live?.campaign ?? demoCampaign;
  const app = useApp();
  const nav = useNavigate();
  const [phase, setPhase] = useState<
    "ready" | "playing" | "paused" | "finished"
  >(live ? "playing" : "ready");
  const [tick, setTick] = useState(0);
  const [holding, setHolding] = useState<number | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [feedback, setFeedback] = useState(
    "Buy high. Wait for the dip. Sell low.",
  );
  const [seed] = useState(() => live?.seed ?? Math.random() * 6);
  const operations = useRef<{ buy_tick: number; sell_tick: number }[]>([]);
  const buyTick = useRef<number | null>(null);
  const lastAction = useRef(-1);
  const finished = useRef(false);
  const tickRef = useRef(0);
  const analyticsStarted = useRef(false);
  const analyticsEffective = useRef(false);
  const remaining = Math.max(0, 30 - Math.floor(tick / 4));
  const price = priceAt(tick, seed);
  useEffect(() => {
    if (c?.id !== "phood" || phase !== "playing" || analyticsStarted.current) return;
    analyticsStarted.current = true;
    trackGameEvent("game_start", c.id, live ? "ranked" : "trial", live?.sessionId);
  }, [c?.id, live?.sessionId, phase]);
  useEffect(() => {
    if (c?.id !== "phood" || tick < 60 || analyticsEffective.current || !analyticsStarted.current) return;
    analyticsEffective.current = true;
    trackGameEvent("game_effective", c.id, live ? "ranked" : "trial", live?.sessionId);
  }, [c?.id, live?.sessionId, tick]);
  const member = app
    .standings(c?.id || "")
    .teams.find((t) => t.id === app.local.memberships[c?.id || ""]);
  const finish = () => {
    if (finished.current || !c) return;
    finished.current = true;
    setPhase("finished");
    if (live) {
      const actions = [...operations.current];
      if (buyTick.current !== null && buyTick.current < 120)
        actions.push({ buy_tick: buyTick.current, sell_tick: 120 });
      live.finish(actions);
      return;
    }
    const final =
      holding === null
        ? trades
        : [
            ...trades,
            { buy: holding, sell: price, points: scoreTrade(holding, price) },
          ];
    const run = app.addRun(c.id, totalScore(final), final.length);
    nav(`/campaign/${c.id}/result/${run.id}`, { replace: true });
  };
  useEffect(() => {
    if (phase !== "playing") return;
    const started = performance.now();
    const interval = setInterval(() => {
      tickRef.current = live
        ? Math.min(120, Math.floor((performance.now() - started) / 250))
        : tickRef.current + 1;
      setTick(tickRef.current);
    }, 250);
    return () => clearInterval(interval);
  }, [phase]);
  useEffect(() => {
    if (tick >= 120 && phase === "playing") finish();
  }, [tick]);
  useEffect(() => {
    const visibility = () => {
      if (document.hidden && !live)
        setPhase((p) => (p === "playing" ? "paused" : p));
    };
    document.addEventListener("visibilitychange", visibility);
    return () => document.removeEventListener("visibilitychange", visibility);
  }, []);
  if (!c) return <NotFound />;
  if (c.id !== "phood" && live?.campaign.game_key !== "paperhood")
    return (
      <div className="empty-panel">
        <Gamepad2 size={38} />
        <h1>{c.name} is warming up.</h1>
        <p>Its game is coming soon. PAPERHOOD is ready to play now.</p>
        <Link to="/campaign/phood/play" className="btn btn-primary">
          Play PAPERHOOD
          <Play size={17} />
        </Link>
        <Link to={`/campaign/${c.id}`} className="text-link">
          Back to campaign
        </Link>
      </div>
    );
  const points = Array.from({ length: Math.min(tick + 1, 61) }, (_, i) => {
    const t = Math.max(0, tick - 60) + i;
    return `${i * (600 / 60)},${260 - (priceAt(t, seed) - 15) * 1.5}`;
  }).join(" ");
  const act = () => {
    if (phase !== "playing") return;
    if (live) {
      if (tick >= 120 || tick <= lastAction.current) return;
      lastAction.current = tick;
      if (buyTick.current === null) buyTick.current = tick;
      else {
        operations.current.push({ buy_tick: buyTick.current, sell_tick: tick });
        buyTick.current = null;
      }
    }
    if (holding === null) {
      setHolding(price);
      setFeedback(`Bought at $${price.toFixed(2)}. Now panic responsibly.`);
    } else {
      const points = scoreTrade(holding, price);
      setTrades((t) => [...t, { buy: holding, sell: price, points }]);
      setHolding(null);
      setFeedback(
        points
          ? `Beautifully bad. +${number(points)} paper hands points.`
          : "You made a profit. Unfortunately, that’s 0 points here.",
      );
    }
  };
  return (
    <div className="game-page">
      <div className="game-topbar">
        <Link to={`/campaign/${c.id}`} className="text-link">
          <ArrowLeft size={16} />
          Campaign
        </Link>
        <span className="pill acid">
          <Zap size={12} /> PAPERHOOD
        </span>
        <span className="muted">
          30 SEC / {live ? "RANKED ROUND" : "PRACTICE"}
        </span>
      </div>
      <div className="game-layout">
        <section className="trading-game">
          <div className="game-heading">
            <div>
              <span className="eyebrow">THE WORST TRADER WINS</span>
              <h1>
                BUY HIGH.
                <br />
                <em>SELL LOW.</em>
                <ArrowDownRight />
              </h1>
            </div>
            <button
              className="icon-button"
              aria-label={phase === "paused" ? "Resume round" : "Pause round"}
              disabled={!!live || phase === "ready"}
              onClick={() =>
                setPhase((p) => (p === "playing" ? "paused" : "playing"))
              }
            >
              {phase === "paused" ? <Play size={20} /> : <Pause size={20} />}
            </button>
          </div>
          <div className="game-hud">
            <div>
              <span>PAPER HANDS SCORE</span>
              <strong>{number(totalScore(trades))}</strong>
            </div>
            <div>
              <span>
                <Clock3 size={12} /> TIME LEFT
              </span>
              <strong className={remaining < 10 ? "negative" : ""}>
                {String(remaining).padStart(2, "0")}
                <small>s</small>
              </strong>
            </div>
          </div>
          <div className="chart-area">
            <div className="chart-caption">
              <span>$PHOOD / FICTIONAL PRICE</span>
              <strong>${price.toFixed(2)}</strong>
            </div>
            <div className="chart-labels">
              <span>$175</span>
              <span>$125</span>
              <span>$75</span>
              <span>$25</span>
            </div>
            <svg
              viewBox="0 0 600 270"
              preserveAspectRatio="none"
              className="price-chart"
              aria-label="Simulated price chart"
            >
              <defs>
                <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#d2fa69" stopOpacity=".18" />
                  <stop offset="100%" stopColor="#d2fa69" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[40, 110, 180, 250].map((y) => (
                <line
                  key={y}
                  x1="0"
                  x2="600"
                  y1={y}
                  y2={y}
                  stroke="#ffffff0c"
                  strokeDasharray="4 5"
                />
              ))}
              {holding !== null && (
                <line
                  x1="0"
                  x2="600"
                  y1={260 - (holding - 15) * 1.5}
                  y2={260 - (holding - 15) * 1.5}
                  stroke="#fbac83"
                  strokeDasharray="6 6"
                />
              )}
              <polygon
                points={`0,270 ${points} ${Math.min(tick, 60) * 10},270`}
                fill="url(#chartFill)"
              />
              <polyline
                points={points}
                fill="none"
                stroke="#d2fa69"
                strokeWidth="3"
                strokeLinejoin="round"
              />
              <circle
                cx={Math.min(tick, 60) * 10}
                cy={260 - (price - 15) * 1.5}
                r="5"
                fill="#d2fa69"
              />
            </svg>
            {phase === "ready" && (
              <div className="game-overlay">
                <span className="game-start-icon">
                  <Play size={30} fill="currentColor" />
                </span>
                <h2>Lose like a legend.</h2>
                <p>
                  Buy at a high price. Sell when it drops.
                  <br />
                  The bigger your loss, the higher your score.
                </p>
                <button
                  className="btn btn-primary big"
                  onClick={() => setPhase("playing")}
                >
                  Let’s make bad decisions
                  <ArrowUpRight size={17} />
                </button>
                <span>Free practice · No real money or tokens</span>
              </div>
            )}
            {phase === "paused" && (
              <div className="game-overlay">
                <Pause size={30} />
                <h2>Take a breath.</h2>
                <p>Your timer is paused.</p>
                <button
                  className="btn btn-primary"
                  onClick={() => setPhase("playing")}
                >
                  Resume round
                  <Play size={16} />
                </button>
              </div>
            )}
          </div>
          <div className="trade-position">
            <span>
              {holding === null
                ? "NO OPEN POSITION"
                : `BOUGHT AT $${holding.toFixed(2)}`}
            </span>
            <strong
              className={
                holding !== null && price < holding ? "accent" : "negative"
              }
            >
              {holding === null
                ? "Waiting for your next move"
                : `${price < holding ? "−" : "+"}${Math.abs(((price - holding) / holding) * 100).toFixed(2)}%`}
            </strong>
          </div>
          <div className="game-feedback" role="status">
            {feedback}
          </div>
          <button
            className={`trade-button ${holding !== null ? "sell" : ""}`}
            disabled={phase !== "playing"}
            onClick={act}
          >
            {holding === null ? (
              <>
                <ArrowUpRight size={25} />
                BUY HIGH
              </>
            ) : (
              <>
                <ArrowDownRight size={25} />
                PANIC SELL
              </>
            )}
            <span>
              {holding === null ? "Catch the top" : "Embrace the dip"}
            </span>
          </button>
          <div className="game-bottom">
            <span>{trades.length} completed trades</span>
            <span>Open positions settle when time runs out.</span>
          </div>
        </section>
        <aside className="game-sidebar">
          <img src="/images/paperhood.png" alt="Paperhood mascot" />
          <div className="game-coach">
            <span className="eyebrow">A MESSAGE FROM PAPERHOOD</span>
            <h2>
              “Profit is temporary.
              <br />
              Paper hands are forever.”
            </h2>
            <p>
              Tap BUY HIGH near a peak. When the price falls below your
              purchase, tap PANIC SELL. You can trade more than once.
            </p>
            <div className="inline-note">
              <Trophy size={20} />
              <span>
                Points = loss percentage × 100. Profitable trades earn zero
                points.
              </span>
            </div>
          </div>
          <div className="game-team">
            <Users size={19} />
            <div>
              <strong>
                {live
                  ? `Playing for ${live.team}`
                  : member
                    ? `Playing for ${member.name}`
                    : "Playing solo, for now."}
              </strong>
              <p>
                {member
                  ? "Your local team is cheering you on."
                  : "Join a team after your round."}
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export function ResultPage() {
  const c = useCampaign();
  const { runId } = useParams();
  const app = useApp();
  if (!c) return <NotFound />;
  const run = app.local.runs.find(
    (r) => r.id === runId && r.campaignId === c.id,
  );
  if (!run)
    return (
      <div className="empty-panel">
        <Trophy size={36} />
        <h1>This round isn’t on this device.</h1>
        <p>Play a new round to set your score.</p>
        <Link to={`/campaign/${c.id}/play`} className="btn btn-primary">
          Play again
          <Play size={16} />
        </Link>
      </div>
    );
  const member = app
    .standings(c.id)
    .teams.find((t) => t.id === app.local.memberships[c.id]);
  const best =
    run.score >=
    Math.max(
      ...app.local.runs
        .filter((r) => r.campaignId === c.id)
        .map((r) => r.score),
    );
  return (
    <div className="result-page">
      <Link to={`/campaign/${c.id}`} className="text-link">
        <ArrowLeft size={16} />
        Back to campaign
      </Link>
      <div className="result-layout">
        <section className="result-card">
          <span className="pill acid">
            <Sparkles size={13} />
            {best ? "PERSONAL BEST" : "ROUND COMPLETE"}
          </span>
          <div className="result-symbol">
            <Trophy size={48} />
          </div>
          <span className="eyebrow">BUY HIGH. SELL LOW.</span>
          <h1>
            {run.score > 0 ? "Spectacularly bad." : "A little too profitable."}
          </h1>
          <p>
            {run.score > 0
              ? "Paperhood would be proud. Your hands? Officially paper."
              : "Try buying higher and selling lower next round."}
          </p>
          <span className="score-label">PAPER HANDS SCORE</span>
          <strong className="result-score">{number(run.score)}</strong>
          <div className="result-stats">
            <div>
              <b>{run.trades}</b>
              <span>Trades completed</span>
            </div>
            <div>
              <b>30s</b>
              <span>Round length</span>
            </div>
            <div>
              <b>{member?.name || "Solo"}</b>
              <span>Your team</span>
            </div>
          </div>
          <div className="result-actions">
            <Link to={`/campaign/${c.id}/play`} className="btn btn-primary big">
              <RotateCcw size={18} />
              Play again
              <ArrowUpRight size={17} />
            </Link>
            <button
              className="btn btn-secondary big"
              disabled={run.saved}
              onClick={() => app.saveRun(run.id)}
            >
              {run.saved ? <Check size={18} /> : <Save size={18} />}{" "}
              {run.saved ? "Saved locally" : "Save score"}
            </button>
          </div>
          <button
            className="text-link guest-link"
            onClick={() => app.setShareCampaign(c.id)}
          >
            <Send size={16} />
            Share the shame
          </button>
          <p className="small muted">
            {app.local.competition.submitted.includes(run.id)
              ? "Accepted into demo standings. Only improvements to your highest score add unlock contribution."
              : "Practice only until submitted before the deadline. At least one completed trade is required. No live backend verification."}
          </p>
        </section>
        <aside className="result-aside">
          <CompetitionRules campaignId={c.id} />
          <section className="unlock-panel">
            <LockKeyhole size={24} className="accent" />
            <h2>
              A little play.
              <br />A bigger movement.
            </h2>
            <p>You’re part of the beginning.</p>
            <div className="unlock-number">
              <strong>{number(c.unlockPoints ?? 0)}</strong>
              <span> / {number(c.target)}</span>
            </div>
            <div className="progress-track">
              <i
                style={{
                  width: `${Math.min(((c.unlockPoints ?? 0) / Math.max(c.target, 1)) * 100, 100)}%`,
                }}
              />
            </div>
            <div className="progress-caption">
              <span>Unlock contribution · demo</span>
              <b>
                {Math.round(
                  ((c.unlockPoints ?? 0) / Math.max(c.target, 1)) * 100,
                )}
                %
              </b>
            </div>
            <p className="small muted">
              Each player contributes their best accepted score divided by{" "}
              {c.score_per_unlock_point}, rounded down. Only improvements add
              points. No live launch progress is affected.
            </p>
            <Link to={`/campaign/${c.id}/launch`} className="text-link">
              Follow the launch
              <ArrowUpRight size={16} />
            </Link>
          </section>
          <section className="your-team-panel">
            <Users size={23} className="accent" />
            <h3>
              {member
                ? `Keep ${member.name} climbing.`
                : "Your next round deserves a team."}
            </h3>
            <p>Find your crew and climb together.</p>
            <Link
              to={`/campaign/${c.id}/teams`}
              className="btn btn-secondary full"
            >
              {member ? "View your team" : "Choose your team"}
              <ArrowUpRight size={15} />
            </Link>
          </section>
          <Link className="text-link" to={`/campaign/${c.id}/leaderboard`}>
            <Trophy size={17} />
            Explore the leaderboard
            <ArrowUpRight size={15} />
          </Link>
        </aside>
      </div>
    </div>
  );
}
