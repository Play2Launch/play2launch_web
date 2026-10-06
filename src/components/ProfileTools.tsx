import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BadgeCheck, Crown, ChevronRight } from "lucide-react";
import { api, liveAuth } from "../lib/api";
import { useApp } from "../state";

const labels: Record<string, string> = {
  draft: "Finish your application",
  pending: "Application under review",
  approved: "Verification approved",
  rejected: "Review changes requested",
  revoked: "Verification revoked",
  none: "Verify your community profile",
};
export function ProfileTools({onVerified, compact = false}: {compact?: boolean; onVerified?: (v:{id?:string; approved:boolean})=>void} = {}) {
  const app = useApp();
  return (
    <Tools
      key={app.user?.id || "guest"}
      userId={app.user?.id}
      demoStatus={app.kolRequest?.status}
      onVerified={onVerified}
      compact={compact}
    />
  );
}
function Tools({
  userId,
  demoStatus,
  onVerified,
  compact,
}: {
  userId?: string;
  demoStatus?: string;
  compact?: boolean;
  onVerified?: (v:{id?:string; approved:boolean})=>void;
}) {
  const [status, setStatus] = useState(
    liveAuth && userId ? "loading" : demoStatus || "none",
  );
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!liveAuth || !userId) return;
    const ctrl = new AbortController();
    let busy = false;
    async function refresh() {
      if (busy || ctrl.signal.aborted) return;
      busy = true;
      // Keep the confirmed link mounted during background revalidation: a
      // window-focus event can occur between pointer down and click.
      setError(false);
      try {
        const result = await api.authenticated<{ status: string } | null>(
          "/kol/me",
          undefined,
          ctrl.signal,
        );
        if (
          result !== null &&
          (!result || !Object.hasOwn(labels, result.status))
        )
          throw new Error("Invalid verification status");
        if (!ctrl.signal.aborted) setStatus(result?.status || "none");
      } catch {
        if (!ctrl.signal.aborted) {
          setStatus("none");
          setError(true);
        }
      } finally {
        busy = false;
      }
    }
    void refresh();
    window.addEventListener("focus", refresh);
    return () => {
      ctrl.abort();
      window.removeEventListener("focus", refresh);
    };
  }, [userId, retry]);
  const current = liveAuth ? status : demoStatus || "none";
  const approved = !!userId && current === "approved" && !error;
  useEffect(()=>{onVerified?.({id:userId,approved:liveAuth && approved});},[userId,approved,onVerified]);
  if (compact) return (
    <section className="discover-captain" aria-label="Captain opportunities">
      <Link to={approved ? "/captain" : "/verification"} className="discover-captain-link">
        <span className="profile-tool-icon">{approved ? <Crown size={20} /> : <BadgeCheck size={20} />}</span>
        <span>
          <strong>{approved ? "Captain Studio" : error || current === "loading" ? "KOL verification" : current === "pending" ? "View application" : ["rejected", "revoked"].includes(current) ? "Update application" : current === "draft" ? "Continue application" : "Become a KOL"}</strong>
          <small>{approved ? "Manage your teams and grow your community" : error ? "Check your verification status" : current === "loading" ? "Checking verification…" : current === "pending" ? "Your application is under review" : "Lead your community into the next launch"}</small>
        </span>
        <ChevronRight size={18} aria-hidden="true" />
      </Link>
    </section>
  );
  return (
    <section className="profile-tools" aria-label="Creator tools">
      <span className="eyebrow">COMMUNITY TOOLS</span>
      {approved && (
        <Link to="/captain" className="profile-tool-card profile-tool-captain">
          <span className="profile-tool-icon">
            <Crown size={20} />
          </span>
          <span>
            <strong>Captain studio</strong>
            <small>Create and manage your campaign teams</small>
          </span>
          <ChevronRight size={18} />
        </Link>
      )}
      <Link to="/verification" className="profile-tool-card">
        <span className="profile-tool-icon">
          <BadgeCheck size={20} />
        </span>
        <span>
          <strong>KOL verification</strong>
          <small>
            {!userId
              ? "Sign in to start verification"
              : error
                ? "Check your verification status"
                : current === "loading"
                  ? "Checking verification…"
                  : labels[current] || labels.none}
            {!liveAuth && approved ? " · Demo" : ""}
          </small>
        </span>
        <ChevronRight size={18} />
      </Link>
      {error && (
        <div className="profile-tools-error" role="alert">
          Verification status unavailable.{" "}
          <button className="text-link" onClick={() => setRetry((n) => n + 1)}>
            Retry verification status
          </button>
        </div>
      )}
    </section>
  );
}
