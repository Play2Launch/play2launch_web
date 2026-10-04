import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
export default function InviteLanding() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  useEffect(() => {
    const ctrl = new AbortController();
    api
      .request<{ slug: string; team_id: string; referrer_id?: string }>(
        "/team-invites/resolve",
        { token },
        { signal: ctrl.signal },
      )
      .then((v) => {
        if (!ctrl.signal.aborted)
          navigate(
            `/campaign/${encodeURIComponent(v.slug)}/teams?team=${encodeURIComponent(v.team_id)}&invite=${encodeURIComponent(token)}&src=share${/^ur[0-9a-z]{1,32}$/.test(v.referrer_id || '') ? `&ref=${encodeURIComponent(v.referrer_id!)}` : ''}`,
            { replace: true },
          );
      })
      .catch((e) => {
        if (!ctrl.signal.aborted) setError(e.message);
      });
    return () => ctrl.abort();
  }, [token, navigate]);
  return (
    <section className="empty-panel">
      <h1>Team invitation</h1>
      <p role={error ? "alert" : "status"}>{error || "Checking invitation…"}</p>
      {error && <Link to="/">Explore campaigns</Link>}
    </section>
  );
}
