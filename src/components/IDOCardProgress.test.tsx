// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,render,screen} from '@testing-library/react';
const mocks=vi.hoisted(()=>({request:vi.fn(),read:vi.fn()}));
vi.mock('../lib/api',()=>({api:{request:mocks.request}}));
vi.mock('../lib/ido',()=>({readIDOFunding:mocks.read}));
import {IDOCardProgress} from './IDOCardProgress';
afterEach(()=>{cleanup();vi.clearAllMocks();});
it('shows funding and distinct campaign players, never global participation or unlock points',async()=>{
 mocks.request.mockImplementation(async(path:string)=>path.endsWith('/participation')?{campaign:'combo',players:99,campaign_players:2}:{configured:true});
 mocks.read.mockResolvedValue({raised:110001n,soft:10000n,hard:200000n,subscribers:1n,phase:0});
 render(<IDOCardProgress slug="combo"/>);
 expect(await screen.findByText('$1,100.01')).toBeTruthy();
 expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('55');
 expect(screen.getByText('Participants').textContent).toBe('Participants 2');
 expect(screen.getByText('Subscribers').textContent).toBe('Subscribers 1');
 expect(screen.queryByText(/unlock points|Launch score|99/)).toBeNull();
});
it('does not present unavailable funding as zero or hide real zero participation',async()=>{
 mocks.request.mockImplementation(async(path:string)=>path.endsWith('/participation')?{campaign:'combo',campaign_players:0}:{configured:true});
 mocks.read.mockRejectedValue(new Error('RPC unavailable'));
 render(<IDOCardProgress slug="combo"/>);
 expect(await screen.findByText('Funding unavailable')).toBeTruthy();
 expect(screen.getByText('Participants').textContent).toBe('Participants 0');
 expect(screen.queryByText('$0.00')).toBeNull();
});
