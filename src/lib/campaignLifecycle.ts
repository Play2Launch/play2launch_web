import type { Campaign } from '../data';
export function campaignTypeName(type?: string) {
 return type==='play_to_ido'?'Play to IDO':type==='play_to_trade'?'Play to Trade':'Play to Launch';
}
export function campaignState(c: Pick<Campaign,'stage'|'availability'|'campaign_type'|'starts_at'|'ends_at'|'scoring_ends_at'>) {
 if(c.campaign_type==='play_to_trade') return 'coming_soon';
 if(c.campaign_type==='play_to_ido') return c.availability?.state || 'not_started';
 if(c.stage!=='prelaunch') return 'goal_reached';
 if(c.availability?.state) return c.availability.state;
 return 'open';
}
export const campaignStateLabels: Record<string,string> = {open:'ACTIVE',joining_closed:'ACTIVE',not_started:'UPCOMING',scoring_closed:'ENDED',goal_reached:'GOAL REACHED',coming_soon:'COMING SOON',schedule_unconfigured:'COMING SOON',unpublished:'UNAVAILABLE'};
