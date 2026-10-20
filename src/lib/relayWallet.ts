import type {Eip1193Provider} from 'ethers';
export function relayErrorMessage(error:unknown):string {
 if(typeof error==='string'&&error.trim())return error;
 if(error&&typeof error==='object'){
  const e=error as {shortMessage?:unknown;message?:unknown;error?:unknown;cause?:unknown};
  for(const value of [e.shortMessage,e.message])if(typeof value==='string'&&value.trim())return value;
  if(e.error&&e.error!==error)return relayErrorMessage(e.error);
 }
 return 'Swap interrupted. Check Relay activity before retrying.';
}
export async function ensureRelaySourceChain(provider:Eip1193Provider,chainId:number,address:string){
 const accounts=await provider.request({method:'eth_accounts'});
 if(accounts[0]?.toLowerCase()!==address.toLowerCase())throw Error('Wallet changed. Reopen the swap.');
 if(BigInt(await provider.request({method:'eth_chainId'}))!==BigInt(chainId)){
  await provider.request({method:'wallet_switchEthereumChain',params:[{chainId:`0x${chainId.toString(16)}`}]});
 }
 // Some wallets emit chainChanged shortly after resolving the switch request.
 for(let attempt=0;attempt<10;attempt++){
  if(BigInt(await provider.request({method:'eth_chainId'}))===BigInt(chainId)){
   const current=await provider.request({method:'eth_accounts'});
   if(current[0]?.toLowerCase()!==address.toLowerCase())throw Error('Wallet changed. Reopen the swap.');
   return;
  }
  await new Promise(resolve=>setTimeout(resolve,250));
 }
 throw Error(`Please switch your wallet to the selected source chain (${chainId}) and retry.`);
}
