import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useApp } from "../state";
import { getCampaign } from "../lib/catalog";
import {
  listTeams,
  myMembership,
  joinTeam,
  memberships,
  type ServerTeam,
  type Membership,
  type MyTeam,
} from "../lib/teams";
import type { Campaign } from "../data";
import { TeamPage } from "./Campaign";
export default function LiveTeams() {
  const { id = "" } = useParams();
  const app = useApp();
  return <Directory key={`${id}:${app.user?.id || "guest"}`} slug={id} />;
}
function Directory({ slug }: { slug: string }) {
  const app = useApp();
  const [campaign, setCampaign] = useState<Campaign>();
  const [teams, setTeams] = useState<ServerTeam[]>([]);
  const [member, setMember] = useState<Membership | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const [closed, setClosed] = useState(true);
  const request = useRef<AbortController | null>(null);
  const lock = useRef(false);
  useEffect(() => {
    const ctrl = new AbortController();
    setReady(false);
    setError("");
    getCampaign(slug, ctrl.signal).then(async c => {
      if(ctrl.signal.aborted)throw new Error('Cancelled');
      const [t,m]=await Promise.all([
      listTeams(slug, ctrl.signal),
      app.user ? myMembership(slug, ctrl.signal) : Promise.resolve(null),
      ]);
      return [c,t,m] as const;
    })
      .then(([c, t, m]) => {
        if (ctrl.signal.aborted) return;
        document.title=`${c.name} · Teams · PLAY TO LAUNCH`;
        setCampaign({
          ...c,
          id: c.slug,
          players: 0,
          teams: t.length,
          growth: 0,
          score: 0,
        });
        setTeams(t);
        setMember(m);
        setClosed(c.availability?.join_open !== true);
        setReady(true);
      })
      .catch((e) => {
        if (!ctrl.signal.aborted)
          setError(e.message || "Could not load teams.");
      });
    return () => {
      ctrl.abort();
      request.current?.abort();
    };
  }, [slug, app.user?.id, retry]);
  async function join(team: string) {
    if (!app.user) {
      app.setAuthOpen(true);
      return;
    }
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    const ctrl = new AbortController();
    request.current = ctrl;
    try {
      const referrer =
        app.entry.campaignId === slug && app.entry.teamId === team
          ? app.entry.referrerId
          : undefined;
      const m = await joinTeam(slug, team, ctrl.signal, referrer);
      if (ctrl.signal.aborted) return;
      setMember(m);
      app.setToast("Team joined. Your other campaign teams are unchanged.");
      setRetry((n) => n + 1);
    } catch (e) {
      if (!ctrl.signal.aborted) {
        setError(
          e instanceof Error
            ? e.message
            : "Join failed. Refresh to check your membership before retrying.",
        );
      }
    } finally {
      lock.current = false;
      if (!ctrl.signal.aborted) setBusy(false);
    }
  }
  return (
    <>
      {error && (
        <div className="notice" role="alert">
          <span>{error}</span>
          <button onClick={() => setRetry((n) => n + 1)}>Retry teams</button>
        </div>
      )}
      {!ready && !error && <p role="status">Loading teams…</p>}
      {ready && campaign && (
        <>
          {app.entry.campaignId === slug && app.entry.teamId && (
            <div className="notice" role="status">
              {teams.some((t) => t.id === app.entry.teamId)
                ? `You were invited to ${teams.find((t) => t.id === app.entry.teamId)!.name}. Sign in and confirm joining; your existing team will not be changed.`
                : "This invitation points to an unavailable team. Choose another team to continue."}
              <Link to={`/campaign/${slug}/teams?src=direct`}>
                Browse without invitation
              </Link>
            </div>
          )}
          <TeamPage
            live={{
              campaign,
              teams: teams.map((t) => ({
                ...t,
                score: 0,
                referrals: t.referrals ?? 0,
              })),
              member: member?.team_id,
              closed,
              busy,
              join,
            }}
          />
        </>
      )}
    </>
  );
}
export function LiveMemberships() {
  const app = useApp();
  return <MembershipList key={app.user?.id || "guest"} />;
}
function MembershipList() {
  const app = useApp();
  const [items, setItems] = useState<MyTeam[]>([]);
  const [after, setAfter] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!app.user) return;
    const ctrl = new AbortController();
    setBusy(true);
    setError("");
    memberships(after, ctrl.signal)
      .then((d) => {
        if (ctrl.signal.aborted) return;
        setItems((prev) =>
          after
            ? [
                ...prev,
                ...d.items.filter(
                  (m) => !prev.some((p) => p.campaign_id === m.campaign_id),
                ),
              ]
            : d.items,
        );
        setNext(d.next_cursor === after ? "" : d.next_cursor);
      })
      .catch((e) => {
        if (!ctrl.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setBusy(false);
      });
    return () => ctrl.abort();
  }, [app.user?.id, after, retry]);
  if (!app.user)
    return (
      <div className="empty-panel">
        <h3>Sign in to see your teams</h3>
        <button
          className="btn btn-primary"
          onClick={() => app.setAuthOpen(true)}
        >
          Sign in
        </button>
      </div>
    );
  return (
    <section className="section">
      <div className="section-heading">
        <h2>My teams by campaign</h2>
        <span className="pill neutral">SERVER SAVED</span>
      </div>
      {busy && <p role="status">Loading memberships…</p>}
      {error && (
        <div role="alert" className="notice">
          {error}
          <button onClick={() => setRetry((n) => n + 1)}>
            Retry memberships
          </button>
        </div>
      )}
      <div className="membership-grid">
        {items.map((m) => (
          <article className="membership-card" key={m.campaign_id}>
            <Link to={`/campaign/${m.slug}`}>
              <h3>{m.name}</h3>
            </Link>
            <span className="eyebrow">MY TEAM IN THIS CAMPAIGN</span>
            <h2>{m.team_name}</h2>
            <p className="muted">Your choice is saved for this campaign.</p>
            <Link
              className="btn btn-secondary full"
              to={`/campaign/${m.slug}/teams?selected=${m.membership.team_id}`}
            >
              View my team
            </Link>
          </article>
        ))}
      </div>
      {!busy && !error && !items.length && (
        <div className="empty-panel">
          <p>No campaign memberships yet.</p>
          <Link to="/">Explore campaigns</Link>
        </div>
      )}
      {next && !error && (
        <button
          disabled={busy}
          className="btn btn-secondary"
          onClick={() => setAfter(next)}
        >
          Load more teams
        </button>
      )}
    </section>
  );
}
