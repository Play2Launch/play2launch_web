import {Clock3, Gift, Coins} from 'lucide-react';
import {durationLabel, type IDOState} from '../lib/ido';

const date=(seconds:number)=>new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:'UTC'}).format(new Date(seconds*1000))+' UTC';
export function IDOVestingGuide({state}:{state?:IDOState}){
 if(!state || state.phase===2)return null;
 const v=state.vesting,split=!!state.splitVesting,start=Number(v.start);
 const configured=start>0&&Number(v.duration)>0&&Number(v.interval)>0&&(!split||(Number(v.rebateDuration)>0&&Number(v.rebateInterval)>0));
 const plans=[{name:split?'Base tokens':'Purchased tokens',icon:<Coins size={20}/>,formula:split?'(Subscription − final rebate) ÷ issue price':'Subscription ÷ issue price',initial:Number(v.initialBps)/100,cliff:Number(v.cliff),duration:Number(v.duration),interval:Number(v.interval)},...(split?[{name:'Rebate-backed tokens',icon:<Gift size={20}/>,formula:'Final rebate ÷ issue price',initial:0,cliff:Number(v.rebateCliff),duration:Number(v.rebateDuration),interval:Number(v.rebateInterval)}]:[])];
 return <section className="ido-explainer ido-vesting-guide" aria-label="Token release guide">
  <div className="ido-section-title"><span className="eyebrow">YOUR TOKEN TIMELINE</span><h2>How your tokens unlock</h2></div>
  <p>{split?'Your purchased tokens follow two release schedules. Your total token allocation stays the same.':'Your purchased tokens follow one release schedule.'}</p>
  {!configured?<p className="notice">The token release schedule has not been configured yet. Dates and percentages will appear here once available.</p>:<>
   <div className="ido-guide-tge"><Clock3 size={18}/><span><strong>TGE · {date(start)}</strong><small>TGE is the token release start. Claims require successful IDO settlement.</small></span></div>
   <div className="ido-guide-plans">{plans.map(p=>{const end=p.initial===100?start:start+p.cliff+p.duration;return <article key={p.name} className="ido-guide-plan" aria-label={`${p.name} rules`}>
    <h3>{p.icon}{p.name}</h3><p className="small muted">{p.formula}</p>
    <ol className="ido-guide-timeline">
     <li><span>AT TGE</span><strong>{p.initial}% unlocked</strong></li>
     {p.initial<100&&<><li><span>{p.cliff>0?'LOCKUP':'RELEASE START'}</span><strong>{p.cliff>0?durationLabel(p.cliff):'No lockup'}</strong><small>{p.cliff>0?date(start+p.cliff):'Linear release starts at TGE'}</small></li>
     <li><span>THEN</span><strong>{100-p.initial}% over {durationLabel(p.duration)}</strong><small>{p.interval===1?'Linear release, calculated every second':`Released every ${durationLabel(p.interval)}, with any remainder at the end`}</small></li></>}
    </ol>
    <div className="ido-guide-end"><small>FULLY UNLOCKED</small><strong>{date(end)}</strong>{end>start&&<small>{durationLabel(end-start)} after TGE</small>}</div>
   </article>})}</div>
   <p className="small muted">{state.phase===1&&state.now>=start?'The release schedules are locked.':'These are the current on-chain settings. They can change before successful vesting starts.'}</p>
  </>}
  <details className="ido-rules"><summary>Token release &amp; rebate rules</summary><ul>
   {split&&<><li>The final rebate amount determines the split at settlement. It is not an extra token reward.</li><li>Rebate-backed tokens unlock only after their lockup; the lockup does not earn a catch-up release.</li></>}
   <li>Claim your payment-token rebate separately after successful settlement. Claiming it does not change your token allocation or release schedule.</li>
   <li>{split?'One Claim tokens action collects the available tokens from both schedules.':'Claim tokens collects your currently available tokens.'} Previously claimed tokens cannot be claimed again.</li>
   <li>Unlocked tokens remain available until you claim them. A day means 24 hours; the schedule uses fixed durations, not calendar months.</li>
  </ul></details>
 </section>;
}
