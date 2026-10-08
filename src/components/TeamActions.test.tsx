// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,render,screen,fireEvent} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
vi.mock('./TeamInvite',()=>({TeamInvite:()=> <div>Invitation panel</div>}));
import {TeamActions} from './TeamActions';
afterEach(cleanup);
const base={slug:'phood',team:'tm1',name:'Wizards',teamType:undefined as string|undefined,userId:'ur1',ownerId:'ur2',communityMember:false,paused:false,closed:false,canJoin:true,busy:false,join:vi.fn()};
function mount(props:Partial<typeof base>&{member?:string}={}){render(<MemoryRouter><TeamActions {...base} {...props}/></MemoryRouter>);}
it('shows captains their invitation directly alongside management',()=>{
 mount({ownerId:'ur1',member:'tm1'});
 const identity=screen.getByText('YOUR TEAM · CAPTAIN');
 expect(identity.classList.contains('team-membership-label')).toBe(true);
 expect(identity.closest('button,a')).toBeNull();
 expect(screen.getByRole('link',{name:'Manage team'}).getAttribute('href')).toBe('/captain?campaign=phood');
 expect(screen.getByText('Invitation panel')).toBeTruthy();
});
it('gives members play and invitations without management',()=>{
 mount({member:'tm1'});expect(screen.getByRole('link',{name:'Play for your team'}).getAttribute('href')).toBe('/campaign/phood/compete');expect(screen.queryByRole('link',{name:'Manage team'})).toBeNull();expect(screen.getByText('Invitation panel')).toBeTruthy();
});
it('hides join for users in another team',()=>{
 mount({member:'tm2'});expect(screen.queryByRole('button',{name:/Join/})).toBeNull();expect(screen.queryByText('Invitation panel')).toBeNull();
});
it('does not offer joining or invitations for platform automated teams',()=>{
 mount({teamType:'bot',canJoin:false});
 expect(screen.queryByRole('button',{name:/Join Wizards/})).toBeNull();expect(screen.queryByText('Invitation panel')).toBeNull();
 expect(screen.getByText('Platform automated team · Players cannot join or receive invitations.')).toBeTruthy();
 expect(screen.queryByText('An invitation is required to join.')).toBeNull();
});
it('does not show a separate team-page sharing action',()=>{
 mount({ownerId:'ur1',member:'tm1'});
 expect(screen.queryByRole('button',{name:'Share team page'})).toBeNull();
});
it('allows community users to join',()=>{
 mount({member:'tm2',communityMember:true});fireEvent.click(screen.getByRole('button',{name:'Join Wizards'}));expect(base.join).toHaveBeenCalled();
});
it('keeps captain management available when paused but hides play and invitations',()=>{
 mount({ownerId:'ur1',member:'tm1',paused:true});expect(screen.getByRole('link',{name:'Manage team'})).toBeTruthy();expect(screen.queryByRole('link',{name:'Play for your team'})).toBeNull();expect(screen.queryByText('Invitation panel')).toBeNull();
});
