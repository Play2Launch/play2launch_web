import {useState} from 'react';
import {BrowserProvider,Contract,type Eip1193Provider} from 'ethers';
import {api} from '../lib/api';
import ABI from '../lib/airdropABI.json';
export function AirdropActions({provider,address,data,entry,slug,refresh}:{provider?:Eip1193Provider;address?:string;data:any;entry:any;slug:string;refresh:()=>Promise<void>}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[hash,setHash]=useState('');
 async function claim(){if(busy||!provider||!address)return;setBusy(true);setError('');try{
  const browser=new BrowserProvider(provider);if(Number((await browser.getNetwork()).chainId)!==data.settings.chain_id)throw Error('Switch to the airdrop network first.');
  const signer=await browser.getSigner();const wallet=await signer.getAddress();if(wallet.toLowerCase()!==address.toLowerCase())throw Error('Wallet changed. Please retry.');
  const base=`/campaigns/${encodeURIComponent(slug)}/airdrop`;
  if(entry.wallet&&entry.wallet.toLowerCase()!==wallet.toLowerCase())throw Error('Use the wallet already bound to this allocation.');
  if(!entry.wallet){const challenge=await api.authenticated<{message:string}>(base+'/challenge',{wallet});const signature=await signer.signMessage(challenge.message);await api.authenticated(base+'/bind',{signature});}
  const ticket=await api.authenticated<any>(base+'/credential',{});
  if(ticket.entry.wallet.toLowerCase()!==wallet.toLowerCase()||ticket.entry.claim_id!==entry.claim_id||ticket.entry.amount!==entry.amount)throw Error('Allocation changed. Refresh before claiming.');
  if(Number((await browser.getNetwork()).chainId)!==data.settings.chain_id||(await browser.getSigner()).address.toLowerCase()!==wallet.toLowerCase())throw Error('Wallet or network changed. Retry.');
  const contract=new Contract(data.settings.contract,ABI,signer);
  const tx=await contract.claim(ticket.entry.claim_id,ticket.entry.amount,ticket.expires,ticket.entry.proof,ticket.signature);setHash(tx.hash);
  await tx.wait(data.confirmations||2);await refresh();
 }catch(e){setError(e instanceof Error?e.message:'Claim failed. You can retry.')}finally{setBusy(false)}}
 return <div><p>Wallet binding is permanent for this distribution. Claiming transfers the full allocation once.</p><button className="btn btn-primary" disabled={busy||!provider||!address} onClick={()=>void claim()}>{busy?'Waiting for wallet / chain confirmation…':entry.wallet?'Claim all tokens':'Bind wallet and claim all'}</button>{hash&&<p><a href={`${data.network.explorer_url}/tx/${hash}`} target="_blank" rel="noreferrer">View claim transaction</a></p>}{error&&<p role="alert">{error}</p>}</div>;
}
