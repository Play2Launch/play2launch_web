import {dollars,rebateCents,type IDOState} from '../lib/ido';
export function IDOPersonalProgress({state,score,active}:{state:IDOState;score?:number;active:boolean}) {
 const paid=BigInt(state.account.paidCents);
 const scoreLimit=score===undefined?undefined:rebateCents(score,100000n);
 const usable=state.phase===0?(score===undefined?undefined:rebateCents(score,paid)):BigInt(state.account.rebateCents);
 const missing=scoreLimit===undefined?0n:scoreLimit*5n>paid?scoreLimit*5n-paid:0n;
 const additional=paid===0n&&missing>0n&&missing<10000n?10000n:missing;
 const room=BigInt(state.sale.hardCapCents)-state.raised;
 const percent=(value:bigint,max:bigint)=>Math.max(0,Math.min(100,Number(value)*100/Number(max)));
 return <div className="ido-personal-progress">
  <section aria-label="Your subscription progress"><span className="small muted">Your subscription</span><div className="ido-progress-value"><strong>{dollars(paid)}</strong><span>/ $1,000.00</span></div>
   <div className="ido-personal-track" role="progressbar" aria-label="Your subscription" aria-valuemin={0} aria-valuemax={1000} aria-valuenow={Number(paid)/100}><span style={{width:`${percent(paid,100000n)}%`}}/></div>
   <div className="ido-progress-caption"><span>Purchased</span><span>Purchase limit $1,000</span></div>
   <p className="small muted">{paid>=100000n?'Your purchase limit is reached.':`${dollars(100000n-paid)} remaining in your personal allowance.`}</p>
  </section>
  {state.phase===2?<section aria-label="Refund summary"><span className="small muted">{state.account.refunded?'Principal refunded':'Refund available'}</span><div className="ido-progress-value"><strong>{dollars(paid)}</strong></div><p className="small muted">Rebates do not apply to refunded subscriptions.</p></section>:<section aria-label="Your rebate progress">
   <span className="small muted">{state.phase===0?'Estimated rebate':'Final rebate'}</span><div className="ido-progress-value"><strong>{usable===undefined?'—':dollars(usable)}</strong><span>/ $200.00</span></div>
   <div className="ido-personal-track ido-rebate-track" role="progressbar" aria-label="Rebate supported by your subscription" aria-valuemin={0} aria-valuemax={200} aria-valuenow={usable===undefined?undefined:Number(usable)/100} aria-valuetext={usable===undefined?'Awaiting account verification':`${dollars(usable)} of $200`}>
    {state.phase===0&&scoreLimit!==undefined&&<span className="ido-score-capacity" style={{width:`${percent(scoreLimit,20000n)}%`}}/>}<span style={{width:`${percent(usable??0n,20000n)}%`}}/>
   </div>
   <dl className="ido-rebate-breakdown">{state.phase===0&&<div><dt><i className="ido-score-dot"/>Score allowance</dt><dd>{scoreLimit===undefined?'—':dollars(scoreLimit)}</dd></div>}<div><dt><i/>{state.phase===0?'Usable with your purchase':state.account.rebateClaimed?'Claimed rebate':'Final allowance'}</dt><dd>{usable===undefined?'—':dollars(usable)}</dd></div><div><dt>Maximum rebate</dt><dd>$200.00</dd></div></dl>
   {state.phase===0&&<p className="ido-rebate-tip">{scoreLimit===undefined?'Verify your matching account and wallet to see your rebate allowance.':scoreLimit===0n?'Play to build your rebate allowance. 100 points = $1.':missing===0n?'Your purchase covers your full score allowance.':!active?'Additional purchases are currently unavailable.':additional>room?'The remaining sale allocation cannot cover your full score allowance.':<>Subscribe <strong>{dollars(additional)} more</strong> to use your full <strong>{dollars(scoreLimit)}</strong> score allowance.{paid===0n&&missing<10000n?' First purchase minimum: $100.':''}</>}</p>}
   <p className="small muted">{state.phase===0?'Claim after successful settlement.':state.account.rebateClaimed?'Rebate already claimed.':'Claim your finalized rebate below.'}</p>
  </section>}
 </div>;
}
