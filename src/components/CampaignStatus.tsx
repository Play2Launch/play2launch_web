import { stageLabel, type Stage, type Campaign } from "../data";
import { campaignState, campaignStateLabels } from '../lib/campaignLifecycle';
export function CampaignStatus({ stage, campaign }: { stage: Stage; campaign?: Pick<Campaign,"stage"|"availability"|"campaign_type"> }) {
 const state=campaign?.availability?campaignState(campaign):undefined;
 const color=state==='goal_reached'?'live':state==='not_started'?'countdown':state==='scoring_closed'?'ended':stage;
 return <span className={`pill campaign-status stage-${state==='open'?'prelaunch':color}`}><i aria-hidden="true" />{state?campaignStateLabels[state]||state:stageLabel(stage)}</span>;
}
