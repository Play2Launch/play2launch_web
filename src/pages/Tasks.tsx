import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, ListChecks } from "lucide-react";
import { FriendInvite } from '../components/FriendInvite';
import { PointsIcon as BadgeCheck } from "../components/PointsIcon";
import { useApp } from "../state";
import { liveAuth } from "../lib/api";
import { pointLabels, usePoints } from "../components/PointsProvider";

export default function Tasks() {
  const app = useApp(),
    { page, error, busy, refresh } = usePoints();
  const [now, setNow] = useState(Date.now()),
    [clock, setClock] = useState({ server: Date.now(), local: Date.now() });
  useEffect(() => {
    if (page)
      setClock({ server: Date.parse(page.server_time), local: Date.now() });
  }, [page?.server_time]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const remaining = (at: string) => {
    const sec = Math.max(
      0,
      Math.ceil((Date.parse(at) - (clock.server + now - clock.local)) / 1000),
    );
    if (!sec) return "Resetting — refresh to update";
    const days = Math.floor(sec / 86400),
      hours = Math.floor((sec % 86400) / 3600),
      minutes = Math.floor((sec % 3600) / 60);
    return `Resets in ${days ? `${days}d ` : ""}${hours}h ${minutes}m ${sec % 60}s · UTC`;
  };
  return (
    <section className="tasks-page">
      <div className="tasks-heading">
        <div>
          <span className="eyebrow">PLAY. PARTICIPATE. PROGRESS.</span>
          <h1>
            <ListChecks /> Tasks
          </h1>
          <p>Small milestones. Points that add up.</p>
        </div>
        <div className="tasks-balance">
          <BadgeCheck />
          <strong>{page?.balance.toLocaleString() ?? "—"}</strong>
          <span>P2L Points</span>
        </div>
      </div>
      {liveAuth && app.user?.mode === 'live' && <FriendInvite key={app.user.id} userId={app.user.personalInviteCode||app.user.id}/>}
      {!app.user || !liveAuth ? (
        <div className="task-notice">
          <h2>Make every qualifying game count</h2>
          <p>
            Sign in to see your personal task progress. Trial games do not earn
            points.
          </p>
          <button
            className="btn btn-primary"
            onClick={() => app.setAuthOpen(true)}
          >
            Sign in
          </button>
        </div>
      ) : (
        <>
          <div className="tasks-toolbar">
            <p>Rewards are credited automatically. No claim needed.</p>
            <button
              className="btn btn-secondary"
              disabled={busy}
              onClick={refresh}
            >
              {busy ? "Refreshing…" : "Refresh"}
            </button>
          </div>
          {error && (
            <p role="alert">
              {error}
              {page ? " Showing your last loaded progress." : ""}
            </p>
          )}
          {!page && busy && <p role="status">Loading your tasks…</p>}
          {["starter", "daily", "weekly"].map((group) => (
            <section className="task-group" key={group}>
              <h2>
                {
                  {
                    starter: "Getting started",
                    daily: "Daily tasks",
                    weekly: "Weekly tasks",
                  }[group]
                }
              </h2>
              <div className="task-grid">
                {page?.tasks
                  .filter((t) => t.group === group)
                  .map((task) => (
                    <article
                      className={`task-card ${task.status === "credited" ? "credited" : ""}`}
                      key={task.kind}
                    >
                      <div className="task-card-title">
                        <h3>{pointLabels[task.kind]}</h3>
                        <span className="task-reward">
                          <BadgeCheck size={18} />+{task.reward}
                        </span>
                      </div>
                      <p>
                        {task.kind === "weekly_five"
                          ? "Play a qualifying game on five different days this week."
                          : "Complete qualifying ranked games. Trial games do not count."}
                      </p>
                      <div className="task-progress-label">
                        <span>
                          {task.progress} / {task.target}
                          {group === "weekly" ? " days" : " games"}
                        </span>
                        <span>
                          {task.status === "credited"
                            ? "Credited"
                            : task.status === "completed"
                              ? "Completed · credit pending"
                              : "In progress"}
                        </span>
                      </div>
                      <progress
                        max={task.target}
                        value={task.progress}
                        aria-label={`${pointLabels[task.kind]} progress`}
                      />
                      <small>
                        {task.resets_at
                          ? remaining(task.resets_at)
                          : "One-time reward"}
                      </small>
                      {task.status === "in_progress" ? (
                        <Link to="/" className="btn btn-primary">
                          Find a campaign →
                        </Link>
                      ) : (
                        <span className="task-complete">
                          <Check size={16} />
                          {task.status === "credited"
                            ? "Automatically credited"
                            : "Completed"}
                        </span>
                      )}
                    </article>
                  ))}
              </div>
            </section>
          ))}
        </>
      )}
      <aside className="task-notice">
        <h2>What counts?</h2>
        <p>
          A ranked game accepted by the server, with a positive score and at
          least {(page?.policy.min_elapsed_ms ?? 15000) / 1000} seconds played.
          Rewards can stack. Days reset at 00:00 UTC; weeks start Monday.
        </p>
        <p>
          P2L Points are separate from game scores and do not guarantee tokens
          or redemption. Referral rewards require a new player’s first qualifying game. Team bonuses are not enabled.
        </p>
        <Link to="/profile#p2l-points">View your points history →</Link>
      </aside>
    </section>
  );
}
