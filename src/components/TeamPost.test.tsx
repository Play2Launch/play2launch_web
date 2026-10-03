// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TeamPostCard } from './TeamPost';
import { ActivityFeed, type Activity } from './ActivityFeed';
import { api } from '../lib/api';
import { joinTeam } from '../lib/teams';
vi.mock('../lib/api',()=>({api:{authenticated:vi.fn(),request:vi.fn()}}));
vi.mock('../lib/teams',()=>({joinTeam:vi.fn()}));
vi.mock('../state',()=>({useApp:()=>({user:{id:'ur2',mode:'live'}})}));
const item={id:'sp'+'a'.repeat(64),type:'post',user_id:'ur1',author:'Captain',text:'Join us!',campaign_id:'cp1',slug:'moon',name:'Moon',score:0,at:'2026-10-01T10:00:00Z',team:{id:'tm1',name:'Team One',color:'#abcdef',players:5,rank:2,score:300,contribution:100,member_rank:2,invite_token:'a'.repeat(32),as_of:'2026-10-01T10:00:00Z'}} as Activity;
afterEach(()=>{cleanup();vi.mocked(api.authenticated).mockReset();vi.mocked(api.request).mockReset();vi.mocked(joinTeam).mockReset()});
it('shows only the battle report for a member of a different team',()=>{
 render(<MemoryRouter><TeamPostCard item={{...item,team_action:'none'}}/></MemoryRouter>);
 expect(screen.getByText('Team One')).toBeTruthy();expect(screen.queryByRole('button',{name:'Join team'})).toBeNull();expect(screen.queryByText(/other team/i)).toBeNull();expect(screen.queryByRole('link')).toBeNull();
});
it('joins with the stored personal invitation, never a client referrer',async()=>{
 vi.mocked(joinTeam).mockResolvedValue({id:'mb1',team_id:'tm1',joined_at:'2026-10-01T10:00:00Z'});
 render(<MemoryRouter><TeamPostCard item={{...item,team_action:'join'}}/></MemoryRouter>);
 fireEvent.click(screen.getByRole('button',{name:'Join team'}));
 await vi.waitFor(()=>expect(joinTeam).toHaveBeenCalledWith('moon','tm1',undefined,undefined,'a'.repeat(32)));
});
it('shows own-team and expired-invitation states without join buttons',()=>{
 const view=render(<MemoryRouter><TeamPostCard item={{...item,team_action:'own'}}/></MemoryRouter>);
 expect(screen.getByRole('link',{name:'View my team'}).getAttribute('href')).toBe('/campaign/moon/teams?selected=tm1');
 view.rerender(<MemoryRouter><TeamPostCard item={{...item,team_action:'expired'}}/></MemoryRouter>);
 expect(screen.getByText('Invitation no longer available.')).toBeTruthy();expect(screen.queryByRole('button',{name:'Join team'})).toBeNull();
});
it('sends guests through the existing invitation route',()=>{
 render(<MemoryRouter><TeamPostCard item={{...item,team_action:'guest'}}/></MemoryRouter>);
 expect(screen.getByRole('link',{name:'Sign in to join team'}).getAttribute('href')).toBe('/invite/'+'a'.repeat(32));
});
it('loads eligibility for all cards in one authenticated batch',async()=>{
 const second={...item,id:'sp'+'b'.repeat(64)};
 vi.mocked(api.authenticated).mockResolvedValueOnce({items:[item,second],next_cursor:''}).mockResolvedValueOnce({[item.id]:'none',[second.id]:'join'});
 render(<MemoryRouter><ActivityFeed kind="user"/></MemoryRouter>);
 await screen.findByRole('button',{name:'Join team'});
 expect(screen.getAllByRole('button',{name:'Join team'})).toHaveLength(1);
 expect(api.authenticated).toHaveBeenCalledTimes(2);
 expect(api.authenticated).toHaveBeenLastCalledWith('/social/team-entries',{post_ids:[item.id,second.id]},expect.anything());
});
