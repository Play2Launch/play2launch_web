import {beforeEach, expect, it, vi} from 'vitest';
const mocks=vi.hoisted(()=>({authenticated:vi.fn()}));
vi.mock('./api',()=>({api:mocks}));
vi.mock('./ido',()=>({idoPath:(slug:string)=>`/campaigns/${encodeURIComponent(slug)}/ido`}));
import {relayConfigured,relayRequest} from './relay';
beforeEach(()=>{vi.clearAllMocks();mocks.authenticated.mockResolvedValue({status:200,data:{ok:true}});});
it('keeps the existing IDO proxy path by default',async()=>{
  await relayRequest('phood','/chains');
  expect(mocks.authenticated).toHaveBeenCalledWith('/campaigns/phood/ido/relay',expect.objectContaining({path:'/chains'}));
});
it('uses the dedicated airdrop gas proxy for config and quotes',async()=>{
  await relayConfigured('phood','airdrop-gas');
  await relayRequest('phood','/quote/v2','POST',{amount:'100'},undefined,'airdrop-gas');
  expect(mocks.authenticated).toHaveBeenNthCalledWith(1,'/campaigns/phood/airdrop/gas/relay',{path:'/config',method:'GET'});
  expect(mocks.authenticated).toHaveBeenNthCalledWith(2,'/campaigns/phood/airdrop/gas/relay',expect.objectContaining({path:'/quote/v2',body:{amount:'100'}}));
});
