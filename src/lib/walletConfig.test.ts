import {expect,it} from 'vitest';
import {walletConfiguration} from './walletConfig';
it('uses official Robinhood mainnet/testnet without mixing chain IDs and RPCs',()=>{
 const pid='a'.repeat(32);
 expect(walletConfiguration(pid,'mainnet').chain).toMatchObject({id:4663,testnet:false,rpcUrls:{default:{http:['https://rpc.mainnet.chain.robinhood.com']}}});
 expect(walletConfiguration(pid,'testnet').chain).toMatchObject({id:46630,testnet:true,rpcUrls:{default:{http:['https://rpc.testnet.chain.robinhood.com']}}});
 expect(()=>walletConfiguration('','mainnet')).toThrow();expect(()=>walletConfiguration(pid,'other')).toThrow();
});

it('shares mainnet allowlist with Relay and excludes unknown, disabled and test networks',async()=>{
 const {idoWalletChains,configuredRelayChains}=await import('./walletConfig');
 expect(idoWalletChains().find(c=>c.id===56)?.nativeCurrency.symbol).toBe('BNB');
 expect(idoWalletChains().find(c=>c.id===43114)?.nativeCurrency.symbol).toBe('AVAX');
 expect(idoWalletChains().filter(c=>[59144,534352,324,130,57073,5000].includes(c.id))).toHaveLength(6);
 const chains=[1,56,42161,10,8453,137,43114,4663,46630,11155111,999999].map(id=>({id,vmType:'evm'}));
 expect(configuredRelayChains(chains).map(c=>c.id)).toEqual([1,56,42161,10,8453,137,43114,4663]);
 expect(configuredRelayChains([{id:56,vmType:'evm',disabled:true},{id:1,vmType:'svm'}])).toEqual([]);
});
