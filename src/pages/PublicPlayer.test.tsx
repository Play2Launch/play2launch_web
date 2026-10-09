// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {MemoryRouter,Route,Routes} from 'react-router-dom';
import {api} from '../lib/api';
import PublicPlayer from './PublicPlayer';
vi.mock('../lib/api',()=>({api:{request:vi.fn()}}));
vi.mock('../state',()=>({useApp:()=>({user:null,setAuthOpen:vi.fn()})}));
const profile={id:'ur1',display_name:'Public Captain',handle:'captain',avatar_url:'',kol_verified:true,p2l_points:1250,campaigns:[{id:'cp1',slug:'hello',name:'Hello campaign',stage:'prelaunch',team:{id:'tmnew',name:'Current team'},games:[{game_key:'gx1',name:'Flying game',rules:'v1',best:200,rounds:2,last_played:'2026-09-01T00:00:00Z'},{game_key:'gx1',name:'Flying game',rules:'v2',best:900,rounds:1,last_played:null}]}],next_cursor:''};
function mount(){render(<MemoryRouter initialEntries={['/players/ur1']}><Routes><Route path='/players/:userId' element={<PublicPlayer/>}/></Routes></MemoryRouter>)}
afterEach(()=>{cleanup();vi.mocked(api.request).mockReset()});
it('shows public identity, current team and separate best scores by rules',async()=>{
 vi.mocked(api.request).mockResolvedValue(profile);mount();
 await screen.findByRole('heading',{name:'Public Captain'});
 expect(screen.getByText('@captain')).toBeTruthy();
 expect(screen.getByText('P2L Points')).toBeTruthy();expect(screen.getByText('1,250')).toBeTruthy();
 expect(screen.getByRole('link',{name:'Current team'}).getAttribute('href')).toBe('/campaign/hello/teams?selected=tmnew');
 expect(screen.getByText('Rules: v1')).toBeTruthy();expect(screen.getByText('Rules: v2')).toBeTruthy();
 expect(screen.getAllByText('Personal best')).toHaveLength(2);
 expect(vi.mocked(api.request).mock.calls[0][0]).toBe('/players/ur1');
});
it('handles failures and retries without requiring login',async()=>{
 vi.mocked(api.request).mockRejectedValueOnce(new Error('Player unavailable')).mockResolvedValueOnce({...profile,campaigns:[]});mount();
 await screen.findByRole('alert');fireEvent.click(screen.getByRole('button',{name:'Retry'}));
 await screen.findByText('No public campaign activity yet.');
 expect(screen.queryByRole('alert')).toBeNull();
});
it('loads more campaigns without discarding the previous page',async()=>{
 vi.mocked(api.request).mockResolvedValueOnce({...profile,next_cursor:'cp1'}).mockResolvedValueOnce({...profile,campaigns:[{...profile.campaigns[0],id:'cp2',slug:'second',name:'Second campaign',games:[]}]});mount();
 fireEvent.click(await screen.findByRole('button',{name:'Load more campaigns'}));
 await screen.findByText('Second campaign');expect(screen.getByText('Hello campaign')).toBeTruthy();
 expect(vi.mocked(api.request).mock.calls[1][0]).toBe('/players/ur1?after=cp1');
});
