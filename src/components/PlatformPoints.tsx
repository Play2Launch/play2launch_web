import { useEffect, useState } from 'react';
import { api } from '../lib/api';

type Entry={id:string;kind:string;amount:number;period:string;created_at:string};
type Page={balance:number;items:Entry[];next_cursor:string;policy:{first:number;daily:number;daily_three:number;weekly_five:number;min_elapsed_ms:number}};
const labels:Record<string,string>={first_game:'First qualifying game',daily_game:'Daily play',daily_three:'Three games in a day',weekly_five:'Five active days this week',adjustment:'Points adjustment',reversal:'Points correction'};
export function PlatformPoints(){
 const [page,setPage]=useState<Page>(),[error,setError]=useState(''),[retry,setRetry]=useState(0),[after,setAfter]=useState(''),[busy,setBusy]=useState(true),[expanded,setExpanded]=useState(false);
 useEffect(()=>{
  const ctrl=new AbortController();setBusy(true);setError('');
  api.authenticated<Page>('/points/me'+(after?'?after='+encodeURIComponent(after):''),undefined,ctrl.signal).then(p=>{
   if(!p||!Number.isSafeInteger(p.balance)||!Array.isArray(p.items)||!p.policy||!Number.isFinite(p.policy.min_elapsed_ms))throw new Error('Invalid points response. Please refresh.');
   if(!ctrl.signal.aborted)setPage(old=>({...p,items:after?[...(old?.items||[]),...p.items.filter(e=>!old?.items.some(o=>o.id===e.id))]:p.items}));
  }).catch(e=>{if(!ctrl.signal.aborted)setError(e instanceof Error?e.message:'Could not load points.')}).finally(()=>{if(!ctrl.signal.aborted)setBusy(false)});
  return()=>ctrl.abort();
 },[after,retry]);
 return <section className="platform-points" aria-label="P2L platform points">
  <div className="section-heading"><h2>P2L Points</h2><button className="button secondary" disabled={busy} onClick={()=>{setAfter('');setRetry(v=>v+1)}}>Refresh</button></div>
  <strong className="platform-points-balance">{page?page.balance.toLocaleString():busy?'Loading…':'—'}</strong>
  <p>Platform participation points — separate from game scores. No guaranteed token allocation or redemption.</p>
  {error&&<p role="alert">{error}</p>}
  {page&&<>
   <p>First qualifying game +{page.policy.first} · Daily play +{page.policy.daily}<br/>Three games in a day +{page.policy.daily_three} extra · Five active days in a week +{page.policy.weekly_five}</p>
   <small>Accepted ranked games with a positive score and at least {page.policy.min_elapsed_ms/1000}s played qualify. UTC days; weeks start Monday. Trial games do not count. Referral and team bonuses are not enabled.</small>
   <button className="button secondary" aria-expanded={expanded} onClick={()=>setExpanded(v=>!v)}>{expanded?'Hide history':'Points history'}</button>
   {expanded&&<><ul className="platform-points-history">{page.items.map(e=><li key={e.id}><div>{labels[e.kind]||'Participation reward'}<small>{e.period==='once'?'One-time reward':e.period} · {new Date(e.created_at).toLocaleString()}</small></div><b>{e.amount>0?'+':''}{e.amount}</b></li>)}</ul>{!page.items.length&&<p>Complete your first qualifying game to earn points.</p>}{page.next_cursor&&<button className="button secondary" disabled={busy} onClick={()=>setAfter(page.next_cursor)}>Load more</button>}</>}
  </>}
 </section>;
}
