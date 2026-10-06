import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Crown, ArrowUpRight, Users, ShieldCheck, Send } from "lucide-react";
import { campaigns, number } from "../data";
import { useApp } from "../state";
import { LiveCaptain } from "./LiveCaptain";
import { liveAuth } from "../lib/api";
import { KolBadge } from "./Verification";

export function CaptainDemoControls() {
  const app = useApp();
  const owned = app.local.captainTeams.filter(
    (t) => t.ownerId === app.user?.id,
  );
  const [selected, setSelected] = useState("");
  const [message, setMessage] = useState("");
  if (liveAuth || !app.kolPermissions.canCreateTeam || !owned.length)
    return null;
  return (
    <section className="review-demo">
      <h3>Invited-player simulation</h3>
      <p>
        Add one fictional recruit with a valid 12,500-point round. This is not a
        real invitation conversion.
      </p>
      <label>
        Simulation team
        <select
          value={owned.some((t) => t.id === selected) ? selected : owned[0].id}
          onChange={(e) => setSelected(e.target.value)}
        >
          {owned.map((t) => (
            <option key={t.id} value={t.id}>
              {campaigns.find((c) => c.id === t.campaignId)?.name} / {t.name}
            </option>
          ))}
        </select>
      </label>
      <button
        className="btn btn-secondary"
        onClick={() => {
          try {
            app.simulateTeamPlayer(
              owned.some((t) => t.id === selected) ? selected : owned[0].id,
            );
            setMessage("Fictional recruit accepted. Demo standings updated.");
          } catch (e) {
            setMessage((e as Error).message);
          }
        }}
      >
        Simulate invited player + valid round
      </button>
      {message && <p role="status">{message}</p>}
    </section>
  );
}

export default function CaptainPage() {
  const app = useApp();
  const [params, setParams] = useSearchParams();
  const selected = campaigns.some((c) => c.id === params.get("campaign"))
    ? params.get("campaign")!
    : "phood";
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const owned = app.local.captainTeams.find(
    (t) => t.ownerId === app.user?.id && t.campaignId === selected,
  );
  const snapshot = app.standings(selected);
  const team = owned
    ? snapshot.teams.find((t) => t.id === owned.id)
    : undefined;
  const qualified = owned
    ? snapshot.players.filter((p) => p.teamId === owned.id)
    : [];
  const members = owned
    ? [
        ...qualified,
        ...(!qualified.some((p) => p.userId === owned.ownerId)
          ? [
              {
                userId: owned.ownerId,
                name: app.user?.name || "Captain",
                best: 0,
                campaignId: selected,
                teamId: owned.id,
              },
            ]
          : []),
      ]
    : [];
  const blocked = Boolean(app.local.memberships[selected]);
  const closed = Date.now() >= app.local.competition.deadlines[selected];
  const submit = (event: FormEvent) => {
    event.preventDefault();
    try {
      app.createTeam(selected, name, description);
      setError("");
      setName("");
      setDescription("");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">KOL / CAPTAIN STUDIO</span>
          <h1>
            {liveAuth ? "Captain Studio" : <>Your people. Your team<span>.</span></>}
          </h1>
          <p>
            {liveAuth ? "Manage your teams. Grow your community." : "Create a team inside a platform-published campaign. Only platform administrators can publish activities."}
          </p>
        </div>
        <Crown size={36} className="accent" />
      </div>
      {!app.user ? (
        <section className="empty-panel">
          <ShieldCheck size={32} />
          <h2>Sign in to lead a team</h2>
          <button
            className="btn btn-primary"
            onClick={() => app.setAuthOpen(true)}
          >
            Sign in to continue
          </button>
        </section>
      ) : liveAuth ? (
        <LiveCaptain key={app.user.id} userId={app.user.id} />
      ) : (
        <>
          <div className="captain-toolbar">
            <KolBadge />
            <label>
              Campaign
              <select
                value={selected}
                onChange={(e) => {
                  setParams({ campaign: e.target.value });
                  setError("");
                }}
              >
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <Link to="/verification" className="text-link">
              Verification status <ArrowUpRight size={16} />
            </Link>
          </div>
          {owned && team ? (
            <>
              <section className="membership-card verification-content">
                <span className="eyebrow">
                  {campaigns.find((c) => c.id === selected)?.name} / YOUR
                  CAPTAIN TEAM
                </span>
                <h2>{owned.name}</h2>
                <p>{owned.description}</p>
                <p className="small muted">
                  {closed ? "Scoring closed" : "Scoring open"} · Closes{" "}
                  {new Date(
                    app.local.competition.deadlines[selected],
                  ).toLocaleString()}
                </p>
                <div className="captain-metrics">
                  <div>
                    <strong>{number(members.length)}</strong>
                    <span>Members</span>
                  </div>
                  <div>
                    <strong>{number(qualified.length)}</strong>
                    <span>Qualified players</span>
                  </div>
                  <div>
                    <strong>{number(team.score)}</strong>
                    <span>Team score</span>
                  </div>
                  <div>
                    <strong>
                      #{snapshot.teams.findIndex((t) => t.id === team.id) + 1}
                    </strong>
                    <span>Campaign rank</span>
                  </div>
                </div>
                <div className="verification-actions">
                  <button
                    className="btn btn-primary"
                    onClick={() => app.setShareCampaign(selected)}
                  >
                    <Send size={16} />
                    Invite to this team
                  </button>
                  <Link
                    className="btn btn-secondary"
                    to={`/campaign/${selected}/teams?selected=${owned.id}`}
                  >
                    View public team <ArrowUpRight size={16} />
                  </Link>
                </div>
                {!app.kolPermissions.canCreateTeam && (
                  <p className="accent">
                    KOL verification is no longer active. Existing team and
                    scores are preserved; new team creation is locked.
                  </p>
                )}
                <p className="small muted">
                  Device-local team. Invite links resolve only in browsers with
                  this demo team data; sharing across devices requires the
                  backend.
                </p>
              </section>
              <section className="section">
                <div className="section-heading">
                  <h2>
                    <Users size={22} />
                    Members & contributions
                  </h2>
                  <span className="pill neutral">DEMO DATA</span>
                </div>
                <div className="table-scroll">
                  <table className="ranking-table">
                    <thead>
                      <tr>
                        <th>Member</th>
                        <th>Role</th>
                        <th>Qualification</th>
                        <th>Best accepted score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((p) => (
                        <tr key={p.userId}>
                          <td>{p.name}</td>
                          <td>
                            {p.userId === owned.ownerId
                              ? "Captain"
                              : "Demo recruit"}
                          </td>
                          <td>
                            {qualified.some((q) => q.userId === p.userId)
                              ? "Qualified"
                              : "Needs a valid round"}
                          </td>
                          <td>{number(p.best)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="small muted">
                  Team score sums highest accepted member scores. Joining alone
                  does not count as qualified participation.
                </p>
              </section>
            </>
          ) : !app.kolPermissions.canCreateTeam ? (
            <section className="empty-panel">
              <ShieldCheck size={32} />
              <h2>KOL approval required</h2>
              <p>
                Pending, rejected and revoked applications cannot create teams.
              </p>
              <Link className="btn btn-primary" to="/verification">
                Apply or check verification
              </Link>
            </section>
          ) : blocked ? (
            <section className="empty-panel">
              <h2>You already have a team here</h2>
              <p>
                Creating another team would break the no-switch rule. Choose a
                different campaign.
              </p>
              <Link
                className="btn btn-secondary"
                to={`/campaign/${selected}/teams?selected=${app.local.memberships[selected]}`}
              >
                View your current team
              </Link>
            </section>
          ) : closed ? (
            <section className="empty-panel">
              <h2>Team creation is closed</h2>
              <p>
                The campaign’s scoring deadline has passed. Select another
                campaign.
              </p>
            </section>
          ) : (
            <section className="membership-card verification-content">
              <h2>Create your campaign team</h2>
              <p>
                One team per captain per campaign. You will automatically join
                this team and cannot switch later.
              </p>
              <form className="verification-form" onSubmit={submit}>
                <label>
                  Team name
                  <input
                    required
                    minLength={3}
                    maxLength={32}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <label>
                  Team introduction
                  <textarea
                    required
                    minLength={20}
                    maxLength={300}
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </label>
                {error && (
                  <p role="alert" className="negative">
                    {error}
                  </p>
                )}
                <button className="btn btn-primary" type="submit">
                  Create team & join <ArrowUpRight size={16} />
                </button>
              </form>
            </section>
          )}
        </>
      )}
    </>
  );
}
