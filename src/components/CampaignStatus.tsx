import { stageLabel, type Stage } from "../data";

export function CampaignStatus({ stage }: { stage: Stage }) {
  return <span className={`pill campaign-status stage-${stage}`}><i aria-hidden="true" />{stageLabel(stage)}</span>;
}
