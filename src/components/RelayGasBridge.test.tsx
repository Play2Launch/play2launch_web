// @vitest-environment jsdom
import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
const mocks=vi.hoisted(()=>({configured:vi.fn(),request:vi.fn(),balance:vi.fn(),execute:vi.fn(),switchChain:vi.fn()}));
vi.mock('../lib/relay',()=>({relayConfigured:mocks.configured,relayRequest:mocks.request}));
vi.mock('../lib/relayBalance',()=>({checkSwapBalance:mocks.balance}));
vi.mock('../lib/relayWallet',async original=>({...await original<typeof import('../lib/relayWallet')>(),ensureRelaySourceChain:mocks.switchChain}));
vi.mock('@relayprotocol/relay-sdk',async original=>({...await original<typeof import('@relayprotocol/relay-sdk')>(),createClient:()=>({utils:{axios:{defaults:{adapter:undefined}}}}),execute:mocks.execute}));
import RelayPaymentSwap from './RelayPaymentSwap';
import {nativeETH} from '../lib/relayGas';
const wallet='0x'+'1'.repeat(40);
const chain=(id:number,name:string,symbol='ETH')=>({id,name,displayName:name,vmType:'evm',httpRpcUrl:'https://example.com',explorerUrl:'https://example.com',currency:{name:'Ether',symbol,decimals:18}});
const chains=[chain(1,'Ethereum'),chain(8453,'Base'),chain(56,'BNB Chain','BNB'),chain(4663,'Robinhood Chain')];
const tx={chainId:1,from:wallet,to:'0x'+'2'.repeat(40),value:'1000000000000000',data:'0x1234'};
function quote(){return {details:{recipient:wallet,currencyIn:{currency:{chainId:1,address:nativeETH,decimals:18},amount:tx.value},currencyOut:{currency:{chainId:4663,address:nativeETH,decimals:18},amount:'900000000000000',amountFormatted:'0.0009',minimumAmount:'890000000000000'}},steps:[{kind:'transaction',items:[{data:{...tx},status:'incomplete'}]}],fees:{}};}
function props(){return {purpose:'airdrop-gas' as const,slug:'phood',config:{configured:true,chain_id:4663,contract:'0x'+'3'.repeat(40),rpc_url:'https://example.com',explorer_url:'https://example.com'},address:wallet,provider:{request:vi.fn(async({method}:{method:string})=>method==='eth_accounts'?[wallet]:method==='eth_chainId'?'0x1':'0xtx')},payment:nativeETH,symbol:'ETH',onClose:vi.fn(),onComplete:vi.fn()};}
beforeEach(()=>{
  vi.clearAllMocks();
  mocks.configured.mockResolvedValue({configured:true,testnet:false});
  mocks.request.mockImplementation(async(_:string,path:string)=>path==='/chains'?{chains}:quote());
  mocks.balance.mockResolvedValue('0.01 ETH');
  mocks.switchChain.mockResolvedValue(undefined);
  mocks.execute.mockResolvedValue({data:{steps:[{items:[{status:'complete'}]}]}});
});
afterEach(cleanup);

it('locks both assets to native ETH and only lists supported source networks',async()=>{
  render(<RelayPaymentSwap {...props()}/>);
  await screen.findByRole('button',{name:'Review quote'});
  expect(screen.getByRole('heading',{name:'Bridge ETH for gas'})).toBeTruthy();
  expect(screen.queryByRole('button',{name:'Pay with'})).toBeNull();
  expect(mocks.configured).toHaveBeenCalledWith('phood','airdrop-gas');
  expect(mocks.request.mock.calls.some(call=>call[1]==='/currencies/v2')).toBe(false);
  fireEvent.click(screen.getByRole('button',{name:'From chain'}));
  expect(screen.getByRole('button',{name:'Base'})).toBeTruthy();
  expect(screen.queryByRole('button',{name:'BNB Chain'})).toBeNull();
  expect(screen.queryByRole('button',{name:'Robinhood Chain'})).toBeNull();
});

it('reviews an ETH quote, executes only after confirmation, and returns to Robinhood without claiming',async()=>{
  const p=props();
  render(<RelayPaymentSwap {...p}/>);
  await screen.findByRole('button',{name:'Review quote'});
  fireEvent.change(screen.getByRole('textbox',{name:'Amount'}),{target:{value:'0.001'}});
  fireEvent.click(screen.getByRole('button',{name:'Review quote'}));
  await screen.findByRole('button',{name:'Confirm ETH bridge'});
  expect(mocks.execute).not.toHaveBeenCalled();
  expect(mocks.request).toHaveBeenCalledWith('phood','/quote/v2','POST',expect.objectContaining({user:wallet,originChainId:1,originCurrency:nativeETH,amount:tx.value}),undefined,'airdrop-gas');
  mocks.execute.mockImplementationOnce(async({wallet:client}:any)=>{
    await client.request({method:'eth_sendTransaction',params:[{...tx,chainId:'0x1',value:'0x38d7ea4c68000'}]});
    return {data:{steps:[{items:[{status:'complete'}]}]}};
  });
  fireEvent.click(screen.getByRole('button',{name:'Confirm ETH bridge'}));
  const back=await screen.findByRole('button',{name:'Return to Robinhood Chain'});
  expect(p.provider.request).toHaveBeenCalledWith(expect.objectContaining({method:'eth_sendTransaction'}));
  expect(p.onComplete).toHaveBeenCalledTimes(1);
  expect(mocks.switchChain).toHaveBeenCalledWith(p.provider,1,wallet);
  fireEvent.click(back);
  await waitFor(()=>expect(p.onClose).toHaveBeenCalledOnce());
  expect(mocks.switchChain).toHaveBeenLastCalledWith(p.provider,4663,wallet);
});

it('rejects a quote delivering a token instead of native ETH',async()=>{
  mocks.request.mockImplementation(async(_:string,path:string)=>{
    if(path==='/chains')return {chains};
    const q=quote();q.details.currencyOut.currency.address='0x'+'a'.repeat(40);return q;
  });
  render(<RelayPaymentSwap {...props()}/>);
  await screen.findByRole('button',{name:'Review quote'});
  fireEvent.change(screen.getByRole('textbox',{name:'Amount'}),{target:{value:'0.001'}});
  fireEvent.click(screen.getByRole('button',{name:'Review quote'}));
  expect((await screen.findByRole('alert')).textContent).toContain('Only native ETH');
  expect(screen.queryByRole('button',{name:'Confirm ETH bridge'})).toBeNull();
  expect(mocks.execute).not.toHaveBeenCalled();
});

it('stops a wallet transaction whose recipient differs from the reviewed route',async()=>{
  const p=props();
  mocks.execute.mockImplementationOnce(async({wallet:client}:any)=>{
    await client.request({method:'eth_sendTransaction',params:[{...tx,to:'0x'+'a'.repeat(40)}]});
    throw new Error('Unexpected submission');
  });
  render(<RelayPaymentSwap {...p}/>);
  await screen.findByRole('button',{name:'Review quote'});
  fireEvent.change(screen.getByRole('textbox',{name:'Amount'}),{target:{value:'0.001'}});
  fireEvent.click(screen.getByRole('button',{name:'Review quote'}));
  fireEvent.click(await screen.findByRole('button',{name:'Confirm ETH bridge'}));
  expect((await screen.findByRole('alert')).textContent).toContain('differs from the reviewed quote');
  expect(p.provider.request.mock.calls.some(([args])=>args.method==='eth_sendTransaction')).toBe(false);
  expect(p.onComplete).not.toHaveBeenCalled();
});
