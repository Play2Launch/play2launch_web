// @vitest-environment jsdom
import React from 'react';
import {act,cleanup,render,screen} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {AirdropPanel} from './AirdropPanel';
const mocks=vi.hoisted(()=>({request:vi.fn(),authenticated:vi.fn(),wallet:vi.fn()}));
vi.mock('../lib/api',()=>({api:mocks}));
vi.mock('../state',()=>({useApp:()=>({user:{id:'ur1'},platform:{runtime:'web'},setAuthOpen:vi.fn()})}));
vi.mock('../lib/walletLoader',()=>({useWalletModule:()=>null,loadWallet:mocks.wallet}));
vi.mock('../lib/walletPolicy',()=>({walletAllowed:()=>true}));
const fixture=()=>({configured:true,settings:{symbol:'DROP',total:'1000000',decimals:6},root:'root',allocation:'1000000',locked_at:'2026-01-01',total_score:'100',chain:{root:'root',allocation:'1000000',opened:true,paused:false,closed:false,deadline:0}});
beforeEach(()=>{mocks.request.mockResolvedValue(fixture());mocks.authenticated.mockResolvedValue({entry:{score:50,amount:'500000',wallet:''},claimed:false})});
afterEach(()=>{cleanup();vi.useRealTimers();vi.clearAllMocks()});
it('separates the configured pool from pending personal rewards before settlement',async()=>{const d={...fixture(),locked_at:null,root:'',allocation:'',settings:{symbol:'PHOOD',total:'100000000000000000000000',decimals:18},chain:{...fixture().chain,root:'0x0',allocation:'0',opened:false}};mocks.request.mockResolvedValue(d);mocks.authenticated.mockResolvedValue({entry:null,claimed:false});render(<AirdropPanel slug="drop"/>);await screen.findByText('Claims coming soon');expect(screen.getByText('To be announced')).toBeTruthy();expect(screen.getByText('Reward pool').parentElement?.textContent).toContain('100,000 PHOOD');expect(screen.getByRole('region',{name:'Campaign airdrop'}).className).toBe('airdrop-panel');expect(screen.queryByRole('button',{name:'Connect wallet to claim'})).toBeNull()});
it('shows allocation without deadline text or a timer when no deadline is set',async()=>{render(<AirdropPanel slug="drop"/>);expect(await screen.findByLabelText('Your allocation: 0.5 DROP')).toBeTruthy();expect(screen.queryByText(/administrator may recover|No fixed claim deadline/)).toBeNull();expect(screen.queryByRole('timer')).toBeNull();expect(screen.getByRole('button',{name:'Connect wallet to claim'})).toBeTruthy();expect(mocks.wallet).not.toHaveBeenCalled()});
it('counts down every second and disables claims at expiry',async()=>{vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-27T12:00:00Z'));const d=fixture();d.chain.deadline=Date.now()/1000+2;mocks.request.mockResolvedValue(d);await act(async()=>{render(<AirdropPanel slug="drop"/>)});expect(screen.getByRole('timer').textContent).toBe('00:00:02');await act(async()=>{vi.advanceTimersByTime(1000)});expect(screen.getByRole('timer').textContent).toBe('00:00:01');await act(async()=>{vi.advanceTimersByTime(1000)});expect(screen.queryByRole('timer')).toBeNull();expect(screen.getByText('Claim period ended')).toBeTruthy();expect(screen.queryByRole('button',{name:'Connect wallet to claim'})).toBeNull()});
it('removes claim controls after recovery while keeping the recorded allocation visible',async()=>{const d=fixture();d.chain.closed=true;mocks.request.mockResolvedValue(d);render(<AirdropPanel slug="drop"/>);await screen.findByText(/Claims permanently closed/);expect(screen.queryByRole('button',{name:'Connect wallet to claim'})).toBeNull();expect(screen.getByLabelText('Your allocation: 0.5 DROP')).toBeTruthy()});
it('does not offer another claim for an already claimed allocation',async()=>{mocks.authenticated.mockResolvedValue({entry:{score:50,amount:'500000'},claimed:true});render(<AirdropPanel slug="drop"/>);await screen.findByLabelText('Claimed: 0.5 DROP');expect(screen.queryByRole('button',{name:'Connect wallet to claim'})).toBeNull()});

it('emphasizes a compact personal amount and retains the precise allocation',async()=>{
 const d=fixture();d.settings.decimals=18;mocks.request.mockResolvedValue(d);
 mocks.authenticated.mockResolvedValue({entry:{score:1000,amount:'9090909090909090909090'},claimed:false});
 render(<AirdropPanel slug="drop"/>);
 const amount=await screen.findByLabelText('Your allocation: 9,090.90909090909090909 DROP');
 expect(amount.textContent).toBe('≈ 9,090.909 DROP');
 expect(amount.getAttribute('title')).toBe('9,090.90909090909090909 DROP');
 expect(amount.closest('.airdrop-panel-personal')?.querySelector('button')?.textContent).toBe('Connect wallet to claim');
});

it('shows prominent claim confirmation and a persistent transaction link',async()=>{
 const hash='0x'+'a'.repeat(64);mocks.request.mockResolvedValue({...fixture(),network:{explorer_url:'https://explorer.testnet.chain.robinhood.com'}});
 mocks.authenticated.mockResolvedValue({entry:{score:50,amount:'500000'},claimed:true,transaction:hash});
 render(<AirdropPanel slug="drop"/>);
 expect(await screen.findByText('Rewards claimed')).toBeTruthy();
 expect(screen.getByRole('link',{name:hash+' ↗'}).getAttribute('href')).toBe('https://explorer.testnet.chain.robinhood.com/tx/'+hash);
 expect(screen.queryByRole('button',{name:'Connect wallet to claim'})).toBeNull();
});
