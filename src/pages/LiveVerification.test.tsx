// @vitest-environment jsdom
import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,cleanup,waitFor} from '@testing-library/react';
const mock=vi.hoisted(()=>vi.fn());
vi.mock('../lib/api',()=>({api:{authenticated:mock}}));
import {MemoryRouter} from 'react-router-dom';
import {LiveVerification} from './LiveVerification';
afterEach(()=>{cleanup();mock.mockReset();});
const draft={id:'kr1',status:'draft',version:1,expires_at:'2099-01-01T00:00:00Z',name:'Brice',avatar:'',social_url:'https://x.com/bricebian',introduction:'Just for fun! Why it needs to be so long?',proof_url:'https://x.com/bricebian/status/123?s=46&t=abc%2Bdef',history:[]};
it('accepts X share parameters and preserves inputs after a failed submission',async()=>{
 mock.mockImplementation((path:string)=>path==='/kol/me'?Promise.resolve(draft):Promise.reject(new Error('Please check the information you entered.')));
 render(<MemoryRouter><LiveVerification userId="ur1"/></MemoryRouter>);
 const submit=await screen.findByText('Submit for review');
 fireEvent.change(screen.getByLabelText('Captain name'),{target:{value:'Edited name'}});
 fireEvent.click(submit);
 await screen.findByRole('alert');
 expect(mock.mock.calls.find(call=>call[0]==='/kol/apply')?.[1]).toMatchObject({name:'Edited name',proof_url:draft.proof_url});
 expect((screen.getByLabelText('Captain name') as HTMLInputElement).value).toBe('Edited name');
 expect(screen.queryByText('Retry')).toBeNull();
 fireEvent.click(screen.getByText('Submit for review'));
 await waitFor(()=>expect(mock.mock.calls.filter(call=>call[0]==='/kol/apply')).toHaveLength(2));
 expect(mock.mock.calls.filter(call=>call[0]==='/kol/me')).toHaveLength(1);
});
it('identifies invalid profile links without clearing the draft or sending it',async()=>{
 mock.mockResolvedValue(draft);render(<MemoryRouter><LiveVerification userId="ur1"/></MemoryRouter>);
 await screen.findByText('Submit for review');
 fireEvent.change(screen.getByLabelText('Public X / Telegram profile'),{target:{value:'https://example.com/name'}});
 fireEvent.click(screen.getByText('Submit for review'));
 expect((await screen.findByRole('alert')).textContent).toContain('Public profile:');
 expect(mock.mock.calls.some(call=>call[0]==='/kol/apply')).toBe(false);
});
it('still allows retrying an initial load failure',async()=>{
 mock.mockRejectedValueOnce(new Error('Network error')).mockResolvedValue(draft);
 render(<MemoryRouter><LiveVerification userId="ur1"/></MemoryRouter>);
 fireEvent.click(await screen.findByText('Retry'));
 await screen.findByText('Submit for review');
 expect(screen.queryByRole('alert')).toBeNull();
});
it('loads server approval rather than local demo identity',async()=>{
 mock.mockResolvedValue({id:'kr1',status:'approved',version:3,history:[]});render(<MemoryRouter><LiveVerification userId="ur1"/></MemoryRouter>);
 await screen.findByText('Approved captain');expect(screen.queryByText('Submit for review')).toBeNull();expect(mock.mock.calls[0][0]).toBe('/kol/me');
});
it('requests a server challenge without submitting a user or approval flag',async()=>{
 mock.mockResolvedValue(null);render(<MemoryRouter><LiveVerification userId="ur1"/></MemoryRouter>);
 fireEvent.click(await screen.findByText('Get ownership code'));
 expect(mock.mock.calls.find(call=>call[0]==='/kol/challenge')?.[1]).toEqual({});
});
