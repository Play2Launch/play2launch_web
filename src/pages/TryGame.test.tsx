// @vitest-environment jsdom
import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,cleanup,waitFor,act} from '@testing-library/react';
import {MemoryRouter,Route,Routes} from 'react-router-dom';
const mocks=vi.hoisted(()=>({request:vi.fn(),authenticated:vi.fn()}));
vi.mock('../lib/api',()=>({api:mocks}));
import {TryGame} from './TryGame';
afterEach(()=>{cleanup();vi.clearAllMocks();});
function mount(){render(<MemoryRouter initialEntries={['/campaign/phood/try']}><Routes><Route path="/campaign/:id/try" element={<TryGame/>}/></Routes></MemoryRouter>);}
it('embeds a guest trial and never creates or submits a server session',async()=>{
 mocks.request.mockResolvedValue({game_id:'gx1',entry_url:'https://game.test/?mode=platform&seed=42'});
 mount();const frame=await screen.findByTitle('Game trial') as HTMLIFrameElement;
 const url=new URL(frame.src);expect(url.searchParams.get('mode')).toBe('demo');expect(url.searchParams.get('embed')).toBe('1');expect(url.searchParams.has('seed')).toBe(false);
 expect(screen.getByText(/Trial scores stay local/)).toBeTruthy();
 await act(async()=>window.dispatchEvent(new MessageEvent('message',{source:frame.contentWindow,origin:'https://game.test',data:{type:'p2l:finish',report:{score:9000}}})));
 expect(mocks.authenticated).not.toHaveBeenCalled();expect(mocks.request).toHaveBeenCalledTimes(1);
 expect(screen.getByText('Play for your team').getAttribute('href')).toBe('/campaign/phood/compete');
});
it('does not embed missing or unpublished games',async()=>{
 mocks.request.mockRejectedValue(new Error('Campaign unavailable'));
 mount();await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('Campaign unavailable'));
 expect(screen.queryByTitle('Game trial')).toBeNull();expect(mocks.authenticated).not.toHaveBeenCalled();
});
