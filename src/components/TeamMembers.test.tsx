// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {render,screen,cleanup,fireEvent} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
const request=vi.hoisted(()=>vi.fn());
vi.mock('../lib/api',()=>({api:{request}}));
vi.mock('../state',()=>({useApp:()=>({user:{id:'ur1'}})}));
import {TeamMembers} from './TeamMembers';
afterEach(()=>{cleanup();request.mockReset();});
it('shows public members, separate scores, badges and pagination',async()=>{
 request.mockResolvedValueOnce({items:[{id:'ur1',display_name:'Captain',handle:'captain',position:1,score:900,contribution:100,captain:true,kol_verified:true}],total:2,team_score:300,next_cursor:'20'});
 render(<MemoryRouter><TeamMembers slug="phood" team="tm1"/></MemoryRouter>);
 expect((await screen.findByRole('link',{name:/Captain/})).getAttribute('href')).toBe('/players/ur1');
 expect(screen.getByText('@captain')).toBeTruthy();expect(screen.getByText('YOU')).toBeTruthy();expect(screen.getByText('900')).toBeTruthy();expect(screen.getByText('100')).toBeTruthy();
 request.mockResolvedValueOnce({items:[{id:'ur2',position:2,score:0,contribution:0,captain:false}],total:2,team_score:300,next_cursor:''});
 fireEvent.click(screen.getByRole('button',{name:'Load more members'}));
 await screen.findByRole('link',{name:/Player/});expect(screen.getAllByRole('link')).toHaveLength(2);
});
it('retries errors without inventing scores',async()=>{
 request.mockRejectedValueOnce(new Error('offline'));
 render(<MemoryRouter><TeamMembers slug="phood" team="tm1" community/></MemoryRouter>);
 await screen.findByRole('alert');request.mockResolvedValueOnce({items:[],total:0,team_score:0,next_cursor:''});
 fireEvent.click(screen.getByRole('button',{name:'Retry members'}));await screen.findByText('No members yet.');expect(screen.queryByText('Team score')).toBeNull();
});
