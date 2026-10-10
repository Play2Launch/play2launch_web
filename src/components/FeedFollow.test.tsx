// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ActivityFeed } from './ActivityFeed';
import { api } from '../lib/api';
const state=vi.hoisted(()=>({user:{id:'ur1',mode:'live'} as {id:string;mode:string}|null,setAuthOpen:vi.fn()}));
vi.mock('../state',()=>({useApp:()=>state}));
vi.mock('../lib/api',()=>({api:{request:vi.fn(),authenticated:vi.fn()}}));
const post=(n:number,user='ur2')=>({id:'sp'+String(n).padStart(64,'0'),type:'post',user_id:user,author:'Captain',text:'Hello '+n,at:'2026-10-01T10:00:00Z'});
function mount(){return render(<MemoryRouter><ActivityFeed kind="" discover/></MemoryRouter>)}
afterEach(()=>{cleanup();vi.resetAllMocks();state.user={id:'ur1',mode:'live'}});
it('deduplicates authors, synchronizes toggles and uses the short cache on refresh',async()=>{
 vi.mocked(api.request).mockResolvedValue({items:[post(1),post(2),post(3,'ur1')],next_cursor:''});
 vi.mocked(api.authenticated).mockImplementation(async(path)=>path==='/social/follow-states'?{ur2:false}:path==='/social/post-like-states'?{}:{following:true,followers_count:1});
 mount();const buttons=await screen.findAllByRole('button',{name:'Follow'});expect(buttons).toHaveLength(2);
 expect(api.authenticated).toHaveBeenCalledTimes(2);
 expect(api.authenticated).toHaveBeenCalledWith('/social/follow-states',{user_ids:['ur2']},expect.anything());
 expect(screen.queryByText('Follow author')).toBeNull();
 fireEvent.click(buttons[0]);await waitFor(()=>expect(screen.getAllByRole('button',{name:'Following'})).toHaveLength(2));
 fireEvent.click(screen.getByRole('button',{name:'Refresh activity'}));
 await waitFor(()=>expect(api.request).toHaveBeenCalledTimes(2));
 expect(vi.mocked(api.authenticated).mock.calls.filter(([p])=>p==='/social/follow-states')).toHaveLength(1);
});
it('guests see Follow immediately without any private request',async()=>{
 state.user=null;vi.mocked(api.request).mockResolvedValue({items:[post(1)],next_cursor:''});
 mount();fireEvent.click(await screen.findByRole('button',{name:'Follow'}));
 expect(state.setAuthOpen).toHaveBeenCalledWith(true);expect(api.authenticated).not.toHaveBeenCalled();
});
it('does not guess follow states when the batch fails; retries as a batch',async()=>{
 vi.mocked(api.request).mockResolvedValue({items:[post(1)],next_cursor:''});
 vi.mocked(api.authenticated).mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce({ur2:true});
 mount();await screen.findByRole('alert');expect(screen.queryByRole('button',{name:'Follow'})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Retry activity'}));await screen.findByRole('button',{name:'Following'});
 expect(api.authenticated).toHaveBeenCalledTimes(3);
});
it('does not reuse a different account’s cache',async()=>{
 vi.mocked(api.request).mockResolvedValue({items:[post(1)],next_cursor:''});
 vi.mocked(api.authenticated).mockResolvedValueOnce({ur2:true}).mockResolvedValueOnce({}).mockResolvedValueOnce({ur2:false}).mockResolvedValueOnce({});
 const view=mount();await screen.findByRole('button',{name:'Following'});
 state.user={id:'ur3',mode:'live'};view.rerender(<MemoryRouter><ActivityFeed kind="" discover/></MemoryRouter>);
 await screen.findByRole('button',{name:'Follow'});expect(api.authenticated).toHaveBeenCalledTimes(4);
});
