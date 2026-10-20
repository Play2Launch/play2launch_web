// @vitest-environment jsdom
import {afterEach,expect,it} from 'vitest';
import {cleanup,render,screen} from '@testing-library/react';
import {IDOVestingGuide} from './IDOVestingGuide';
import type {IDOState} from '../lib/ido';
const state=(split=true)=>({phase:1,now:1,vesting:{start:1767225600n,initialBps:3000n,cliff:0n,duration:7776000n,interval:1n,rebateCliff:2592000n,rebateDuration:7776000n,rebateInterval:1n},splitVesting:split?{base:0n,rebate:0n,baseVested:0n,rebateVested:0n}:undefined}) as unknown as IDOState;
afterEach(cleanup);
it('shows the two dynamic schedules and day 90/day 120 endpoints without a connected wallet',()=>{
 render(<IDOVestingGuide state={state()}/>);
 expect(screen.getByRole('article',{name:'Base tokens rules'})).toBeTruthy();expect(screen.getByRole('article',{name:'Rebate-backed tokens rules'})).toBeTruthy();
 expect(screen.getByText('30% unlocked')).toBeTruthy();expect(screen.getByText('0% unlocked')).toBeTruthy();expect(screen.getByText('90 days after TGE')).toBeTruthy();expect(screen.getByText('120 days after TGE')).toBeTruthy();expect(screen.getByText(/does not change your token allocation/)).toBeTruthy();
});
it('uses configured values instead of the recommended defaults',()=>{
 const s=state();Object.assign(s.vesting,{initialBps:2500n,duration:864000n,interval:86400n,rebateCliff:172800n,rebateDuration:432000n});render(<IDOVestingGuide state={s}/>);
 expect(screen.getByText('25% unlocked')).toBeTruthy();expect(screen.getByText('75% over 10 days')).toBeTruthy();expect(screen.getByText('7 days after TGE')).toBeTruthy();expect(screen.queryByText('30% unlocked')).toBeNull();
});
it('keeps legacy contracts single-schedule and hides dates before configuration',()=>{
 const s=state(false);const v=render(<IDOVestingGuide state={s}/>);expect(screen.getByRole('article',{name:'Purchased tokens rules'})).toBeTruthy();expect(screen.queryByText('Rebate-backed tokens')).toBeNull();
 s.vesting.start=0n;v.rerender(<IDOVestingGuide state={s}/>);expect(screen.getByText(/has not been configured/)).toBeTruthy();expect(screen.queryByText(/1970/)).toBeNull();
 s.phase=2;v.rerender(<IDOVestingGuide state={s}/>);expect(screen.queryByRole('region',{name:'Token release guide'})).toBeNull();
});
