// @vitest-environment jsdom
import {render,screen,cleanup} from '@testing-library/react';
import {afterEach,it,expect} from 'vitest';
import {IDOPersonalProgress} from './IDOPersonalProgress';
afterEach(cleanup);
const state=(paid=10000n,phase=0)=>({account:{paidCents:paid,rebateCents:2000n,rebateClaimed:false},phase,sale:{hardCapCents:5000000n},raised:paid}) as any;
it('shows score capacity and only the rebate supported by purchases',()=>{
 render(<IDOPersonalProgress state={state()} score={20000} active/>);
 expect(screen.getByRole('progressbar',{name:'Your subscription'}).getAttribute('aria-valuenow')).toBe('100');
 expect(screen.getByRole('progressbar',{name:'Rebate supported by your subscription'}).getAttribute('aria-valuenow')).toBe('20');
 expect(screen.getByText('$900.00 more')).toBeTruthy();
});
it('respects the first purchase minimum and caps score allowance',()=>{
 render(<IDOPersonalProgress state={state(0n)} score={1000} active/>);
 expect(screen.getByText('$100.00 more')).toBeTruthy();
 cleanup();render(<IDOPersonalProgress state={state()} score={40000} active/>);
 expect(screen.getByText('$900.00 more')).toBeTruthy();
});
it('does not suggest buying after closure or without matching account data',()=>{
 render(<IDOPersonalProgress state={state()} score={20000} active={false}/>);
 expect(screen.queryByText(/more$/)).toBeNull();
 expect(screen.getByText('Additional purchases are currently unavailable.')).toBeTruthy();
 cleanup();render(<IDOPersonalProgress state={state()} active/>);
 expect(screen.getByText(/Verify your matching account/)).toBeTruthy();
});
it('keeps finalized rebates independent of current score',()=>{
 render(<IDOPersonalProgress state={state(10000n,1)} score={0} active={false}/>);
 expect(screen.getByRole('progressbar',{name:'Rebate supported by your subscription'}).getAttribute('aria-valuenow')).toBe('20');
 expect(screen.queryByText('Score allowance')).toBeNull();
});
