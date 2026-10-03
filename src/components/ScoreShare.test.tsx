// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ScoreShare } from './ScoreShare';
import { api } from '../lib/api';
vi.mock('../lib/api',()=>({api:{authenticated:vi.fn()}}));
afterEach(()=>{cleanup();vi.mocked(api.authenticated).mockReset()});
it('shares only after explicit action and can withdraw',async()=>{
 vi.mocked(api.authenticated).mockResolvedValueOnce({shared:false}).mockResolvedValueOnce({shared:true}).mockResolvedValueOnce({shared:false});
 render(<ScoreShare sessionId="gs1"/>);
 const button=await screen.findByRole('button',{name:'Share verified score'});
 expect(api.authenticated).toHaveBeenCalledTimes(1);
 fireEvent.click(button);
 fireEvent.click(await screen.findByRole('button',{name:'Withdraw shared result'}));
 await screen.findByRole('button',{name:'Share verified score'});
 expect(vi.mocked(api.authenticated).mock.calls[1][1]).toEqual({shared:true});expect(vi.mocked(api.authenticated).mock.calls[2][1]).toEqual({shared:false});
});
it('does not claim success after a failed write',async()=>{
 vi.mocked(api.authenticated).mockResolvedValueOnce({shared:false}).mockRejectedValueOnce(new Error('Offline'));
 render(<ScoreShare sessionId="gs1"/>);fireEvent.click(await screen.findByRole('button',{name:'Share verified score'}));await screen.findByRole('alert');expect(screen.queryByRole('button',{name:'Withdraw shared result'})).toBeNull();
});
