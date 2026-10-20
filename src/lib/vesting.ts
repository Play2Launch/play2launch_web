import type { IDOState } from "./ido";
export function vestingParts(s:IDOState){
 if(!s.splitVesting)return [];
 const p=s.splitVesting,v=s.vesting;
 return [
  {label:'Base tokens',allocation:p.base,vested:p.baseVested,schedule:v},
  {label:'Rebate-backed tokens',allocation:p.rebate,vested:p.rebateVested,schedule:{start:v.start,cliff:v.rebateCliff,duration:v.rebateDuration,interval:v.rebateInterval,initialBps:0n}}
 ].map(part=>({...part,...singleStatus({...s,allocation:part.allocation,vested:part.vested,account:{...s.account,claimedTokens:0n},vesting:part.schedule})}));
}
export function vestingStatus(s:IDOState){
 if(!s.splitVesting)return singleStatus(s);
 const parts=vestingParts(s).filter(p=>p.allocation>0n);
 const next=parts.reduce<number|null>((n,p)=>p.next==null?n:n==null?p.next:Math.min(n,p.next),null);
 return {...singleStatus(s),status:BigInt(s.account.claimedTokens)>=s.allocation&&s.allocation>0n?'Fully claimed':s.now<Number(s.vesting.start)?'Not started':s.vested>=s.allocation?'Fully unlocked':'Releasing',end:Math.max(Number(s.vesting.start),...parts.map(p=>p.end)),next,nextAmount:parts.reduce((n,p)=>n+(p.next===next?p.nextAmount:0n),0n)};
}
function singleStatus(s: IDOState) {
  const total = s.allocation, claimed = BigInt(s.account.claimedTokens);
  const start = Number(s.vesting.start), cliffEnd = start + Number(s.vesting.cliff);
  const end = cliffEnd + Number(s.vesting.duration), interval = Number(s.vesting.interval);
  const initial = total * BigInt(s.vesting.initialBps) / 10000n;
  const status = total > 0n && claimed >= total ? "Fully claimed" : s.now < start ? "Not started" : s.vested >= total ? "Fully unlocked" : s.now < cliffEnd ? "Cliff period" : "Releasing";
  let next: number | null = null;
  if (total > s.vested) next = s.now < start && initial > 0n ? start : Math.min(end, cliffEnd + (Math.max(0, Math.floor((s.now - cliffEnd) / interval)) + 1) * interval);
  const nextVested = next == null ? s.vested : next === start ? initial : next >= end ? total : initial + (total - initial) * BigInt(next - cliffEnd) / BigInt(s.vesting.duration);
  return { status, start, cliffEnd, end: initial === total ? start : end, next, nextAmount: nextVested - s.vested, percent: total > 0n ? Number(s.vested * 10000n / total) / 100 : 0 };
}
