import {visitorID} from './clientIdentity';
import { api } from './api';

const activeKey='p2l.active-invite-visit.v1';
const resumeKey='p2l.personal-invite-auth-return.v1';
const hex=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');
const validID=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{32}$/.test(v);
type ActiveVisit={id:string;kind:'personal'|'team';value?:string;slug?:string;at:number};
export async function openInviteVisit(kind:'personal'|'team',value:string,slug?:string){
 if(kind==='personal')try{
  const previous=JSON.parse(sessionStorage.getItem(activeKey)||'null') as ActiveVisit;
  const resume=JSON.parse(sessionStorage.getItem(resumeKey)||'null') as {referrer:string;at:number};
  sessionStorage.removeItem(resumeKey);
  if(resume?.referrer===value&&Date.now()-resume.at<12*60_000&&previous?.kind==='personal'&&previous.value===value&&validID(previous.id)&&Date.now()-previous.at<30*60_000)return previous.id;
 }catch{/* A new visit will be opened. */}
 const id=hex();
 const tma=/tgWebApp(?:Data|StartParam)=/.test(location.search+location.hash)||Boolean((window as Window & {Telegram?:{WebApp?:{initData?:string}}}).Telegram?.WebApp?.initData);
 await api.request('/invite-analytics/visits',{id,visitor_id:visitorID(),kind,source:tma?'tma':'web',...(kind==='team'?{token:value}:{referrer_id:value})});
 try{sessionStorage.setItem(activeKey,JSON.stringify({id,kind,value,slug,at:Date.now()} satisfies ActiveVisit));}catch{/* Storage can be disabled. */}
 return id;
}
export function markPersonalInviteAuthRedirect(referrer?:string){
 if(!/^ur[0-9a-z]{1,32}$/.test(referrer||''))return;
 try{sessionStorage.setItem(resumeKey,JSON.stringify({referrer,at:Date.now()}));}catch{/* The current page can still use its visit. */}
}
export async function recordInviteRegistration(visitID:string){
 if(!validID(visitID))return;
 await api.authenticated('/invite-analytics/registrations',{visit_id:visitID});
}
function active(slug:string):ActiveVisit|undefined{
 try{const v=JSON.parse(sessionStorage.getItem(activeKey)||'null') as ActiveVisit;if(validID(v?.id)&&Date.now()-v.at<30*86400000&&(!v.slug||v.slug===slug))return v;}catch{/* Ignore inaccessible storage. */}
}
export function inviteVisitID(slug:string){return active(slug)?.id;}
export async function recordInviteEvent(slug:string,runID:string,event:'trial_start'|'trial_effective'|'formal_start'|'formal_effective',sessionID?:string){
 const visit=active(slug);if(!visit||!validID(runID))return;
 const body={visit_id:visit.id,run_id:runID,event,slug,...(sessionID?{session_id:sessionID}:{})};
 if(event.startsWith('trial_'))await api.request('/invite-analytics/trial-events',body);
 else await api.authenticated('/invite-analytics/formal-events',body);
}
export function trialMessage(e:MessageEvent,frame:HTMLIFrameElement|null,src:string){
 if(!frame||!src||e.source!==frame.contentWindow||e.origin!==new URL(src).origin)return null;
 const d=e.data;
 return d?.protocol==='p2l-invite-analytics-v1'&&['trial_start','trial_effective'].includes(d.type)&&validID(d.run_id)?{event:d.type as 'trial_start'|'trial_effective',runID:d.run_id}:null;
}
