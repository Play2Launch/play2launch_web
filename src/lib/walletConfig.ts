import { playerConfig } from "./playerConfig";
import {mainnet,sepolia,bsc,arbitrum,optimism,base,polygon,avalanche} from 'viem/chains';
// Official network parameters: https://docs.robinhood.com/chain/connecting/
export function walletConfiguration(projectId = playerConfig.walletconnect_project_id || '', network: string = playerConfig.wallet_network || 'mainnet') {
  if (!/^[a-f0-9]{32}$/i.test(projectId.trim())) throw new Error('WalletConnect Project ID is missing or invalid.');
  if (network !== 'mainnet' && network !== 'testnet') throw new Error('Wallet network must be mainnet or testnet.');
  const testnet = network === 'testnet';
  return {
    projectId: projectId.trim(),
    chain: {
      id: testnet ? 46630 : 4663,
      name: testnet ? 'Robinhood Chain Testnet' : 'Robinhood Chain',
      nativeCurrency: {name: 'Ether', symbol: 'ETH', decimals: 18},
      rpcUrls: {default: {http: [testnet ? 'https://rpc.testnet.chain.robinhood.com' : 'https://rpc.mainnet.chain.robinhood.com']}},
      blockExplorers: {default: {name: 'Blockscout', url: testnet ? 'https://explorer.testnet.chain.robinhood.com' : 'https://robinhoodchain.blockscout.com'}},
      testnet,
    },
  };
}

// Shared registry for the wallet picker and Relay source-network allowlist.
export function idoWalletChains() {
 const robinhood=(testnet:boolean)=>({
  id:testnet?46630:4663,name:testnet?'Robinhood Chain Testnet':'Robinhood Chain',
  nativeCurrency:{name:'Ether',symbol:'ETH',decimals:18},
  rpcUrls:{default:{http:[testnet?'https://rpc.testnet.chain.robinhood.com':'https://rpc.mainnet.chain.robinhood.com']}},
  blockExplorers:{default:{name:'Blockscout',url:testnet?'https://explorer.testnet.chain.robinhood.com':'https://robinhoodchain.blockscout.com'}},testnet
 });
 return [mainnet,bsc,arbitrum,optimism,base,polygon,avalanche,robinhood(false),sepolia,robinhood(true)].map(c=>({id:Number(c.id),name:c.name,nativeCurrency:{...c.nativeCurrency},rpcUrls:{default:{http:[...c.rpcUrls.default.http]}},blockExplorers:{default:{name:c.blockExplorers.default.name,url:c.blockExplorers.default.url}},testnet:!!c.testnet}));
}
export const walletChainImages=Object.fromEntries(idoWalletChains().filter(c=>!c.testnet).map(c=>[c.id,`https://assets.relay.link/icons/${c.id}/light.png`]));
export function configuredRelayChains<T extends {id:number;disabled?:boolean;vmType?:string}>(chains:T[]):T[]{
 const ids=new Set(idoWalletChains().filter(c=>!c.testnet).map(c=>Number(c.id)));
 return chains.filter(c=>ids.has(c.id)&&!c.disabled&&c.vmType==='evm');
}
