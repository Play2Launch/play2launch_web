import { useEffect, useMemo, useState } from "react";
import { useApp } from "./state";
export function LaunchTimer({ campaignId, live = false, launchAt, serverTime }: { campaignId: string; live?: boolean; launchAt?: string | null; serverTime?: string }) {
  const app = useApp();
  const [now, setNow] = useState(Date.now());
  const offset = useMemo(() => {
    const server = serverTime ? Date.parse(serverTime) : NaN;
    return live && Number.isFinite(server) ? server - Date.now() : 0;
  }, [live, serverTime]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const target = live ? (launchAt ? Date.parse(launchAt) : NaN) : app.local.launchTimes[campaignId];
  if (!Number.isFinite(target) || !target)
    return <p className="accent">Waiting for a confirmed launch schedule.</p>;
  const remaining = Math.max(0, Math.ceil((target - now - offset) / 1000));
  const counts = [
    Math.floor(remaining / 86400),
    Math.floor((remaining % 86400) / 3600),
    Math.floor((remaining % 3600) / 60),
    remaining % 60,
  ];
  return (
    <div className="launch-timer">
      <span className="micro">{live ? "LAUNCH IN" : "LAUNCH IN · DEMONSTRATION TIMER"}</span>
      <div className="countdown">
        {counts.map((n, i) => (
          <div key={i}>
            <strong>{String(n).padStart(2, "0")}</strong>
            <span>{["DAYS", "HOURS", "MINUTES", "SECONDS"][i]}</span>
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
