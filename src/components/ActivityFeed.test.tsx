// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ActivityFeed } from './ActivityFeed';
import { api } from '../lib/api';
vi.mock('../lib/api',()=>({api:{authenticated:vi.fn(),request:vi.fn()}}));
vi.mock('../state',()=>({useApp:()=>({user:null})}));
const item={id:'cp1:milestone:100',campaign_id:'cp1',name:'Moon Run',slug:'moon',milestone:100,points:100,target:100,score_per_point:100,reason:'goal_adjusted',at:'2026-09-30T10:00:00Z'};
afterEach(()=>{cleanup();vi.mocked(api.authenticated).mockReset()});
it('renders campaign lifecycle events without a fake progress bar or final-results claim',async()=>{
 vi.mocked(api.authenticated).mockResolvedValue({items:[{...item,id:'cp1:lifecycle:scoring_ended',type:'campaign',event:'scoring_ended',scoring_ends_at:item.at}],next_cursor:''});
 render(<MemoryRouter><ActivityFeed kind="campaign"/></MemoryRouter>);
 await screen.findByText('Campaign scoring has ended.');
 expect(screen.queryByRole('progressbar')).toBeNull();
 expect(screen.getByText(/not confirmed final results/)).toBeTruthy();
 expect(screen.getByRole('link',{name:/View leaderboard/}).getAttribute('href')).toBe('/campaign/moon/leaderboard');
});
it('renders a goal adjustment snapshot, never claiming it is launched',async()=>{
 vi.mocked(api.authenticated).mockResolvedValue({items:[item],next_cursor:''});render(<MemoryRouter><ActivityFeed kind=""/></MemoryRouter>);
 await screen.findByText('Community goal reached.');expect(screen.getByText(/After an update/)).toBeTruthy();expect(screen.getByText(/does not mean the asset has launched/)).toBeTruthy();
 expect(screen.getByRole('link',{name:/View campaign/}).getAttribute('href')).toBe('/campaign/moon');
 expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100');
});
it('preserves earlier cards on paging failure and retries the cursor',async()=>{
 vi.mocked(api.authenticated).mockResolvedValueOnce({items:[item],next_cursor:'cursor'}).mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce({items:[{...item,id:'cp2:milestone:25',campaign_id:'cp2',milestone:25}],next_cursor:''});
 render(<MemoryRouter><ActivityFeed kind="campaign"/></MemoryRouter>);
 fireEvent.click(await screen.findByRole('button',{name:'Load more activity'}));await screen.findByRole('alert');expect(screen.getByText('Community goal reached.')).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Retry activity'}));await screen.findByText('25% of the unlock goal reached.');
 expect(vi.mocked(api.authenticated).mock.calls[2][0]).toBe('/social/feed?kind=campaign&after=cursor');
});
it('explains empty player activity',async()=>{
 vi.mocked(api.authenticated).mockResolvedValue({items:[],next_cursor:''});render(<MemoryRouter><ActivityFeed kind="user"/></MemoryRouter>);
 await screen.findByText('No updates yet.');expect(api.authenticated).toHaveBeenCalledWith('/social/feed?kind=user',undefined,expect.anything());
});
it('rejects malformed activity responses',async()=>{
 vi.mocked(api.authenticated).mockResolvedValue({items:[{...item,target:0}],next_cursor:''});render(<MemoryRouter><ActivityFeed kind=""/></MemoryRouter>);
 await screen.findByRole('alert');expect(screen.queryByText('Community goal reached.')).toBeNull();
});
it('renders shared zero scores as game points with a player profile link',async()=>{
 vi.mocked(api.authenticated).mockResolvedValue({items:[{...item,id:'score:gs1',type:'score',user_id:'ur1',author:'Player One',score:0,game_key:'paper',rules:'v1'}],next_cursor:''});
 render(<MemoryRouter><ActivityFeed kind="user"/></MemoryRouter>);
 await screen.findByText('0 game points');expect(screen.getByRole('link',{name:'Player One'}).getAttribute('href')).toBe('/players/ur1');expect(screen.queryByRole('progressbar')).toBeNull();
});
