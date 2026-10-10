import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { TeamJoinSettings } from "../components/TeamJoinSettings";
import { AvatarEditor } from "../components/AvatarEditor";
import { CaptainTeams } from "../components/CaptainTeams";
import { TeamInvite } from "../components/TeamInvite";
import { getCampaign } from "../lib/catalog";
import {
  listTeams,
  myMembership,
  type ServerTeam,
  type Membership,
} from "../lib/teams";

import {
  CampaignPicker,
  CampaignChoice,
  type CaptainCampaign,
} from "../components/CampaignPicker";

export function LiveCaptain({ userId }: { userId: string }) {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const initialSlug = params.get("campaign") || "";
  const creating = params.get("create") === "1";
  const [campaign, setCampaign] = useState<CaptainCampaign>();
  const [picker, setPicker] = useState(false);
  const dirty = useRef(false);
  const invitePanel = useRef<HTMLDetailsElement>(null);
  const [slug, setSlug] = useState("");
  const [approved, setApproved] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [teams, setTeams] = useState<ServerTeam[]>([]);
  const [membership, setMembership] = useState<Membership | null>(null);
  useEffect(() => {
    const ctrl = new AbortController();
    setReady(false);
    setTeams([]);
    setMembership(null);
    setCampaign(undefined);
    setSlug("");
    setError("");
    Promise.all([
      api.authenticated<{ status: string } | null>(
        "/kol/me",
        undefined,
        ctrl.signal,
      ),
      initialSlug
        ? getCampaign(initialSlug, ctrl.signal)
        : Promise.resolve(undefined),
    ])
      .then(([kol, selected]) => {
        if (!ctrl.signal.aborted) {
          setApproved(kol?.status === "approved");
          setCampaign(selected);
          setSlug(selected?.slug || "");
        }
      })
      .catch((e) => {
        if (!ctrl.signal.aborted) setError(e.message);
      });
    return () => ctrl.abort();
  }, [userId, initialSlug]);
  useEffect(() => {
    if (!slug) return;
    const ctrl = new AbortController();
    setReady(false);
    setError("");
    Promise.all([listTeams(slug, ctrl.signal), myMembership(slug, ctrl.signal)])
      .then(([t, m]) => {
        if (!ctrl.signal.aborted) {
          setTeams(t);
          setMembership(m);
          setReady(true);
        }
      })
      .catch((e) => {
        if (!ctrl.signal.aborted) setError(e.message);
      });
    return () => ctrl.abort();
  }, [slug, userId]);
  const owned = teams.find((t) => t.owner_id === userId);
  const current = teams.find((t) => t.id === membership?.team_id);
  useEffect(() => {
    if (!ready || !owned || params.get('panel') !== 'invite') return;
    const frame = requestAnimationFrame(() => invitePanel.current?.scrollIntoView?.({ block: 'start' }));
    return () => cancelAnimationFrame(frame);
  }, [ready, owned?.id, params]);
  function selectCampaign(c: CaptainCampaign) {
    if (
      dirty.current &&
      !window.confirm("Switch campaigns and discard the unsaved team details?")
    )
      return;
    dirty.current = false;
    setReady(false);
    setTeams([]);
    setMembership(null);
    setCampaign(c);
    setSlug(c.slug);
    setPicker(false);
    nav(`/captain?campaign=${encodeURIComponent(c.slug)}`, { replace: true });
  }
  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || !ready) return;
    const values = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      const result = await api.authenticated<ServerTeam>(
        `/campaigns/${encodeURIComponent(slug)}/teams`,
        {
          name: values.get("name"),
          description: values.get("description"),
          confirm_transfer: values.get("confirm_transfer") === "on",
        },
      );
      nav(
        `/campaign/${encodeURIComponent(slug)}/teams?selected=${encodeURIComponent(result.id)}`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create team");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className={approved && !initialSlug && !creating ? "captain-dashboard" : "membership-card verification-content"}>
      {error && (
        <div role="alert" className="inline-note">
          {error}
        </div>
      )}
      {approved === null ? (
        <p>Loading captain eligibility…</p>
      ) : !approved ? (
        <>
          <h2>KOL approval required</h2>
          <p>
            Your server-side verification must be approved before creating a
            team.
          </p>
          <Link className="btn btn-primary" to="/verification">
            Apply or view verification
          </Link>
        </>
      ) : (
        <>
          {!initialSlug&&!creating ? <CaptainTeams create={()=>nav('/captain?create=1')}/> : <>
          <Link className="text-link" to="/captain" onClick={e=>{if(dirty.current&&!window.confirm('Discard the unsaved team details?'))e.preventDefault();else dirty.current=false;}}>← My teams</Link>
          <h2>{ready&&owned ? `Manage ${owned.name}` : initialSlug&&!ready ? 'Your campaign team' : 'Create your campaign team'}</h2>
          <div className="captain-campaign-summary">
            {campaign ? (
              <CampaignChoice key={campaign.id} campaign={campaign} />
            ) : (
              <span>Choose the campaign your team will play in.</span>
            )}
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={() => setPicker(true)}
            >
              {campaign ? "Switch campaign" : "Choose campaign"}
            </button>
          </div>
          {picker && (
            <CampaignPicker
              choose={selectCampaign}
              close={() => setPicker(false)}
            />
          )}
          {!slug ? (
            <p>Select a campaign to start creating your team.</p>
          ) : !ready ? (
            <p>Loading membership…</p>
          ) : owned ? (
            <>
              <AvatarEditor title="Team avatar" endpoint={`/campaigns/${encodeURIComponent(slug)}/teams/${encodeURIComponent(owned.id)}/avatar`} value={owned.avatar_url} onChange={url=>setTeams(previous=>previous.map(t=>t.id===owned.id?{...t,avatar_url:url}:t))}/>
              <TeamJoinSettings key={`${owned.id}:${owned.version||0}`} slug={slug} team={owned} onChange={setTeams}/>
              <p>
                You already lead {owned.name}. Each captain can create one team
                per campaign.
              </p>
              <Link
                className="btn btn-primary"
                to={`/campaign/${slug}/teams?selected=${owned.id}`}
              >
                View your team
              </Link>
              <details ref={invitePanel} className="captain-invitation" open={params.get('panel')==='invite'||undefined}>
                <summary>Invite to team</summary>
                <TeamInvite key={owned.id} slug={slug} team={owned.id} name={owned.name} referrer={userId}/>
              </details>
            </>
          ) : campaign?.availability && !campaign.availability.join_open ? (
            <p>Team creation is outside this campaign’s joining window.</p>
          ) : (
            <form
              key={slug}
              className="verification-form"
              onChange={() => {
                dirty.current = true;
              }}
              onSubmit={create}
            >
              <fieldset
                disabled={busy}
                style={{ border: 0, padding: 0, display: "grid", gap: 16 }}
              >
                <label>
                  Team name
                  <input name="name" minLength={3} maxLength={32} required />
                </label>
                <label>
                  Team introduction
                  <textarea
                    name="description"
                    minLength={20}
                    maxLength={300}
                    rows={4}
                    required
                  />
                </label>
                {membership && (
                  <label className="captain-transfer-consent">
                    <input type="checkbox" name="confirm_transfer" required />
                    <span>
                      I agree to leave {current?.name || "my current team"} and
                      join my new team.
                    </span>
                  </label>
                )}
                <p>
                  Past scores stay with your previous team. New scores belong to
                  your new team. Personal best and campaign unlock contribution
                  do not reset. Finish any active game before creating a team.
                </p>
                <button className="btn btn-primary" type="submit">
                  {busy
                    ? "Creating…"
                    : membership
                      ? "Create team and transfer membership"
                      : "Create team and join"}
                </button>
              </fieldset>
            </form>
          )}
          </>}
        </>
      )}
    </section>
  );
}
