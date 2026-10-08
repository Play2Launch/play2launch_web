// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {render,screen,cleanup,fireEvent} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
const mocks=vi.hoisted(()=>({memberships:vi.fn(),request:vi.fn()}));
vi.mock('../lib/teams',()=>({memberships:mocks.memberships}));
vi.mock('../lib/api',()=>({api:{request:mocks.request}}));
import {CaptainTeams} from './CaptainTeams';
afterEach(()=>{cleanup();vi.resetAllMocks();});
it('loads captain teams across campaigns with direct management and invite links',async()=>{
 mocks.memberships.mockResolvedValue({items:[{campaign_id:'cp1',slug:'phood',name:'PAPERHOOD',team_name:'Wizards',membership:{team_id:'tm1'},activity_status:'active'}],next_cursor:''});
 mocks.request.mockResolvedValue({total:31,team_score:18418});
 render(<MemoryRouter><CaptainTeams create={vi.fn()}/></MemoryRouter>);
 await screen.findByText('Wizards');await screen.findByText('18,418');
 expect(mocks.memberships.mock.calls[0][2]).toEqual({q:'',status:'all',role:'captain'});
 expect(screen.getByRole('link',{name:'Manage team'}).getAttribute('href')).toBe('/captain?campaign=phood');
 expect(screen.getByRole('link',{name:'Invite to team'}).getAttribute('href')).toContain('panel=invite');
 expect(screen.getByRole('link',{name:'Invite to team'}).className).toContain('btn-primary');
});
it('offers creation when no teams exist',async()=>{
 mocks.memberships.mockResolvedValue({items:[],next_cursor:''});const create=vi.fn();
 render(<MemoryRouter><CaptainTeams create={create}/></MemoryRouter>);
 fireEvent.click(await screen.findByRole('button',{name:'Create your first team'}));expect(create).toHaveBeenCalledTimes(1);expect(mocks.request).not.toHaveBeenCalled();
});
