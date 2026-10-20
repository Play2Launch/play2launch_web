import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { runnerURL } from "../lib/runner";
import { createRealtimeBridge, REALTIME_RULES } from "../lib/realtimeBridge";

export function RealtimeFrame({ slug }: { slug: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [game, setGame] = useState<{
      game_id: string;
      entry_url: string;
      rules_version: string;
    }>(),
    [error, setError] = useState(""),
    [status, setStatus] = useState("Loading game…");
  useEffect(() => {
    const ctrl = new AbortController();
    api
      .request<{ game_id: string; entry_url: string; rules_version: string }>(
        `/campaigns/${encodeURIComponent(slug)}/game`,
        undefined,
        { signal: ctrl.signal },
      )
      .then((g) => {
        if (
          g.rules_version !== REALTIME_RULES ||
          !/^gx[0-9a-z]{1,13}$/.test(g.game_id)
        )
          throw Error("Unsupported realtime game");
        if (!ctrl.signal.aborted) setGame(g);
      })
      .catch((e) => {
        if (!ctrl.signal.aborted) setError(e.message);
      });
    return () => ctrl.abort();
  }, [slug]);
  let src = "";
  try {
    if (game) src = runnerURL(game.entry_url, location.origin);
  } catch {
    /* Invalid deployment is shown below. */
  }
  useEffect(() => {
    if (!game || !src) return;
    const bridge = createRealtimeBridge({
      source: () => frame.current?.contentWindow ?? null,
      origin: new URL(src).origin,
      gameId: game.game_id,
      slug,
      apiBase: import.meta.env.VITE_API_BASE_URL || "/api/v1",
      request: (path, body, signal) => api.authenticated(path, body, signal),
      socket: (url, protocols) => new WebSocket(url, protocols),
      status: setStatus,
    });
    window.addEventListener("message", bridge.receive);
    return () => {
      window.removeEventListener("message", bridge.receive);
      bridge.destroy();
    };
  }, [game, src, slug]);
  return (
    <section className="game-embed" aria-label="Game mode">
      <div className="game-embed-toolbar">
        <Link className="btn btn-secondary" to={`/campaign/${slug}`}>
          Return to campaign
        </Link>
        <span role="status">{status}</span>
      </div>
      {(error || (game && !src)) && (
        <p role="alert">{error || "The game URL is invalid."}</p>
      )}
      {src && (
        <iframe
          ref={frame}
          className="game-embed-frame"
          src={src}
          title="Market Combo game"
          sandbox="allow-scripts allow-same-origin"
          referrerPolicy="no-referrer"
        />
      )}
    </section>
  );
}
