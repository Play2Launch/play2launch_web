import {describe,it,expect} from 'vitest';
import {airdropState,campaignState} from './campaignLifecycle';
describe('campaign status',()=>{
 it('treats all old confirmed stages as goal reached despite extended times',()=>{
  for(const stage of ['ready','countdown','live'] as const) expect(campaignState({stage,availability:{server_time:'',state:'open'}})).toBe('goal_reached');
 });
 it('keeps reached progress separate from administrator confirmation',()=>{
  expect(campaignState({stage:'prelaunch',availability:{server_time:'',state:'open'}})).toBe('open');
  expect(campaignState({stage:'prelaunch',availability:{server_time:'',state:'scoring_closed'}})).toBe('scoring_closed');
 });
});

describe('airdrop campaign status',()=>{
 const pending={configured:true,locked_at:'2026-10-27',root:'root',allocation:'100',chain:{opened:false,closed:false,paused:false,deadline:0,root:'root',allocation:'100'}};
 it('overrides all goal reached stages once scores are locked',()=>{
  for(const stage of ['prelaunch','ready','countdown','live'] as const) expect(campaignState({stage,airdrop_locked:true,airdrop_status:pending})).toBe('claims_pending');
 });
 it('uses verified chain state and requires the settled root and amount',()=>{
  const open={...pending,chain:{...pending.chain,opened:true}};
  expect(airdropState(open)).toBe('claims_open');
  expect(airdropState({...open,chain:{...open.chain,root:'other'}})).toBe('claims_pending');
  expect(airdropState({...open,chain:{...open.chain,allocation:'99'}})).toBe('claims_pending');
  expect(airdropState({...open,chain:{...open.chain,paused:true}})).toBe('claims_paused');
  expect(airdropState({...open,chain:{...open.chain,deadline:100}},100000)).toBe('claims_ended');
  expect(airdropState({...open,chain:{...open.chain,closed:true,paused:true,deadline:100}},100000)).toBe('claims_closed');
 });
 it('does not claim rewards are open when chain status is unavailable',()=>{
  expect(campaignState({stage:'ready',airdrop_locked:true})).toBe('claims_unknown');
 });
});
