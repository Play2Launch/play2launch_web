import { formatTicker } from "../lib/ticker";
import type { CSSProperties } from "react";
import { ArrowLeft, ArrowUpRight, ChevronRight, Send } from "lucide-react";
import { Link, NavLink } from "react-router-dom";
import type { Campaign } from "../data";
import { campaignTypeName } from "../lib/campaignLifecycle";
import { CampaignStatus } from "./CampaignStatus";
import { useApp } from "../state";
import { walletAllowed } from "../lib/walletPolicy";
import { CampaignArtwork } from "./CampaignArtwork";

export type CampaignHeaderData = Pick<
  Campaign,
  | "availability"
  | "campaign_type"
  | "id"
  | "name"
  | "ticker"
  | "category"
  | "description"
  | "stage"
  | "color"
  | "symbol"
  | "cover_image"
  | "hero_image"
  | "image_alt"
> & { teams?: number };

export function CampaignNav({
  campaign,
  live = false,
  activeTab,
}: {
  campaign: CampaignHeaderData;
  live?: boolean;
  activeTab?: "leaderboard";
}) {
  const app = useApp();
  return (
    <>
      <div className="breadcrumbs">
        <Link to="/">
          <ArrowLeft size={14} /> Discover
        </Link>
        <ChevronRight size={13} />
        <span>{campaign.name}</span>
        {!live && (
          <button
            className="text-link"
            onClick={() => app.setShareCampaign(campaign.id)}
          >
            <Send size={14} /> Share campaign
          </button>
        )}
      </div>
      <nav className={`campaign-nav${live ? " campaign-nav-live" : ""}`} aria-label="Campaign navigation">
        <NavLink end to={`/campaign/${campaign.id}`}>
          Overview
        </NavLink>
        {live ? (
          <>
            {campaign.campaign_type !== 'play_to_ido' && <NavLink to={`/campaign/${campaign.id}/teams`}>Teams</NavLink>}
            {activeTab === "leaderboard" ? (
              <Link
                to={`/campaign/${campaign.id}/leaderboard`}
                className="active"
                aria-current="page"
              >
                Leaderboard
              </Link>
            ) : (
              <NavLink to={`/campaign/${campaign.id}/leaderboard`}>
                Leaderboard
              </NavLink>
            )}
          </>
        ) : (
          <>
            <NavLink to={`/campaign/${campaign.id}/teams`}>
              Teams <span>{campaign.teams}</span>
            </NavLink>
            <NavLink to={`/campaign/${campaign.id}/leaderboard`}>
              Leaderboard
            </NavLink>
            {walletAllowed(app.platform?.runtime) && (
              <NavLink to={`/campaign/${campaign.id}/launch`}>
                Launch <ArrowUpRight size={13} />
              </NavLink>
            )}
          </>
        )}
      </nav>
    </>
  );
}

export function CampaignIdentityCard({
  campaign,
  stage = campaign.stage,
}: {
  campaign: CampaignHeaderData;
  stage?: Campaign["stage"];
}) {
  return (
    <section
      className="campaign-identity"
      aria-label={`Campaign: ${campaign.name}`}
      style={{ "--campaign-color": campaign.color } as CSSProperties}
    >
      <div className="campaign-identity-art">
        <CampaignArtwork campaign={campaign} variant="hero" />
      </div>
      <div className="campaign-identity-content">
        <div className="campaign-identity-meta">
          <CampaignStatus stage={stage} campaign={campaign} />
          {campaign.availability && <span className="micro">{campaignTypeName(campaign.campaign_type)}</span>}
          <span>{formatTicker(campaign.ticker)}</span>
          <span className="campaign-identity-category">{campaign.category}</span>
        </div>
        <h1>{campaign.name}</h1>
        <p>{campaign.description}</p>
      </div>
    </section>
  );
}
