// @vitest-environment jsdom
import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
const mock=vi.hoisted(()=>vi.fn());
vi.mock('../lib/api',()=>({api:{authenticated:mock}}));
import {MemoryRouter} from 'react-router-dom';
import {LiveVerification} from './LiveVerification';
afterEach(()=>{cleanup();mock.mockReset();});
it('loads server approval rather than local demo identity',async()=>{
 mock.mockResolvedValue({id:'kr1',status:'approved',version:3,history:[]});render(<MemoryRouter><LiveVerification userId="ur1"/></MemoryRouter>);
 await screen.findByText('Approved captain');expect(screen.queryByText('Submit for review')).toBeNull();expect(mock.mock.calls[0][0]).toBe('/kol/me');
});
it('requests a server challenge without submitting a user or approval flag',async()=>{
 mock.mockResolvedValue(null);render(<MemoryRouter><LiveVerification userId="ur1"/></MemoryRouter>);
 fireEvent.click(await screen.findByText('Get ownership code'));
 expect(mock.mock.calls.find(call=>call[0]==='/kol/challenge')?.[1]).toEqual({});
});
