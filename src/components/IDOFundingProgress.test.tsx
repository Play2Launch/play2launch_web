// @vitest-environment jsdom
import {cleanup,render,screen} from '@testing-library/react';
import {afterEach,expect,it} from 'vitest';
import {IDOFundingProgress} from './IDOFundingProgress';
import type {IDOState} from '../lib/ido';
afterEach(cleanup);
const state = {raised:110001n,sale:{softCapCents:10000n,hardCapCents:200000n,start:100,end:200},now:300,phase:0,blocked:false,paused:false} as unknown as IDOState;
it('distinguishes ended subscriptions from successful settlement',()=>{
 const view=render(<IDOFundingProgress state={state}/>);
 expect(screen.getByText('Ended · Awaiting settlement')).toBeTruthy();
 expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('55');
 expect(screen.getByText('$100.00')).toBeTruthy();
 expect(screen.getByText('$2,000.00')).toBeTruthy();
 view.rerender(<IDOFundingProgress state={{...state,phase:1}}/>);
 expect(screen.getByText('Successfully settled')).toBeTruthy();
 expect(screen.getByText(/Rebates ready/)).toBeTruthy();
});
it('shows an unmet soft cap without implying successful funding',()=>{
 render(<IDOFundingProgress state={{...state,raised:5000n,now:150}}/>);
 expect(screen.getByText('Subscriptions open')).toBeTruthy();
 expect(screen.getByText('$50.00 to soft cap')).toBeTruthy();
 expect(screen.queryByText('Reached')).toBeNull();
});
it('does not describe a future scheduled end as already ended when refunds open early',()=>{
 render(<IDOFundingProgress state={{...state,now:150,phase:2}}/>);
 expect(screen.getByText('Refunds open')).toBeTruthy();
 expect(screen.getByText(/Scheduled end/)).toBeTruthy();
 expect(screen.queryByText(/^Ended /)).toBeNull();
});
