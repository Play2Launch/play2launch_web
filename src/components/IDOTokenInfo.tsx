import type {ReactNode} from 'react';
import {formatUnits,ZeroAddress} from 'ethers';
import {tokenQuantity,type IDOConfig,type IDOState} from '../lib/ido';
import {AssetIcon} from './AssetIcon';
export function IDOTokenInfo({config,state,walletControl,paymentBalanceSlot}:{config:IDOConfig;state?:IDOState;walletControl?:ReactNode;paymentBalanceSlot?:ReactNode}){
 const info=config.metadata?.token;
 const bound=state&&state.token!==ZeroAddress;
 const rate=state?BigInt(state.sale.tokenUnitsPerDollar):0n;
 const payment=state?.paymentSymbol||'Payment token';
 const address=bound?state.token:undefined;
 return <section className="ido-asset-info" aria-label="Token and payment details">
  <div className="ido-asset-heading">
   {info?.icon?<img src={info.icon} alt="" className="ido-asset-logo"/>:<span className="ido-asset-placeholder">{(bound?state.tokenSymbol:info?.symbol||'Token').slice(0,2)}</span>}
   <div><span className="eyebrow">YOU RECEIVE</span><h3>{bound?state.tokenSymbol:info?.name||info?.symbol||'Token to be announced'}</h3>{!bound&&<span className="small muted">Token binding pending</span>}</div>
   <div className="ido-asset-wallet">{config.network&&<span className="ido-network-chip"><AssetIcon kind={config.network.icon}/>{config.network.name}</span>}{walletControl}</div>
  </div>
  <div className="ido-asset-facts"><div><span>Pay with</span><strong><AssetIcon kind={state?.paymentIcon||'usdg'} size={20}/>{payment}</strong>{paymentBalanceSlot}</div><div><span>Issue price</span><strong>{rate>0n?`${10n**36n%rate?'≈ ':''}${formatUnits(10n**36n/rate,18)} ${payment}`:'—'}</strong><small>per token</small></div><div><span>Exchange rate</span><strong>{rate>0n?`${tokenQuantity(rate,18)} tokens`:'—'}</strong><small>per 1 {payment}</small></div></div>
  <nav className="ido-asset-links" aria-label="Token links">
   {address&&<a href={`${config.explorer_url}/address/${address}`} target="_blank" rel="noopener noreferrer">Token contract ↗</a>}
   {state?.payment&&<a href={`${config.explorer_url}/address/${state.payment}`} target="_blank" rel="noopener noreferrer">Payment contract ↗</a>}
   {info?.website&&<a href={info.website} target="_blank" rel="noopener noreferrer">Website ↗</a>}
   {info?.x&&<a href={info.x} target="_blank" rel="noopener noreferrer">X ↗</a>}
   {info?.telegram&&<a href={info.telegram} target="_blank" rel="noopener noreferrer">Telegram ↗</a>}
  </nav>
 </section>;
}
