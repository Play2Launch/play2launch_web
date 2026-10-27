import { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useApp } from "../state";
import { api } from "../lib/api";
import {
  arcadeError,
  attachArcadeBridge,
  type ArcadeGame,
  type ArcadeSession,
  type ArcadeOrder,
  type ArcadeTask,
} from "../lib/arcade";
import "./arcade.css";

export function ArcadeHome() {
  const [games, setGames] = useState<ArcadeGame[]>([]);
  useEffect(() => {
    const c = new AbortController();
    void api
      .request<ArcadeGame[]>("/arcade/games", undefined, { signal: c.signal })
      .then((v) => setGames(v.filter((g) => g.featured).slice(0, 2)))
      .catch(() => {});
    return () => c.abort();
  }, []);
  if (!games.length) return null;
  return (
    <section className="section arcade-home">
      <div className="section-heading">
        <div>
          <div className="eyebrow">PICK UP AND PLAY</div>
          <h2>Games</h2>
        </div>
      </div>
      <div className="arcade-grid">
        {games.map((g) => (
          <Link className="arcade-card" key={g.id} to={`/games/${g.id}`}>
            {g.cover && <img src={g.cover} alt="" loading="lazy" />}
            <div>
              <h3>{g.name}</h3>
              <p>{g.description}</p>
              <span>
                {g.status === "maintenance" ? "Maintenance" : "Explore game →"}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
export function ArcadePreview() {
  const { sessionId = "" } = useParams();
  const app = useApp();
  const [session, setSession] = useState<ArcadeSession>(),
    [error, setError] = useState("");
  useEffect(() => {
    setSession(undefined);
    if (!app.user) return;
    const c = new AbortController();
    void api
      .authenticated<ArcadeSession>(
        `/arcade/sessions/${encodeURIComponent(sessionId)}`,
        undefined,
        c.signal,
      )
      .then((v) => {
        if (!v.test) throw Error("Not a preview session");
        setSession(v);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(arcadeError(e));
      });
    return () => c.abort();
  }, [sessionId, app.user?.id]);
  if (session && app.user)
    return (
      <ArcadePlayer
        key={session.id}
        session={session}
        user={app.user}
        onExit={() => {
          setSession(undefined);
          setError("Preview ended. Create a new session from the admin.");
        }}
      />
    );
  return (
    <main className="arcade-detail">
      <h1>Game preview</h1>
      {error && <p role="alert">{error}</p>}
      {!app.user ? (
        <button
          className="btn btn-primary"
          onClick={() => app.setAuthOpen(true)}
        >
          Sign in with your admin account
        </button>
      ) : (
        !error && <p>Preparing preview…</p>
      )}
      <Link to="/">Return home</Link>
    </main>
  );
}
export default function ArcadePage() {
  const { gameId = "" } = useParams();
  const [query] = useSearchParams();
  const [revision, setRevision] = useState(0),
    [hasSave, setHasSave] = useState(false);
  const campaign = query.get("campaign");
  const [related, setRelated] = useState<{ slug: string; name: string }[]>([]);
  const app = useApp();
  const [game, setGame] = useState<ArcadeGame>(),
    [error, setError] = useState(""),
    [session, setSession] = useState<ArcadeSession>(),
    [busy, setBusy] = useState(false),
    [tasks, setTasks] = useState<ArcadeTask[]>([]),
    [progress, setProgress] = useState<{ metric: string; value: number }[]>([]);
  useEffect(() => {
    setGame(undefined);
    setError("");
    const c = new AbortController();
    void api
      .request<ArcadeGame>(
        `/arcade/games/${encodeURIComponent(gameId)}`,
        undefined,
        { signal: c.signal },
      )
      .then(setGame)
      .catch((e) => {
        if (!c.signal.aborted) setError(arcadeError(e));
      });
    return () => c.abort();
  }, [gameId]);
  useEffect(() => {
    setSession(undefined);
    setTasks([]);
    setProgress([]);
    setHasSave(false);
    if (!app.user || app.user.mode !== "live") return;
    const c = new AbortController();
    void api
      .authenticated<{ has_save: boolean }>(
        `/arcade/games/${gameId}/save-status`,
        undefined,
        c.signal,
      )
      .then((v) => setHasSave(v.has_save))
      .catch(() => {});
    void api
      .authenticated<ArcadeTask[]>(
        `/arcade/tasks?game=${gameId}`,
        undefined,
        c.signal,
      )
      .then(setTasks)
      .catch(() => {});
    void api
      .authenticated<{ metric: string; value: number }[]>(
        `/arcade/games/${gameId}/progress`,
        undefined,
        c.signal,
      )
      .then(setProgress)
      .catch(() => {});
    return () => c.abort();
  }, [gameId, app.user?.id, revision]);
  useEffect(() => {
    void api
      .request<{ slug: string; name: string }[]>(
        `/arcade/games/${gameId}/campaigns`,
      )
      .then(setRelated)
      .catch(() => setRelated([]));
  }, [gameId]);
  const start = async () => {
    if (!app.user || app.user.mode !== "live") {
      app.setAuthOpen(true);
      return;
    }
    setBusy(true);
    setError("");
    try {
      setSession(
        await api.authenticated<ArcadeSession>(
          campaign
            ? `/arcade/campaigns/${encodeURIComponent(campaign)}/session`
            : `/arcade/games/${gameId}/sessions`,
          {},
        ),
      );
    } catch (e) {
      setError(arcadeError(e, game));
    } finally {
      setBusy(false);
    }
  };
  if (session && app.user)
    return (
      <ArcadePlayer
        key={session.id}
        session={session}
        user={app.user}
        onExit={() => {
          setSession(undefined);
          setRevision((v) => v + 1);
        }}
      />
    );
  return (
    <main className="arcade-detail">
      <Link to="/">← Discover</Link>
      {error && (
        <div role="alert" className="arcade-notice">
          {error}
        </div>
      )}
      {!game && !error && <p>Loading game…</p>}
      {game && (
        <>
          {game.cover ? (
            <img className="arcade-hero" src={game.cover} alt="" />
          ) : <div className="arcade-hero-fallback" aria-hidden="true">{game.icon?<img src={game.icon} alt=""/>:game.name.slice(0,1)}</div>}
          <div className="arcade-title">
            <div>
              <h1>{game.name}</h1>
              <p>{game.tags?.join(" · ")}</p>
              <p>{game.description}</p>
            </div>
            <button
              className="btn btn-primary"
              disabled={busy || game.status !== "online"}
              onClick={() => void start()}
            >
              {game.status !== "online"
                ? "Under maintenance"
                : busy
                  ? "Preparing…"
                  : campaign
                    ? "Play for activity"
                    : hasSave
                      ? "Continue game"
                      : "Start game"}
            </button>
          </div>
          {campaign && (
            <p className="arcade-notice">
              Activity:{" "}
              {related.find((c) => c.slug === campaign)?.name || campaign} ·
              Client-reported score
            </p>
          )}
          {!campaign && related.length > 0 && (
            <section>
              <h2>Related activities</h2>
              {related.map((c) => (
                <p key={c.slug}>
                  <Link to={`/campaign/${c.slug}`}>{c.name} →</Link>
                </p>
              ))}
            </section>
          )}
          {progress.some((p) =>
            game.metrics.some((m) => m.show && m.key === p.metric),
          ) && (
            <section>
              <h2>My progress</h2>
              <div className="arcade-stats">
                {game.metrics
                  .filter((m) => m.show)
                  .map((m) => {
                    const p = progress.find((p) => p.metric === m.key);
                    return p ? (
                      <div key={m.key}>
                        <small>{m.name}</small>
                        <strong>
                          {p.value.toLocaleString()} {m.unit}
                        </strong>
                      </div>
                    ) : null;
                  })}
              </div>
            </section>
          )}
          {tasks.length > 0 && (
            <section>
              <h2>Game tasks</h2>
              {tasks.map((t) => (
                <div className="arcade-task" key={t.task.id}>
                  <div>
                    <strong>{t.task.name}</strong>
                    <p>{t.task.description}</p>
                    <small>
                      {t.progress} / {t.task.target}
                    </small>
                  </div>
                  <span>
                    {t.credited ? "✓ Credited" : `+${t.task.reward} Points`}
                  </span>
                </div>
              ))}
            </section>
          )}
          {game.instructions && (
            <section>
              <h2>How to play</h2>
              <p style={{ whiteSpace: "pre-wrap" }}>{game.instructions}</p>
            </section>
          )}
          {game.screenshots?.length > 0 && (
            <div className="arcade-grid">
              {game.screenshots.map((u) => (
                <img
                  key={u}
                  src={u}
                  alt={`${game.name} gameplay`}
                  loading="lazy"
                />
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
export function ArcadePlayer({
  session,
  user,
  onExit,
}: {
  session: ArcadeSession;
  user: { id: string; name: string; handle?: string; avatarUrl?: string };
  onExit: () => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null),
    confirmRef = useRef<((value: boolean) => void) | null>(null);
  const [ready, setReady] = useState(false),
    [progress, setProgress] = useState(0),
    [notice, setNotice] = useState(""),
    [order, setOrder] = useState<ArcadeOrder>(),
    [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    if (!frame.current) return;
    const detach = attachArcadeBridge({
      frame: frame.current,
      session,
      user,
      onProgress: setProgress,
      onReady: () => setReady(true),
      onNotice: setNotice,
      onExit,
      confirm: (o) =>
        new Promise((resolve) => {
          confirmRef.current = resolve;
          setOrder(o);
        }),
    });
    const timer = window.setTimeout(() => setTimedOut(true), 90000);
    return () => {
      detach();
      clearTimeout(timer);
      confirmRef.current?.(false);
      confirmRef.current = null;
    };
  }, [session.id, user.id]);
  const decide = (value: boolean) => {
    confirmRef.current?.(value);
    confirmRef.current = null;
    setOrder(undefined);
  };
  if (new URL(session.game.entry_url).origin === window.location.origin)
    return (
      <main className="arcade-detail">
        <p role="alert">Games must be hosted on a separate origin from P2L.</p>
        <button className="btn btn-secondary" onClick={onExit}>
          Return
        </button>
      </main>
    );
  return (
    <main className="arcade-player">
      <header>
        <strong>
          {session.game.name}
          {session.test ? " · Test" : ""}
        </strong>
        <button className="btn btn-secondary" onClick={onExit}>
          Exit game
        </button>
      </header>
      <div className="arcade-stage">
        <div className="arcade-viewport" style={session.game.aspect_width && session.game.aspect_height ? {
          width: `min(100cqw, ${100 * session.game.aspect_width / session.game.aspect_height}cqh)`,
          height: `min(100cqh, ${100 * session.game.aspect_height / session.game.aspect_width}cqw)`,
        } : undefined}>
        <iframe
          ref={frame}
          src={session.game.entry_url}
          title={session.game.name}
          allow="fullscreen; autoplay"
          sandbox="allow-scripts allow-same-origin allow-pointer-lock"
        />
        {!ready && (
          <div className="arcade-loading" role="status">
            <div className="arcade-loader" />
            <h2>
              {timedOut
                ? "Loading is taking longer than expected"
                : `Loading ${session.game.name}`}
            </h2>
            {progress > 0 && <progress max={1} value={progress} />}
            <p>
              {progress > 0
                ? `${Math.round(progress * 100)}%`
                : "Preparing your game"}
            </p>
            {timedOut && (
              <button className="btn btn-secondary" onClick={onExit}>
                Return and retry
              </button>
            )}
          </div>
        )}
        </div>
      </div>
      {notice && (
        <div
          className="arcade-modal"
          role="alertdialog"
          aria-label="Game message"
        >
          <div>
            <p>{notice}</p>
            <button className="btn btn-primary" onClick={() => setNotice("")}>
              OK
            </button>
          </div>
        </div>
      )}
      {order && (
        <div
          className="arcade-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm crystal purchase"
        >
          <div>
            <h2>{order.title}</h2>
            <p>{order.description}</p>
            <strong>{order.price.toLocaleString()} 水晶</strong>
            <p>充值暂未开放。确认后从账户扣除水晶。</p>
            <div className="arcade-actions">
              <button
                className="btn btn-secondary"
                onClick={() => decide(false)}
              >
                Cancel
              </button>
              <button className="btn btn-primary" onClick={() => decide(true)}>
                Confirm purchase
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
