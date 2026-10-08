import { ChevronDown, Trophy } from "lucide-react";
import { Link } from "react-router-dom";

export function LeaderboardScope({ campaign, chooseCampaign }: { campaign?: string; chooseCampaign: () => void }) {
  return <nav className="leaderboard-scope" aria-label="Leaderboard scope">
    {campaign
      ? <Link to="/leaderboard" className="leaderboard-scope-option"><Trophy size={16} aria-hidden="true" />P2L Points total</Link>
      : <span className="leaderboard-scope-option is-current" aria-current="page"><Trophy size={16} aria-hidden="true" />P2L Points total</span>}
    <button type="button" className={`leaderboard-scope-option${campaign ? " is-current" : ""}`} onClick={chooseCampaign}>
      <span>{campaign ? `Campaign scores · ${campaign}` : "Campaign scores"}</span><ChevronDown size={16} aria-hidden="true" />
    </button>
  </nav>;
}
