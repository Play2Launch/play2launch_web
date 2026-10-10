import { UsersRound } from "lucide-react";
import type { ReactNode } from "react";
import { safeImageSource } from "./CampaignArtwork";
import { TeamAvatarImage } from "./TeamAvatarImage";

export type InvitationTeam = {
  slug: string;
  teamId: string;
  teamName: string;
  campaignName: string;
  coverImage?: string;
  inviterName: string;
  initial?: string;
  color?: string;
  avatarUrl?: string;
  players?: number;
  joinDeadline?: string;
};

export function InvitationTeamCard({ team, action, status }: {
  team: InvitationTeam;
  action?: ReactNode;
  status?: string;
}) {
  const initial = team.initial?.trim() || team.teamName.trim().charAt(0).toUpperCase() || "T";
  const cover = safeImageSource(team.coverImage);
  return <article className="invitation-team-card">
    {cover && <img className="invitation-team-watermark" src={cover} alt="" aria-hidden="true" referrerPolicy="no-referrer" onError={event => { event.currentTarget.hidden = true; }} />}
    <div className="invitation-team-card-main">
      <span className="invitation-team-avatar" style={team.color ? { backgroundColor: team.color, position:"relative", overflow:"hidden" } : {position:"relative",overflow:"hidden"}} aria-hidden="true"><TeamAvatarImage url={team.avatarUrl} initial={initial}/></span>
      <div className="invitation-team-info">
        <span className="invitation-team-campaign">{team.campaignName}</span>
        <h2>{team.teamName}</h2>
        <p>Invited by {team.inviterName}{typeof team.players === "number" && <> · <UsersRound size={13} aria-hidden="true" /> {team.players} players</>}</p>
        {team.joinDeadline && <p>Join by {new Date(team.joinDeadline).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</p>}
      </div>
    </div>
    {status && <p className="invitation-team-status">{status}</p>}
    {action && <div className="invitation-team-footer">{action}</div>}
  </article>;
}
