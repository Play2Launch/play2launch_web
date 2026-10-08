import { Link } from "react-router-dom";
import { TeamInvite } from "./TeamInvite";

export function TeamActions({slug,team,name,teamType,userId,ownerId,member,communityMember,paused,closed,canJoin,busy,join}: {
  slug:string;team:string;name:string;teamType?:string;userId?:string;ownerId?:string;member?:string;communityMember:boolean;paused:boolean;closed:boolean;canJoin:boolean;busy:boolean;join:()=>void;
}) {
  const automated=teamType==="bot";
  const captain=!!userId&&userId===ownerId;
  const mine=!!userId&&member===team;
  return <section className="team-actions" aria-label="Team actions">
    {mine&&<span className="team-membership-label">{captain?"YOUR TEAM · CAPTAIN":"Your team · Joined"}</span>}
    {!automated&&mine&&!paused&&<TeamInvite slug={slug} team={team} name={name} referrer={userId}/>}
    <div className="team-action-buttons">
      {captain&&<Link className="btn btn-secondary" to={`/captain?campaign=${encodeURIComponent(slug)}`}>Manage team</Link>}
      {mine&&!paused&&<Link className="btn btn-secondary" to={`/campaign/${encodeURIComponent(slug)}/compete`}>Play for your team</Link>}
      {!automated&&!mine&&(!member||communityMember)&&!paused&&!closed&&canJoin&&<button className="btn btn-primary" disabled={busy} onClick={join}>{busy?'Joining…':`Join ${name}`}</button>}
    </div>
    {automated?<p className="small muted">Platform automated team · Players cannot join or receive invitations.</p>:<>
      {paused&&<p className="small muted">Team paused · Joining and new games are unavailable. Past scores are preserved.</p>}
      {!mine&&(!member||communityMember)&&!paused&&(closed||!canJoin)&&<p className="small muted">{closed?'Joining is closed.':'An invitation is required to join.'}</p>}
    </>}
  </section>;
}
