// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,render,screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import Verification from './Verification';
const state=vi.hoisted(()=>({live:true,user:{id:'ur1',name:'Player'} as {id:string;name:string}|null}));
vi.mock('../lib/api',()=>({get liveAuth(){return state.live}}));
vi.mock('../state',()=>({useApp:()=>({user:state.user,kolRequest:null,kolPermissions:{canCreateTeam:true},setAuthOpen:vi.fn()})}));
vi.mock('./LiveVerification',()=>({LiveVerification:()=> <div>Server verification form</div>}));
afterEach(()=>{cleanup();state.live=true;state.user={id:'ur1',name:'Player'}});
it('does not show demo claims or local eligibility in the live verification page',()=>{
 render(<MemoryRouter><Verification/></MemoryRouter>);
 expect(screen.getByText('KOL VERIFICATION')).toBeTruthy();
 expect(screen.getByText('Server verification form')).toBeTruthy();
 expect(screen.queryByText(/demo/i)).toBeNull();
 expect(screen.queryByText(/Eligible to create/)).toBeNull();
});
it('shows production labeling to signed-out visitors too',()=>{
 state.user=null;render(<MemoryRouter><Verification/></MemoryRouter>);
 expect(screen.getByText('KOL VERIFICATION')).toBeTruthy();expect(screen.queryByText(/demo/i)).toBeNull();
});
it('keeps simulation clearly labeled in demo mode',()=>{
 state.live=false;state.user=null;render(<MemoryRouter><Verification/></MemoryRouter>);
 expect(screen.getByText('LOCAL APPLICATION · DEMO')).toBeTruthy();
});
