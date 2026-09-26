import { useEffect, useRef } from "react";
import { PointsIcon as BadgeCheck } from "./PointsIcon";
import { Link, useLocation } from "react-router-dom";
import { pointLabels, usePoints } from "./PointsProvider";

export function HeaderPoints() {
  const { page, error, gain, refresh, busy } = usePoints(),
    ref = useRef<HTMLDetailsElement>(null),
    location = useLocation();
  useEffect(() => {
    if (ref.current) ref.current.open = false;
  }, [location.pathname, location.hash]);
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node))
        ref.current.open = false;
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && ref.current?.open) {
        ref.current.open = false;
        ref.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  return (
    <details
      className={`header-points ${gain ? "points-gained" : ""}`}
      ref={ref}
    >
      <summary
        aria-label={`P2L Points: ${page?.balance.toLocaleString() ?? "not loaded"}`}
      >
        <BadgeCheck size={20} />
        <span>{page ? page.balance.toLocaleString() : busy ? "…" : "—"}</span>
        {gain > 0 && (
          <span className="points-gain" role="status">
            +{gain}
          </span>
        )}
      </summary>
      <div className="points-popover">
        <strong>P2L Points</strong>
        <p className="points-total">{page?.balance.toLocaleString() ?? "—"}</p>
        <small>Participation points, not tokens.</small>
        {error && (
          <p role="alert">
            Could not refresh. {page ? "Showing the last known balance." : ""}
            <button onClick={refresh} disabled={busy}>
              Retry
            </button>
          </p>
        )}
        <ul>
          {page?.items.slice(0, 3).map((e) => (
            <li key={e.id}>
              <span>{pointLabels[e.kind] || "Points update"}</span>
              <b>
                {e.amount > 0 ? "+" : ""}
                {e.amount}
              </b>
            </li>
          ))}
        </ul>
        {page && !page.items.length && (
          <p>No points yet. Start with your first task.</p>
        )}
        <Link to="/tasks">Earn points →</Link>
        <Link to="/profile#p2l-points">View history →</Link>
      </div>
    </details>
  );
}
