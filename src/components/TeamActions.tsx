import { useState } from "react";
import { Link } from "react-router-dom";
import { TeamInvite } from "./TeamInvite";

export function TeamActions({slug,team,name,userId,ownerId,member,communityMember,paused,closed,canJoin,busy,join}: {
  slug:string;team:string;name:string;userId?:string;ownerId?:string;member?:string;communityMember:boolean;paused:boolean;closed:boolean;canJoin:boolean;busy:boolean;join:()=>void;
}) {
  const captain=!!userId&&userId===ownerId;
  const mine=!!userId&&member===team;
  const [invite,setInvite]=useState(false);
  const [shareURL,setShareURL]=useState("");
  const [notice,setNotice]=useState("");
  async function share() {
    const url=new URL(`/campaign/${encodeURIComponent(slug)}/teams`,window.location.origin);
    if(url.hostname==="play2launch.com")url.hostname="www.play2launch.com";
    url.searchParams.set("selected",team);url.searchParams.set("src","direct");
    try { await navigator.clipboard.writeText(url.href);setNotice("Team link copied."); }
    catch {setShareURL(url.href);setNotice("Copy the team link below.");}
  }
  return <section className="team-actions" aria-label="Team actions">
    {mine&&<span className="pill acid">{captain?"YOUR TEAM · CAPTAIN":"Your team · Joined"}</span>}
    <div className="team-action-buttons">
      {captain&&<Link className="btn btn-primary" to={`/captain?campaign=${encodeURIComponent(slug)}`}>Manage team</Link>}
      {mine&&!paused&&<Link className={`btn ${captain?'btn-secondary':'btn-primary'}`} to={`/campaign/${encodeURIComponent(slug)}/compete`}>Play for your team</Link>}
      {!mine&&(!member||communityMember)&&!paused&&!closed&&canJoin&&<button className="btn btn-primary" disabled={busy} onClick={join}>{busy?'Joining…':`Join ${name}`}</button>}
      {mine&&!paused&&<button className="btn btn-secondary" aria-expanded={invite} onClick={()=>setInvite(v=>!v)}>{captain?'Invite players':'Invite friends'}</button>}
      <button className="btn btn-secondary" onClick={()=>void share()}>Share team</button>
    </div>
    {paused&&<p className="small muted">Team paused · Joining and new games are unavailable. Past scores are preserved.</p>}
    {!mine&&(!member||communityMember)&&!paused&&(closed||!canJoin)&&<p className="small muted">{closed?'Joining is closed.':'An invitation is required to join.'}</p>}
    {notice&&<p role="status" className="small muted">{notice}</p>}
    {shareURL&&<input aria-label="Team share link" readOnly value={shareURL} onFocus={e=>e.target.select()}/>}
    {invite&&mine&&!paused&&<TeamInvite slug={slug} team={team} name={name} referrer={userId}/>}
  </section>;
}
