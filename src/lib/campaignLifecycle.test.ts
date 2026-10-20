import {describe,it,expect} from 'vitest';
import {campaignState} from './campaignLifecycle';
describe('campaign status',()=>{
 it('treats all old confirmed stages as goal reached despite extended times',()=>{
  for(const stage of ['ready','countdown','live'] as const) expect(campaignState({stage,availability:{server_time:'',state:'open'}})).toBe('goal_reached');
 });
 it('keeps reached progress separate from administrator confirmation',()=>{
  expect(campaignState({stage:'prelaunch',availability:{server_time:'',state:'open'}})).toBe('open');
  expect(campaignState({stage:'prelaunch',availability:{server_time:'',state:'scoring_closed'}})).toBe('scoring_closed');
 });
});
