import {useEffect,useState} from 'react';
import {formatUnits} from 'ethers';
import {api} from '../lib/api';
import {useApp} from '../state';
import {loadWallet,useWalletModule} from '../lib/walletLoader';
import {walletAllowed} from '../lib/walletPolicy';
import {WarningNotice} from './WarningNotice';
import './AirdropPanel.css';
function tokenAmount(value:string,decimals:number){const [whole,fraction]=formatUnits(value,decimals).split('.');const trimmed=fraction?.replace(/0+$/,'');return whole.replace(/\B(?=(\d{3})+(?!\d))/g,',')+(trimmed?'.'+trimmed:'');}
function rewardAmount(value:string,decimals:number){const [whole,fraction='']=formatUnits(value,decimals).split('.');const shortened=tokenAmount(value,decimals).split('.')[0]+(fraction.slice(0,4).replace(/0+$/,'')?'.'+fraction.slice(0,4).replace(/0+$/,''):'');return /[1-9]/.test(fraction.slice(4))?(whole==='0'&&!/[1-9]/.test(fraction.slice(0,4))?'<0.0001':'≈ '+shortened):shortened;}
function claimCountdown(seconds:number){const days=Math.floor(seconds/86400);const hours=Math.floor(seconds%86400/3600);const minutes=Math.floor(seconds%3600/60);return `${days?days+'d ':''}${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;}
export function AirdropPanel({slug}:{slug:string}){
 const app=useApp();return <AirdropView key={`${slug}:${app.user?.id||''}`} slug={slug}/>;
}
function AirdropView({slug}:{slug:string}){
 const app=useApp(),Wallet=useWalletModule()?.AirdropWallet;
 const [data,setData]=useState<any>(),[mine,setMine]=useState<any>(),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [now,setNow]=useState(()=>Date.now());
 useEffect(()=>{setNow(Date.now());if(!data?.chain?.deadline||data.chain.closed)return;const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer)},[data?.chain?.deadline,data?.chain?.closed]);
 const path=`/campaigns/${encodeURIComponent(slug)}/airdrop`;
 async function load(signal?:AbortSignal){const d=await api.request<any>(path,undefined,{signal});const m=d.configured&&app.user?await api.authenticated<any>(path+'/mine',undefined,signal):null;if(!signal?.aborted){setData(d);setMine(m);setError('')}}
 useEffect(()=>{const ctrl=new AbortController();const refresh=()=>void load(ctrl.signal).catch(e=>{if(!ctrl.signal.aborted)setError(e.message)});refresh();const timer=setInterval(refresh,20000);return()=>{ctrl.abort();clearInterval(timer)}},[slug,app.user?.id]);
 if(!data&&!error)return null;
 if(!data?.configured)return error?<WarningNotice title="Airdrop information is temporarily unavailable" urgent><p>Please try again in a moment.</p><button className="btn btn-secondary" onClick={()=>void load().catch(e=>setError(e.message))}>Retry</button></WarningNotice>:<WarningNotice title="Airdrop claims coming soon"><p>Stay tuned! Your claim details will appear here when claims open.</p></WarningNotice>;
 const s=data.settings,c=data.chain,entry=mine?.entry;
 const remaining=Math.max(0,Math.ceil(c.deadline-now/1000));
 const expired=c.deadline>0&&remaining===0;
 const open=c.opened&&!c.closed&&!c.paused&&!expired&&c.root===data.root&&c.allocation===data.allocation;
 const state=c.closed?'Claims closed':mine?.claimed?'Claimed':expired?'Claim period ended':c.paused?'Claims paused':open?'Claims open':'Claims coming soon';
 return <section className="airdrop-panel" aria-label="Campaign airdrop">
  <header className="airdrop-panel-heading"><h3>Airdrop rewards</h3><span className={`airdrop-panel-status${mine?.claimed?' is-claimed':open?' is-open':''}`}>{state}</span></header>
  <div className="airdrop-panel-summary">

   <div className="airdrop-panel-personal">{mine?.claimed&&<div className="airdrop-panel-success" role="status"><span aria-hidden="true">✓</span><div><strong>Rewards claimed</strong><p>Your tokens have been sent to your wallet.</p></div></div>}<span className="airdrop-panel-label">{mine?.claimed?'You received':open?'Your claimable rewards':'Your rewards'}</span>
    {entry?<><strong className="airdrop-panel-amount" title={`${tokenAmount(entry.amount,s.decimals)} ${s.symbol}`} aria-label={`${mine?.claimed?'Claimed':'Your allocation'}: ${tokenAmount(entry.amount,s.decimals)} ${s.symbol}`}>{rewardAmount(entry.amount,s.decimals)} <small>{s.symbol}</small></strong><p>Your final score: {entry.score} / {data.total_score}</p></>:<><strong>{data.locked_at?(app.user?'No allocation':'Sign in to check'):'To be announced'}</strong><p>{data.locked_at?(app.user?'This account has no allocation in this airdrop.':'View your final allocation after signing in.'):'Your final allocation will appear after scores are finalized.'}</p></>}
  {mine?.claimed&&<div className="airdrop-panel-transaction">{mine.transaction&&/^0x[0-9a-fA-F]{64}$/.test(mine.transaction)?<><span>Claim transaction</span><a href={`${data.network.explorer_url}/tx/${mine.transaction}`} target="_blank" rel="noreferrer">{mine.transaction} ↗</a></>:<span>Transaction details are syncing…</span>}</div>}
  <footer className="airdrop-panel-footer">{c.deadline>0&&!c.closed&&!expired&&<div className="airdrop-panel-countdown"><span>Claim ends in</span><strong role="timer" aria-label="Claim countdown">{claimCountdown(remaining)}</strong></div>}
  {!app.user&&data.locked_at?<button className="btn btn-primary" onClick={()=>app.setAuthOpen(true)}>Sign in to view your allocation</button>:entry&&entry.amount!=='0'&&!mine.claimed&&open&&walletAllowed(app.platform.runtime)?Wallet?<Wallet data={data} entry={entry} slug={slug} refresh={()=>load()}/>:<button className="btn btn-primary" disabled={busy} onClick={async()=>{setBusy(true);try{await loadWallet()}catch(e){setError(e instanceof Error?e.message:'Wallet unavailable')}finally{setBusy(false)}}}>{busy?'Loading wallet…':'Connect wallet to claim'}</button>:null}
  </footer>
   </div>
   <div className="airdrop-panel-pool"><span className="airdrop-panel-label">Reward pool</span><strong>{tokenAmount(s.total,s.decimals)} <small>{s.symbol}</small></strong><p>Shared in proportion to each player's final valid score.</p></div>
  </div>
  <p className="airdrop-panel-explanation">{c.closed?'Claims permanently closed; remaining tokens recovered.':data.locked_at?'Scores are locked. You can keep playing for fun without changing scores or allocations.':'Scores are still updating. Airdrop claims will open after scores are finalized.'}</p>
  {entry?.wallet&&<p className="airdrop-panel-wallet">Bound wallet: {entry.wallet}</p>}
  {error&&<WarningNotice title="Unable to refresh airdrop information" urgent><p>Please try again shortly.</p></WarningNotice>}

 </section>;
}
