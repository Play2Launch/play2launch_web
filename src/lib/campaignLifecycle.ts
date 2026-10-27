import type { Campaign } from '../data';
export function campaignTypeName(type?: string) {
 return type==='play_to_ido'?'Play to IDO':type==='play_to_trade'?'Play to Trade':'Play to Launch';
}
export type ClaimStatus = 'claims_pending' | 'claims_open' | 'claims_paused' | 'claims_ended' | 'claims_closed' | 'claims_unknown';
export type AirdropStatusData = { configured: boolean; locked_at?: string; root?: string; allocation?: string; chain?: { opened: boolean; closed: boolean; paused: boolean; deadline: number; root: string; allocation: string } };
export function airdropState(data: AirdropStatusData, now = Date.now()): ClaimStatus {
 const c=data.chain;
 if(!data.configured || !data.locked_at || !c) return 'claims_unknown';
 if(c.closed) return 'claims_closed';
 if(c.deadline>0 && now>=c.deadline*1000) return 'claims_ended';
 if(c.paused) return 'claims_paused';
 return c.opened && c.root===data.root && c.allocation===data.allocation ? 'claims_open' : 'claims_pending';
}
export function campaignState(c: Pick<Campaign,'stage'|'availability'|'campaign_type'|'starts_at'|'ends_at'|'scoring_ends_at'|'airdrop_locked'|'airdrop_status'>) {
 if(c.campaign_type==='play_to_trade') return 'coming_soon';
 if(c.campaign_type==='play_to_ido') return c.availability?.state || 'not_started';
 if(c.airdrop_locked) return c.airdrop_status ? airdropState(c.airdrop_status) : 'claims_unknown';
 if(c.stage!=='prelaunch') return 'goal_reached';
 if(c.availability?.state) return c.availability.state;
 return 'open';
}
export const campaignStateLabels: Record<string,string> = {claims_pending:'AWAITING CLAIMS',claims_open:'CLAIMS OPEN',claims_paused:'CLAIMS PAUSED',claims_ended:'CLAIMS ENDED',claims_closed:'CLAIMS CLOSED',claims_unknown:'UPDATING STATUS',open:'ACTIVE',joining_closed:'ACTIVE',not_started:'UPCOMING',scoring_closed:'ENDED',goal_reached:'GOAL REACHED',coming_soon:'COMING SOON',schedule_unconfigured:'COMING SOON',unpublished:'UNAVAILABLE'};
