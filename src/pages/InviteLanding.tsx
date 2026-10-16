import { formatTicker } from "../lib/ticker";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Gamepad2, UserRoundPlus, UsersRound } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { getCampaign, listCampaigns, type PublicCampaign } from "../lib/catalog";
import { myMembership, joinTeam, listTeams, type ServerTeam } from "../lib/teams";
import { useApp } from "../state";
import { CampaignArtwork } from "../components/CampaignArtwork";
import { InvitationTeamCard } from "../components/InvitationTeamCard";
import { runnerURL } from "../lib/runner";
import { stageLabel } from "../data";
import { openInviteVisit, recordInviteRegistration, recordInviteEvent, trialMessage } from "../lib/inviteAnalytics";
import { trackGameEvent } from "../lib/firebaseAnalytics";
import { personalTeams, autoJoinPersonalTeams, joinPersonalTeam, type PersonalTeam } from "../lib/personalTeams";

type Person = { id: string; name: string };
type TeamPreview = {
  slug: string; team_id: string; referrer_id: string;
  inviter_name: string; team_name: string; campaign_name: string;
};
const pendingKey = "p2l.pending-team-invite.v1";
const validPerson = (v: Person, id: string) => v?.id === id && typeof v.name === "string" && v.name.length > 0;
const validTeam = (v: TeamPreview) =>
  /^[a-z0-9][a-z0-9-]{0,63}$/.test(v?.slug || "") &&
  /^tm[0-9a-z]{1,13}$/.test(v.team_id) &&
  /^ur[0-9a-z]{1,32}$/.test(v.referrer_id) &&
  [v.inviter_name, v.team_name, v.campaign_name].every((s) => typeof s === "string" && s.length > 0);
function pendingInvitation(token: string) {
  try {
    const value = JSON.parse(sessionStorage.getItem(pendingKey) || "null");
    return value?.token === token && typeof value.at === "number" && Date.now() - value.at < 30 * 60_000;
  } catch { return false; }
}
function clearPending() { try { sessionStorage.removeItem(pendingKey); } catch { /* Private browsing. */ } }

export function PersonalInviteLanding() {
  const { userId = "" } = useParams();
  return <PersonalLanding key={userId} userId={userId} />;
}
function PersonalLanding({ userId }: { userId: string }) {
  const app = useApp();
  const [person, setPerson] = useState<Person>();
  const [campaign, setCampaign] = useState<PublicCampaign>();
  const [teams, setTeams] = useState<PersonalTeam[]>([]);
  const [campaignCovers, setCampaignCovers] = useState<Record<string, string>>({});
  const [teamsError, setTeamsError] = useState("");
  const [autoJoinMessage, setAutoJoinMessage] = useState("");
  const [joinError, setJoinError] = useState("");
  const [joiningTeam, setJoiningTeam] = useState("");
  const [teamsVersion, setTeamsVersion] = useState(0);
  const [visibleTeams, setVisibleTeams] = useState(6);
  const autoJoinStarted = useRef("");
  const [error, setError] = useState("");
  const [trial, setTrial] = useState(false);
  const [visitID,setVisitID]=useState('');
  const [visitError, setVisitError] = useState("");
  const [visitVersion, setVisitVersion] = useState(0);
  useEffect(() => {
    const ctrl = new AbortController();
    api.request<Person>(`/referrals/${encodeURIComponent(userId)}/preview`, undefined, { signal: ctrl.signal })
      .then((v) => {
        if (!validPerson(v, userId)) throw new Error("Invalid invitation response.");
        if (!ctrl.signal.aborted) {
          setPerson(v);
          document.title = `Invitation from ${v.name} · PLAY TO LAUNCH`;
        }
      }).catch(() => { if (!ctrl.signal.aborted) setError("This personal invitation is unavailable. You can still explore P2L."); });
    listCampaigns("", ctrl.signal).then((page) => {
      if (!ctrl.signal.aborted) setCampaign(page.items.find((c) => c.featured) || page.items[0]);
    }).catch(() => { /* The invitation remains usable without a featured game. */ });
    return () => ctrl.abort();
  }, [userId]);
  useEffect(() => { if(person) void openInviteVisit('personal',userId).then((id) => { setVisitID(id); setVisitError(""); }).catch(() => setVisitError("Could not prepare this invitation.")); },[person?.id,userId,visitVersion]);
  useEffect(() => {if(visitID&&app.user?.mode==='live')void recordInviteRegistration(visitID).catch(()=>{});},[visitID,app.user?.id,app.user?.mode]);
  useEffect(() => {
    if (!person) return;
    const ctrl = new AbortController();
    personalTeams(userId, app.user?.mode === "live", ctrl.signal)
      .then((items) => { if (!ctrl.signal.aborted) { setTeams(items); setTeamsError(""); } })
      .catch(() => { if (!ctrl.signal.aborted) setTeamsError("Teams could not be loaded. Please try again."); });
    return () => ctrl.abort();
  }, [person?.id, userId, app.user?.id, teamsVersion]);
  useEffect(() => {
    const slugs = [...new Set(teams.slice(0, visibleTeams).map(team => team.slug))];
    if (!slugs.length) return;
    const ctrl = new AbortController();
    void Promise.all(slugs.map(async slug => {
      try {
        const campaign = await getCampaign(slug, ctrl.signal);
        return campaign.slug === slug ? [slug, campaign.cover_image || ""] as const : null;
      } catch { return null; } // Team cards remain usable if artwork is unavailable.
    })).then(images => {
      if (!ctrl.signal.aborted) setCampaignCovers(current => ({...current, ...Object.fromEntries(images.filter((image): image is readonly [string, string] => image !== null))}));
    });
    return () => ctrl.abort();
  }, [teams, visibleTeams]);
  useEffect(() => {
    if (!visitID || app.user?.mode !== "live") return;
    const key = `${app.user.id}:${visitID}`;
    if (autoJoinStarted.current === key) return;
    autoJoinStarted.current = key;
    void autoJoinPersonalTeams(userId, visitID).then((result) => {
      if (result.eligible) {
        setAutoJoinMessage(result.joined ? `Joined ${result.joined} team${result.joined === 1 ? "" : "s"}.` : "No teams were added to your account.");
        setTeamsVersion((v) => v + 1);
      }
    }).catch(() => setAutoJoinMessage("Automatic joining could not be completed. Please retry."));
  }, [visitID, app.user?.id, app.user?.mode, userId]);
  const retryAutoJoin = () => {
    if (!visitID) return;
    setAutoJoinMessage("");
    void autoJoinPersonalTeams(userId, visitID).then((result) => {
      if (result.eligible) {
        setAutoJoinMessage(result.joined ? `Joined ${result.joined} team${result.joined === 1 ? "" : "s"}.` : "No teams were added to your account.");
        setTeamsVersion((v) => v + 1);
      }
    }).catch(() => setAutoJoinMessage("Automatic joining could not be completed. Please retry."));
  };
  const join = async (team: PersonalTeam) => {
    if (!visitID || !app.user || joiningTeam) return;
    setJoiningTeam(team.team_id); setJoinError("");
    try {
      await joinPersonalTeam(userId, team, visitID);
      setTeamsVersion((v) => v + 1);
    } catch (e) { setJoinError(e instanceof Error ? e.message : "Could not join this team."); }
    finally { setJoiningTeam(""); }
  };
  if (error) return <Unavailable message={error} />;
  if (!person) return <p className="invite-loading" role="status">Checking your invitation…</p>;
  return <section className="invite-page">
    <div className="invite-hero invite-hero-personal">
      <div className="invite-copy">
        <span className="eyebrow"><UserRoundPlus size={16} /> A PERSONAL INVITATION</span>
        <h1><span>{person.name}</span> invited you to join Play2Launch.</h1>
        <p>Discover upcoming projects and play together. New players can join this inviter’s teams after signing up.</p>
        <div className="invite-actions">
          {!app.user && <button className="btn btn-primary" disabled={!visitID} onClick={() => app.setAuthOpen(true)}>{visitID ? <>Create an account{teams.length ? ` & join ${teams.length} team${teams.length === 1 ? "" : "s"}` : ""}</> : "Preparing invitation…"} <ArrowRight size={16} /></button>}
          {campaign && <button className={`btn ${app.user ? "btn-primary" : "btn-secondary"}`} onClick={() => setTrial(true)}><Gamepad2 size={17} /> Try {campaign.name}</button>}
          {app.user && <Link className="btn btn-secondary" to="/">Explore campaigns</Link>}
        </div>
        {!app.user ? <p className="invite-fineprint">Already have an account? Sign in to choose a team. Existing accounts do not count as new-player referrals.</p>
          : <p className="invite-fineprint">You’re signed in. An existing account is never added to teams automatically, and its first referrer does not change.</p>}
        {teamsError && <p className="invite-warning" role="alert">{teamsError} <button className="text-link" onClick={() => setTeamsVersion((v) => v + 1)}>Retry</button></p>}
        {visitError && <p className="invite-warning" role="alert">{visitError} <button className="text-link" onClick={() => setVisitVersion((v) => v + 1)}>Retry</button></p>}
        {autoJoinMessage && <p className="invite-fineprint" role="status">{autoJoinMessage}{autoJoinMessage.includes("retry") && <button className="text-link" onClick={retryAutoJoin}>Retry</button>}</p>}
        {joinError && <p className="invite-warning" role="alert">{joinError}</p>}
      </div>
    </div>
    {!!teams.length && <div className="personal-invite-teams">
          <div className="personal-invite-team-list">{teams.slice(0, visibleTeams).map((team) => {
            const joined = team.viewer_team_id === team.team_id;
            const otherTeam = !!team.viewer_team_id && !joined;
            return <InvitationTeamCard key={`${team.slug}:${team.team_id}`} team={{slug:team.slug,teamId:team.team_id,teamName:team.team_name,campaignName:team.campaign_name,coverImage:campaignCovers[team.slug],inviterName:person.name,initial:team.initial,color:team.color,avatarUrl:team.avatar_url,players:team.players,joinDeadline:team.join_deadline_at}}
              status={joined ? "Already on this team" : otherTeam ? "You already have a team in this campaign" : !app.user ? "Included when you create an account" : undefined}
              action={app.user && !joined && !otherTeam ? <button className="btn btn-secondary" disabled={!visitID || !!joiningTeam} onClick={() => void join(team)}>{joiningTeam === team.team_id ? "Joining…" : "Join this team"}</button> : undefined} />;
          })}</div>
          {teams.length > visibleTeams && <button className="btn btn-secondary personal-invite-more" onClick={() => setVisibleTeams((n) => n + 6)}>Show more teams</button>}
        </div>}
    {trial && campaign && <InvitationTrial slug={campaign.slug} />}
  </section>;
}

export default function InviteLanding() {
  const { token = "" } = useParams();
  return <TeamLanding key={token} token={token} />;
}
function TeamLanding({ token }: { token: string }) {
  const app = useApp();
  const [preview, setPreview] = useState<TeamPreview>();
  const [campaign, setCampaign] = useState<PublicCampaign>();
  const [teamDetails, setTeamDetails] = useState<ServerTeam>();
  const [error, setError] = useState("");
  const [joinError, setJoinError] = useState("");
  const [joined, setJoined] = useState(false);
  const [busy, setBusy] = useState(false);
  const [trial, setTrial] = useState(false);
  const [visitID,setVisitID]=useState('');
  const [autoJoinRequested, setAutoJoinRequested] = useState(false);
  const joining = useRef(false);
  useEffect(() => {
    const ctrl = new AbortController();
    api.request<TeamPreview>("/team-invites/resolve", { token }, { signal: ctrl.signal })
      .then(async (v) => {
        if (!validTeam(v)) throw new Error("Invalid invitation response.");
        if (ctrl.signal.aborted) return;
        app.rememberTeamInvitation(v.slug, v.team_id, v.referrer_id, token);
        setPreview(v);
        document.title = `Join ${v.team_name} · PLAY TO LAUNCH`;
        void listTeams(v.slug, ctrl.signal).then((teams) => {
          if (!ctrl.signal.aborted) setTeamDetails(teams.find((team) => team.id === v.team_id));
        }).catch(() => { /* The invitation remains usable without directory details. */ });
        try { const c = await getCampaign(v.slug, ctrl.signal); if (!ctrl.signal.aborted) setCampaign(c); }
        catch { /* Keep the invitation visible if the campaign artwork is unavailable. */ }
      }).catch(() => { if (!ctrl.signal.aborted) setError("This team invitation is invalid, expired, or no longer available."); });
    return () => ctrl.abort();
  }, [token]);
  useEffect(() => { if(preview) void openInviteVisit('team',token,preview.slug).then(setVisitID).catch(()=>{}); },[preview?.team_id,token]);
  useEffect(() => {if(visitID&&app.user?.mode==='live')void recordInviteRegistration(visitID).catch(()=>{});},[visitID,app.user?.id,app.user?.mode]);
  const join = async (v: TeamPreview) => {
    if (!app.user || joining.current) return;
    joining.current = true; setBusy(true); setJoinError("");
    clearPending();
    try {
      if (app.user.id === v.referrer_id) throw new Error("You cannot join through your own invitation.");
      const current = await myMembership(v.slug);
      // The server permits Community -> invited team but locks other teams.
      // Let it decide atomically, rather than blocking a legitimate transfer
      // from an out-of-date public directory on the client.
      if (!current || current.team_id !== v.team_id)
        await joinTeam(v.slug, v.team_id, undefined, undefined, token);
      setJoined(true);
    } catch (e) { setJoinError(e instanceof Error ? e.message : "Could not join the team. Please retry."); }
    finally { joining.current = false; setBusy(false); }
  };
  useEffect(() => {
    if (preview && app.user && (autoJoinRequested || pendingInvitation(token) || app.user.signupInviteToken === token)) void join(preview);
    // This only runs when the invitation or authenticated identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview, app.user?.id, app.user?.signupInviteToken, token, autoJoinRequested]);
  if (error) return <Unavailable message={error} />;
  if (!preview) return <p className="invite-loading" role="status">Checking your team invitation…</p>;
  const joinClosed = campaign?.availability?.join_open === false;
  return <section className="invite-page">
    <div className="invite-hero">
      <div className="invite-copy">
        <span className="eyebrow"><UsersRound size={16} /> A TEAM INVITATION</span>
        <h1><span>{preview.inviter_name}</span> invited you to join <span>{preview.team_name}</span>.</h1>
        <p>Play {preview.campaign_name} together. Your team membership applies only to this campaign; past scores stay with the team where you earned them.</p>
        {joinClosed && !joined && <p className="invite-warning" role="status">This campaign is no longer accepting new team members. You can still explore or try the game.</p>}
        <InvitationTeamCard team={{slug:preview.slug,teamId:preview.team_id,teamName:preview.team_name,campaignName:preview.campaign_name,coverImage:campaign?.cover_image,inviterName:preview.inviter_name,initial:teamDetails?.initial,color:teamDetails?.color,avatarUrl:teamDetails?.avatar_url,players:teamDetails?.players}}
          status={joined ? `You’re on ${preview.team_name}.` : undefined}
          action={!joined && (!app.user ? <button className="btn btn-primary" disabled={joinClosed} onClick={() => {
              setAutoJoinRequested(true);
              try { sessionStorage.setItem(pendingKey, JSON.stringify({ token, at: Date.now() })); } catch { /* In-page auth still works. */ }
              app.setAuthOpen(true);
            }}>Create an account &amp; join team <ArrowRight size={16} /></button>
              : <button className="btn btn-primary" disabled={busy || joinClosed} onClick={() => void join(preview)}>{busy ? "Joining team…" : `Join ${preview.team_name}`} <ArrowRight size={16} /></button>)} />
        {!joined && <>
          {campaign && <div className="invite-actions"><button className="btn btn-secondary" onClick={() => setTrial(true)}><Gamepad2 size={17} /> Try {campaign.name}</button></div>}
          {joinError && <p className="invite-warning" role="alert">{joinError}</p>}
          <p className="invite-fineprint">{!app.user && "Already registered? Choose “Sign in” in the account dialog. "}Joining requires a valid invitation and an open campaign. An existing team is never changed automatically.</p>
        </>}
      </div>
      {campaign && <CampaignTeaser campaign={campaign} />}
    </div>
    {trial && campaign && <InvitationTrial slug={campaign.slug} />}
  </section>;
}

function CampaignTeaser({ campaign }: { campaign: PublicCampaign }) {
  return <aside className="invite-campaign" aria-label={`${campaign.name} campaign information`}>
    <div className="invite-campaign-art">
      <CampaignArtwork campaign={campaign} variant="cover" />
      {campaign.stage && <span className={`pill stage-${campaign.stage}`}><i />{stageLabel(campaign.stage)}</span>}
    </div>
    <div className="invite-campaign-body">
      <span className="eyebrow">INVITED CAMPAIGN</span>
      <div className="invite-campaign-title"><strong>{campaign.name}</strong>{campaign.ticker && <span>{formatTicker(campaign.ticker)}</span>}</div>
      {campaign.category && <small>{campaign.category}</small>}
      {campaign.description && <p>{campaign.description}</p>}
    </div>
  </aside>;
}
function InvitationTrial({ slug }: { slug: string }) {
  const frame=useRef<HTMLIFrameElement>(null);
  const [src, setSrc] = useState("");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => { document.getElementById("invitation-trial")?.scrollIntoView?.({ block: "start" }); }, []);
  useEffect(() => {
    const ctrl = new AbortController(); setSrc(""); setError("");
    api.request<{ game_id: string; entry_url: string }>(`/campaigns/${encodeURIComponent(slug)}/game`, undefined, { signal: ctrl.signal })
      .then((v) => {
        if (!/^gx[0-9a-z]{1,13}$/.test(v.game_id)) throw new Error("Invalid game configuration.");
        if (!ctrl.signal.aborted) setSrc(runnerURL(v.entry_url, window.location.origin, "demo"));
      }).catch(() => { if (!ctrl.signal.aborted) setError("The free trial is unavailable right now. You can still create an account or explore the campaign."); });
    return () => ctrl.abort();
  }, [slug, attempt]);
  useEffect(()=>{const receive=(e:MessageEvent)=>{const item=trialMessage(e,frame.current,src);if(item){trackGameEvent(item.event==='trial_start'?'game_start':'game_effective',slug,'trial',item.runID);void recordInviteEvent(slug,item.runID,item.event).catch(()=>{});}};window.addEventListener('message',receive);return()=>window.removeEventListener('message',receive);},[src,slug]);
  return <section id="invitation-trial" className="invitation-trial" aria-label="Free game trial">
    <div className="invitation-trial-heading"><div><span className="eyebrow">PLAY FIRST</span><h2>Try a round before you join.</h2><p>Practice is free. Trial scores stay on this device and do not count toward rankings or team points.</p></div><button className="btn btn-secondary" onClick={() => setAttempt((n) => n + 1)}>Restart trial</button></div>
    {error ? <p role="alert">{error}</p> : !src ? <p role="status">Loading free trial…</p> : <iframe ref={frame} className="invitation-trial-frame" title="Free game trial" src={src} sandbox="allow-scripts allow-same-origin" referrerPolicy="no-referrer" />}
  </section>;
}
function Unavailable({ message }: { message: string }) {
  return <section className="invite-unavailable"><span className="eyebrow">INVITATION UNAVAILABLE</span><h1>This link can’t be used.</h1><p role="alert">{message}</p><Link className="btn btn-primary" to="/">Explore P2L <ArrowRight size={16} /></Link></section>;
}
