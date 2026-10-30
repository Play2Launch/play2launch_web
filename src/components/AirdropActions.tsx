import {lazy,Suspense,useState} from 'react';
import {BrowserProvider,Contract,formatEther,isError,type Eip1193Provider} from 'ethers';
import {api} from '../lib/api';
import {claimGasAmount,useClaimGasBalance} from '../lib/useClaimGasBalance';
import ABI from '../lib/airdropABI.json';
import {nativeETH} from '../lib/relayGas';
const RelayPaymentSwap=lazy(()=>import('./RelayPaymentSwap'));
export function AirdropActions({provider,address,data,entry,slug,refresh}:{provider?:Eip1193Provider;address?:string;data:any;entry:any;slug:string;refresh:()=>Promise<void>}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[hash,setHash]=useState('');
 const [gasBridge,setGasBridge]=useState<{provider:Eip1193Provider;address:string}>();
 const bridgeOpen=!!gasBridge&&gasBridge.provider===provider&&gasBridge.address===address;
 const gas=useClaimGasBalance(provider,address,data.settings.chain_id);
 const noGas=gas.state.status==='ready'&&gas.state.balance===0n;
 const gasBlocked=noGas||gas.state.status==='loading'||gas.state.status==='wrong-network';
 const networkName=data.network.name||'the airdrop network';
 async function claim(){if(busy||bridgeOpen||!provider||!address||gasBlocked)return;setBusy(true);setError('');try{
  const browser=new BrowserProvider(provider);if(Number((await browser.getNetwork()).chainId)!==data.settings.chain_id)throw Error('Switch to the airdrop network first.');
  const signer=await browser.getSigner();const wallet=await signer.getAddress();if(wallet.toLowerCase()!==address.toLowerCase())throw Error('Wallet changed. Please retry.');
  if(await browser.getBalance(wallet,'latest')===0n)throw Error(`You need ETH on ${networkName} to pay the claim gas fee. Add ETH to this wallet and retry.`);
  const base=`/campaigns/${encodeURIComponent(slug)}/airdrop`;
  if(entry.wallet&&entry.wallet.toLowerCase()!==wallet.toLowerCase())throw Error('Use the wallet already bound to this allocation.');
  if(!entry.wallet){const challenge=await api.authenticated<{message:string}>(base+'/challenge',{wallet});const signature=await signer.signMessage(challenge.message);await api.authenticated(base+'/bind',{signature});}
  const ticket=await api.authenticated<any>(base+'/credential',{});
  if(ticket.entry.wallet.toLowerCase()!==wallet.toLowerCase()||ticket.entry.claim_id!==entry.claim_id||ticket.entry.amount!==entry.amount)throw Error('Allocation changed. Refresh before claiming.');
  if(Number((await browser.getNetwork()).chainId)!==data.settings.chain_id||(await browser.getSigner()).address.toLowerCase()!==wallet.toLowerCase())throw Error('Wallet or network changed. Retry.');
  const contract=new Contract(data.settings.contract,ABI,signer);
  const tx=await contract.claim(ticket.entry.claim_id,ticket.entry.amount,ticket.expires,ticket.entry.proof,ticket.signature);setHash(tx.hash);
  await tx.wait(data.confirmations||2);await refresh();
 }catch(e){setError(isError(e,'INSUFFICIENT_FUNDS')?`Not enough ETH on ${networkName} for the gas fee. Add ETH to this wallet and retry.`:e instanceof Error?e.message:'Claim failed. You can retry.')}finally{setBusy(false);gas.refresh()}}
 return <div className="airdrop-actions"><p>Wallet binding is permanent for this distribution. Claiming transfers the full allocation once.</p>
 {provider&&address&&<div className="airdrop-gas" aria-label="Claim gas balance">
  <div className="airdrop-gas-heading"><span>Gas balance · {networkName}</span><button type="button" className="btn btn-secondary" disabled={busy||gas.state.status==='loading'} onClick={gas.refresh}>Refresh balance</button></div>
  <p aria-live="polite">{gas.state.status==='ready'?<strong title={`${formatEther(gas.state.balance)} ETH`}>{claimGasAmount(gas.state.balance)} ETH</strong>:gas.state.status==='wrong-network'?`Switch to ${networkName} to check your ETH balance.`:gas.state.status==='error'?'Unable to load ETH balance. Refresh to try again.':'Checking ETH balance…'}</p>
  {noGas?<p className="airdrop-gas-warning" role="alert">You need ETH on {networkName} to pay the claim gas fee. Add ETH to this wallet, then refresh the balance.</p>:<p>Claiming requires ETH for gas on this network. The wallet will show the actual fee before you confirm.</p>}
  {data.settings.chain_id===4663&&<button type="button" className="btn btn-secondary" disabled={busy||bridgeOpen} onClick={()=>setGasBridge({provider,address})}>Add ETH via Relay</button>}
 </div>}
 <button className="btn btn-primary" disabled={busy||bridgeOpen||!provider||!address||gasBlocked} onClick={()=>void claim()}>{busy?'Waiting for wallet / chain confirmation…':entry.wallet?'Claim all tokens':'Bind wallet and claim all'}</button>{hash&&<p><a href={`${data.network.explorer_url}/tx/${hash}`} target="_blank" rel="noreferrer">View claim transaction</a></p>}{error&&<p className="airdrop-action-error" role="alert">{error}</p>}
 {bridgeOpen&&provider&&address&&<Suspense fallback={<p role="status">Loading ETH bridge…</p>}><RelayPaymentSwap key={`${address}:${slug}`} purpose="airdrop-gas" slug={slug} config={{configured:true,chain_id:4663,contract:data.settings.contract,rpc_url:data.network.rpc_url,explorer_url:data.network.explorer_url,network:{...data.network,payments:[]}}} address={address} provider={provider} payment={nativeETH} symbol="ETH" paymentIcon="ethereum" onClose={()=>{setGasBridge(undefined);gas.refresh()}} onComplete={gas.refresh}/></Suspense>}
 </div>;
}
