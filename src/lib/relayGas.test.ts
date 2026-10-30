import {expect, it} from 'vitest';
import type {Execute} from '@relayprotocol/relay-sdk';
import {assertGasQuote, gasSourceChains, nativeETH} from './relayGas';
const wallet = '0x' + '1'.repeat(40);
function quote() {
  return {details:{recipient:wallet,currencyIn:{currency:{chainId:1,address:nativeETH,decimals:18},amount:'100'},currencyOut:{currency:{chainId:4663,address:nativeETH,decimals:18},amount:'90'}},steps:[{kind:'transaction',items:[{data:{chainId:1,from:wallet,to:'0x'+'2'.repeat(40),value:'100'}}]}]} as unknown as Execute;
}
it('lists supported mainnets including BNB and excludes testnets and the destination', () => {
  const chain = (id:number,symbol='ETH')=>({id,currency:{symbol,decimals:18}});
  expect(gasSourceChains([chain(1),chain(10),chain(8453),chain(42161),chain(4663),chain(56,'BNB'),chain(137,'POL'),chain(59144),chain(534352),chain(324),chain(11155111)]) .map(c=>c.id)).toEqual([1,10,8453,42161,56,137,59144,534352,324]);
});
it('accepts native ETH to the same wallet on Robinhood mainnet',()=>expect(()=>assertGasQuote(quote(),1,wallet,100n,nativeETH,18)).not.toThrow());
it('rejects token substitution, alternate destinations, recipients and unexpected amounts',()=>{
  const changes=[
    (q:any)=>{q.details.currencyIn.currency.address='0x'+'a'.repeat(40);},
    (q:any)=>{q.details.currencyOut.currency.address='0x'+'a'.repeat(40);},
    (q:any)=>{q.details.currencyOut.currency.chainId=46630;},
    (q:any)=>{q.details.recipient='0x'+'a'.repeat(40);},
    (q:any)=>{q.details.currencyIn.amount='101';},
    (q:any)=>{q.details.currencyOut.currency.decimals=6;},
    (q:any)=>{q.details.currencyOut.amount='0';},
    (q:any)=>{q.steps[0].kind='signature';},
    (q:any)=>{q.steps[0].items[0].data.chainId=4663;},
    (q:any)=>{q.steps[0].items[0].data.from='0x'+'a'.repeat(40);},
  ];
  for(const change of changes){const q=quote();change(q);expect(()=>assertGasQuote(q,1,wallet,100n,nativeETH,18)).toThrow();}
});
it('accepts selected ERC20 input precision and approval steps while keeping output native ETH',()=>{
  const token='0x'+'a'.repeat(40),q=quote();
  Object.assign(q.details!.currencyIn!.currency!,{address:token,decimals:6});
  q.steps[0].items.push({...q.steps[0].items[0],data:{chainId:1,from:wallet,to:token,value:'0',data:'0x095ea7b3'}});
  expect(()=>assertGasQuote(q,1,wallet,100n,token,6)).not.toThrow();
  expect(()=>assertGasQuote(q,1,wallet,100n,token,18)).toThrow();
});
