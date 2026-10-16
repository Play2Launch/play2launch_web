// @vitest-environment jsdom
import {render,screen,cleanup} from '@testing-library/react';
import {MemoryRouter,Routes,Route,Link} from 'react-router-dom';
import {afterEach,it,expect,vi} from 'vitest';
const mock=vi.hoisted(()=>({user:{mode:'live',nicknameSet:false} as {mode:string;nicknameSet:boolean}|null}));
vi.mock('../state',()=>({useApp:()=>({user:mock.user})}));
import {NicknameGate} from './NicknameGate';
afterEach(cleanup);
it('redirects deep links without mounting game effects',async()=>{
 const game=vi.fn();function Game(){game();return <p>Game</p>}
 mock.user={mode:'live',nicknameSet:false};
 render(<MemoryRouter initialEntries={['/play']}><NicknameGate><Routes><Route path="/play" element={<Game/>}/><Route path="/profile" element={<p>Profile required</p>}/></Routes></NicknameGate></MemoryRouter>);
 expect(await screen.findByText('Profile required')).toBeTruthy();expect(game).not.toHaveBeenCalled();
});
it('allows saved nicknames and guests through',()=>{
 for(const user of [{mode:'live',nicknameSet:true},null]){
 mock.user=user;render(<MemoryRouter><NicknameGate><Link to="/play">Play</Link></NicknameGate></MemoryRouter>);expect(screen.getByText('Play')).toBeTruthy();cleanup();
 }
});
