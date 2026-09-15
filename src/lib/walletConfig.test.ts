import {expect,it} from 'vitest';
import {walletConfiguration} from './walletConfig';
it('uses official Robinhood mainnet/testnet without mixing chain IDs and RPCs',()=>{
 const pid='a'.repeat(32);
 expect(walletConfiguration(pid,'mainnet').chain).toMatchObject({id:4663,testnet:false,rpcUrls:{default:{http:['https://rpc.mainnet.chain.robinhood.com']}}});
 expect(walletConfiguration(pid,'testnet').chain).toMatchObject({id:46630,testnet:true,rpcUrls:{default:{http:['https://rpc.testnet.chain.robinhood.com']}}});
 expect(()=>walletConfiguration('','mainnet')).toThrow();expect(()=>walletConfiguration(pid,'other')).toThrow();
});
