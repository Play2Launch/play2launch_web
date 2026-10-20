import {useEffect,useState} from 'react';
import {api} from '../lib/api';
import type {IDOConfig,readIDOFunding} from '../lib/ido';

type Funding = Awaited<ReturnType<typeof readIDOFunding>>;
const money = (cents:bigint) => '$'+(Number(cents)/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
export function IDOCardProgress({slug}:{slug:string}) {
 const [funding,setFunding]=useState<Funding>();
 const [players,setPlayers]=useState<number>();
 const [availability,setAvailability]=useState('Loading funding…');
 useEffect(()=>{
  const ctrl=new AbortController();let pending=false;
  setFunding(undefined);setPlayers(undefined);setAvailability('Loading funding…');
  async function refresh(){
   if(pending||document.visibilityState==='hidden')return;pending=true;
   await Promise.allSettled([
    (async()=>{try{
     const config=await api.request<IDOConfig>(`/campaigns/${encodeURIComponent(slug)}/ido`,undefined,{signal:ctrl.signal});
     if(!config.configured){if(!ctrl.signal.aborted){setFunding(undefined);setAvailability('Subscription coming soon');}return;}
     const {readIDOFunding}=await import('../lib/ido');
     const next=await readIDOFunding(config);
     if(!ctrl.signal.aborted){setFunding(next);setAvailability('');}
    }catch{if(!ctrl.signal.aborted){setFunding(undefined);setAvailability('Funding unavailable');}}})(),
    (async()=>{try{
     const stats=await api.request<{campaign:string;campaign_players:number}>(`/campaigns/${encodeURIComponent(slug)}/participation`,undefined,{signal:ctrl.signal});
     if(stats.campaign!==slug||!Number.isSafeInteger(stats.campaign_players)||stats.campaign_players<0)throw Error('Invalid participation');
     if(!ctrl.signal.aborted)setPlayers(stats.campaign_players);
    }catch{if(!ctrl.signal.aborted)setPlayers(undefined);}})()
   ]);pending=false;
  }
  void refresh();const timer=setInterval(()=>void refresh(),60000);
  return()=>{ctrl.abort();clearInterval(timer);};
 },[slug]);
 const percent=funding&&funding.hard>0n?Number(funding.raised*10000n/funding.hard)/100:0;
 const soft=funding&&funding.hard>0n?Number(funding.soft*10000n/funding.hard)/100:0;
 return <div className="ido-card-progress">
  <div className="card-metrics"><span>Total subscribed</span><strong>{funding?money(funding.raised):'—'}</strong></div>
  <div className="progress-track" role="progressbar" aria-label="Total subscribed" aria-valuemin={0} aria-valuemax={100} aria-valuenow={funding?Math.min(100,percent):undefined} aria-valuetext={funding?`${money(funding.raised)} of ${money(funding.hard)} hard cap`:'Funding unavailable'}>
   <i style={{width:`${Math.min(100,percent)}%`}}/>
   {funding&&<span className="ido-card-soft-marker" style={{left:`${Math.min(100,soft)}%`}} title={`Soft cap ${money(funding.soft)}`}/>}
  </div>
  <div className="ido-card-caps">{funding?<><span>Soft {money(funding.soft)}</span><span>Hard {money(funding.hard)}</span></>:<span>{availability}</span>}</div>
  <div className="card-bottom"><span title="Unique players with a valid completed game; excludes bots">Participants <b>{players?.toLocaleString()??'—'}</b></span><span title="Unique subscribing wallets; additional purchases count once">Subscribers <b>{funding?.subscribers.toLocaleString()??'—'}</b></span></div>
  {funding&&funding.phase!==0&&<div className="ido-card-settlement">{funding.phase===2?'Refunds open':'Successfully settled'}</div>}
 </div>;
}
