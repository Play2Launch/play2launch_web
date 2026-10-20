import { expect, it } from "vitest";
import { vestingStatus } from "./vesting";
import type { IDOState } from "./ido";
const snapshot = (now:number, vested=0n, claimed=0n) => ({now, vested, allocation:1000n, account:{claimedTokens:claimed}, vesting:{start:100n,cliff:20n,duration:100n,interval:30n,initialBps:1000n}} as unknown as IDOState);
it("matches cliff, interval rounding and the final partial interval",()=>{
 expect(vestingStatus(snapshot(90))).toMatchObject({status:"Not started",next:100,nextAmount:100n});
 expect(vestingStatus(snapshot(110,100n))).toMatchObject({status:"Cliff period",next:150,nextAmount:270n});
 expect(vestingStatus(snapshot(151,370n))).toMatchObject({status:"Releasing",next:180,nextAmount:270n});
 expect(vestingStatus(snapshot(215,910n))).toMatchObject({next:220,nextAmount:90n});
 expect(vestingStatus(snapshot(220,1000n,1000n))).toMatchObject({status:"Fully claimed",next:null,percent:100});
});
it('combines two schedules without unlocking rebate tokens during the cliff',()=>{
 const s={...snapshot(100,240n),allocation:1000n,splitVesting:{base:800n,rebate:200n,baseVested:240n,rebateVested:0n},vesting:{start:100n,cliff:0n,duration:90n,interval:1n,initialBps:3000n,rebateCliff:30n,rebateDuration:90n,rebateInterval:1n}} as unknown as IDOState;
 expect(vestingStatus(s)).toMatchObject({end:220,next:101,nextAmount:6n,percent:24});
 const later={...s,now:190,vested:933n,splitVesting:{base:800n,rebate:200n,baseVested:800n,rebateVested:133n}};
 expect(vestingStatus(later)).toMatchObject({end:220,next:191,nextAmount:2n});
 const noRebate={...s,now:190,vested:1000n,splitVesting:{base:1000n,rebate:0n,baseVested:1000n,rebateVested:0n}};
 expect(vestingStatus(noRebate)).toMatchObject({end:190,next:null,status:'Fully unlocked'});
});
