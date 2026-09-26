import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { usePoints } from "./PointsProvider";

const labels: Record<string, string> = {
  first_game: "First qualifying game",
  daily_game: "Daily play",
  daily_three: "Three games in a day",
  weekly_five: "Five active days this week",
  adjustment: "Points adjustment",
  reversal: "Points correction",
};
export function PlatformPoints() {
  const { page, error, busy, refresh, more } = usePoints(),
    [expanded, setExpanded] = useState(false),
    location = useLocation();
  useEffect(() => {
    if (location.hash === "#p2l-points") {
      setExpanded(true);
      document
        .getElementById("p2l-points")
        ?.scrollIntoView?.({ block: "start" });
    }
  }, [location.hash]);
  return (
    <section
      id="p2l-points"
      className="platform-points"
      aria-label="P2L platform points"
    >
      <div className="section-heading">
        <h2>P2L Points</h2>
        <button className="button secondary" disabled={busy} onClick={refresh}>
          Refresh
        </button>
      </div>
      <strong className="platform-points-balance">
        {page ? page.balance.toLocaleString() : busy ? "Loading…" : "—"}
      </strong>
      <p>
        Platform participation points — separate from game scores. No guaranteed
        token allocation or redemption.
      </p>
      <Link to="/tasks">Earn points · View tasks →</Link>
      {error && <p role="alert">{error}</p>}
      {page && (
        <>
          <button
            className="button secondary"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "Hide history" : "Points history"}
          </button>
          {expanded && (
            <>
              <ul className="platform-points-history">
                {page.items.map((e) => (
                  <li key={e.id}>
                    <div>
                      {labels[e.kind] || "Participation reward"}
                      <small>
                        {e.period === "once" ? "One-time reward" : e.period} ·{" "}
                        {new Date(e.created_at).toLocaleString()}
                      </small>
                    </div>
                    <b>
                      {e.amount > 0 ? "+" : ""}
                      {e.amount}
                    </b>
                  </li>
                ))}
              </ul>
              {!page.items.length && (
                <p>Complete your first qualifying game to earn points.</p>
              )}
              {page.next_cursor && (
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={more}
                >
                  Load more
                </button>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
