import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, UsersRound } from "lucide-react";
import { useApp } from "../state";
import { getCampaign } from "../lib/catalog";
import { api } from "../lib/api";
import {
  listTeams,
  myMembership,
  joinTeam,
  memberships,
  type ServerTeam,
  type Membership,
  type MyTeam,
  type MembershipFilters,
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
  const [validInvitation, setValidInvitation] = useState("");
  const [invitationError, setInvitationError] = useState("");
  const incoming = app.entry.campaignId === slug ? app.entry : undefined;
  useEffect(() => {
    const ctrl = new AbortController();
    setValidInvitation("");
    setInvitationError("");
    if (incoming?.inviteToken) {
      api
        .request<{ slug: string; team_id: string }>(
          "/team-invites/resolve",
          { token: incoming.inviteToken },
          { signal: ctrl.signal },
        )
        .then((v) => {
          if (ctrl.signal.aborted) return;
          if (v.slug !== slug || v.team_id !== incoming.teamId)
            throw new Error("This invitation does not match this team.");
          setValidInvitation(incoming.inviteToken!);
        })
        .catch((e) => {
          if (!ctrl.signal.aborted) setInvitationError(e.message);
        });
    } else if (incoming?.teamId)
      setInvitationError(
        "This old link has no invitation credential. Ask a current member for a new link, or browse without an invitation.",
      );
    return () => ctrl.abort();
  }, [slug, incoming?.inviteToken, incoming?.teamId, retry]);
  function canJoin(team: string) {
    if (incoming?.teamId === team)
      return (
        !!incoming.inviteToken &&
        validInvitation === incoming.inviteToken &&
        !invitationError
      );
    return teams.find((t) => t.id === team)?.join_mode !== "invite_only";
  }
  useEffect(() => {
    const ctrl = new AbortController();
    setReady(false);
    setError("");
    getCampaign(slug, ctrl.signal)
      .then(async (c) => {
        if (ctrl.signal.aborted) throw new Error("Cancelled");
        const [t, m] = await Promise.all([
          listTeams(slug, ctrl.signal),
          app.user ? myMembership(slug, ctrl.signal) : Promise.resolve(null),
        ]);
        return [c, t, m] as const;
      })
      .then(([c, t, m]) => {
        if (ctrl.signal.aborted) return;
        document.title = `${c.name} · Teams · PLAY TO LAUNCH`;
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
    if (!canJoin(team)) return;
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
      const inviteToken =
        app.entry.campaignId === slug && app.entry.teamId === team
          ? app.entry.inviteToken
          : undefined;
      const m = await joinTeam(slug, team, ctrl.signal, referrer, inviteToken);
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
  const invitedTeam = teams.find((t) => t.id === incoming?.teamId);
  const invitationPending = !invitationError && !validInvitation;
  const invitationActive = !invitationPending && !invitationError && !!invitedTeam;
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
            <div
              className={`team-entry-invite${invitationActive ? "" : " is-muted"}`}
              role="status"
            >
              <span className="team-entry-invite-icon" aria-hidden="true">
                <UsersRound size={20} />
              </span>
              <div className="team-entry-invite-copy">
                <span className="team-entry-invite-label">Team invitation</span>
                <strong>
                  {invitationPending
                    ? "Checking your invitation"
                    : invitationActive
                      ? `Join ${invitedTeam.name}`
                      : "Invitation unavailable"}
                </strong>
                <p>
                  {invitationError ||
                    (invitationPending
                      ? "One moment while we verify your link."
                      : invitationActive
                        ? "Confirm on the team card below. Past scores stay with the team where you earned them."
                        : "This team is no longer available through this invitation.")}
                </p>
              </div>
              <Link
                className="team-entry-invite-link"
                to={`/campaign/${slug}/teams?src=direct`}
              >
                Browse teams <ArrowRight size={15} aria-hidden="true" />
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
              canJoin,
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
  const [draft, setDraft] = useState("");
  const [filters, setFilters] = useState<MembershipFilters>({
    q: "",
    status: "active",
    role: "all",
  });
  return (
    <>
      {app.user && (
        <form
          className="membership-filters"
          onSubmit={(e) => {
            e.preventDefault();
            setFilters((f) => ({ ...f, q: draft.trim() }));
          }}
        >
          <label className="team-invite-field">
            Find your team
            <input
              type="search"
              maxLength={80}
              value={draft}
              placeholder="Campaign or team name"
              onChange={(e) => setDraft(e.target.value)}
            />
          </label>
          <label className="team-invite-field">
            Campaign status
            <select
              value={filters.status}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  status: e.target.value as MembershipFilters["status"],
                }))
              }
            >
              <option value="active">Ongoing & upcoming</option>
              <option value="ended">Ended</option>
              <option value="all">All campaigns</option>
            </select>
          </label>
          <label className="team-invite-field">
            My role
            <select
              value={filters.role}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  role: e.target.value as MembershipFilters["role"],
                }))
              }
            >
              <option value="all">All roles</option>
              <option value="captain">Team captain</option>
            </select>
          </label>
          <button className="btn btn-secondary" type="submit">
            Search
          </button>
        </form>
      )}
      <MembershipList
        key={`${app.user?.id || "guest"}:${JSON.stringify(filters)}`}
        filters={filters}
        reset={() => {
          setDraft("");
          setFilters({ q: "", status: "all", role: "all" });
        }}
      />
    </>
  );
}
function MembershipList({
  filters,
  reset,
}: {
  filters: MembershipFilters;
  reset: () => void;
}) {
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
    memberships(after, ctrl.signal, filters)
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
  }, [app.user?.id, after, retry, filters]);
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
    <section className="section membership-results">
      <div className="section-heading">
        <h2>My teams by campaign</h2>
        <span className="small muted">
          {filters.status === "ended"
            ? "Most recently ended first"
            : "Ongoing first · Ending soonest first"}
        </span>
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
          <article
            className="membership-card membership-card-compact"
            key={m.campaign_id}
          >
            <Link to={`/campaign/${m.slug}`}>
              <h3>{m.name}</h3>
            </Link>
            <div className="membership-badges">
              <span
                className={`pill ${m.activity_status === "active" ? "acid" : "neutral"}`}
              >
                {m.activity_status === "ended"
                  ? "ENDED"
                  : m.activity_status === "upcoming"
                    ? "UPCOMING"
                    : "ONGOING"}
              </span>
              <span className="pill neutral">
                {m.role === "captain" ? "CAPTAIN" : "MEMBER"}
              </span>
            </div>
            <h2>{m.team_name}</h2>
            {m.scoring_ends_at && (
              <p className="small muted">
                {m.activity_status === "ended"
                  ? "Scoring ended"
                  : "Scoring ends"}{" "}
                · {new Date(m.scoring_ends_at).toLocaleString()}
              </p>
            )}
            <Link
              className="btn btn-secondary full"
              to={`/campaign/${m.slug}/teams?selected=${m.membership.team_id}`}
            >
              View my team
            </Link>
            {m.role === "captain" && <Link className="text-link" to={`/captain?campaign=${encodeURIComponent(m.slug)}`}>Manage my team <span aria-hidden="true">→</span></Link>}
          </article>
        ))}
      </div>
      {!busy && !error && !items.length && (
        <div className="empty-panel">
          <p>No teams match these filters.</p>
          <button className="btn btn-secondary" onClick={reset}>
            Show all my teams
          </button>
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
