// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,render,screen,fireEvent} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
vi.mock('./TeamInvite',()=>({TeamInvite:()=> <div>Invitation panel</div>}));
import {TeamActions} from './TeamActions';
afterEach(cleanup);
const base={slug:'phood',team:'tm1',name:'Wizards',userId:'ur1',ownerId:'ur2',communityMember:false,paused:false,closed:false,canJoin:true,busy:false,join:vi.fn()};
function mount(props:Partial<typeof base>&{member?:string}={}){render(<MemoryRouter><TeamActions {...base} {...props}/></MemoryRouter>);}
it('gives captains management and lazy invitation controls',()=>{
 mount({ownerId:'ur1',member:'tm1'});
 expect(screen.getByRole('link',{name:'Manage team'}).getAttribute('href')).toBe('/captain?campaign=phood');
 expect(screen.queryByText('Invitation panel')).toBeNull();fireEvent.click(screen.getByRole('button',{name:'Invite players'}));expect(screen.getByText('Invitation panel')).toBeTruthy();
});
it('gives members play and invitations without management',()=>{
 mount({member:'tm1'});expect(screen.getByRole('link',{name:'Play for your team'}).getAttribute('href')).toBe('/campaign/phood/compete');expect(screen.queryByRole('link',{name:'Manage team'})).toBeNull();expect(screen.getByRole('button',{name:'Invite friends'})).toBeTruthy();
});
it('hides join for users in another team',()=>{
 mount({member:'tm2'});expect(screen.queryByRole('button',{name:/Join/})).toBeNull();expect(screen.getByRole('button',{name:'Share team'})).toBeTruthy();
});
it('allows community users to join',()=>{
 mount({member:'tm2',communityMember:true});fireEvent.click(screen.getByRole('button',{name:'Join Wizards'}));expect(base.join).toHaveBeenCalled();
});
it('keeps captain management available when paused but hides play and invitations',()=>{
 mount({ownerId:'ur1',member:'tm1',paused:true});expect(screen.getByRole('link',{name:'Manage team'})).toBeTruthy();expect(screen.queryByRole('link',{name:'Play for your team'})).toBeNull();expect(screen.queryByRole('button',{name:'Invite players'})).toBeNull();
});
