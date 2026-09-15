import { useEffect, useState } from "react";
import { useApp } from "./state";
export function LaunchTimer({ campaignId }: { campaignId: string }) {
  const app = useApp();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const target = app.local.launchTimes[campaignId];
  if (!target)
    return <p className="accent">Waiting for a confirmed launch schedule.</p>;
  const remaining = Math.max(0, Math.floor((target - now) / 1000));
  const counts = [
    Math.floor(remaining / 3600),
    Math.floor((remaining % 3600) / 60),
    remaining % 60,
  ];
  return (
    <div className="launch-timer">
      <span className="micro">LAUNCH IN · DEMONSTRATION TIMER</span>
      <div className="countdown">
        {counts.map((n, i) => (
          <div key={i}>
            <strong>{String(n).padStart(2, "0")}</strong>
            <span>{["HOURS", "MINUTES", "SECONDS"][i]}</span>
          </div>
        ))}
      </div>
      {remaining === 0 && (
        <p className="accent">
          Countdown complete. Awaiting a confirmed launch status.
        </p>
      )}
    </div>
  );
}
