import {useEffect,useState} from 'react';
import {Link} from "react-router-dom";
import {api} from '../lib/api';
type Application={id:string;status:string;version:number;code:string;expires_at:string;name:string;social_url:string;introduction:string;proof_url:string;history:{id:string;status:string;reason:string;at:string}[]};
const labels:Record<string,string>={draft:'Verify account ownership',pending:'Under review',approved:'Approved captain',rejected:'Changes requested',revoked:'Verification revoked'};
function checkSocialLink(value:string,profile:boolean):boolean {
 try {
  const url=new URL(value.trim());
  if(url.protocol!=='https:'||url.username||url.password||!['x.com','twitter.com','t.me'].includes(url.host)||value.trim().length>2048)return false;
  if(url.host==='t.me'&&(url.search||url.hash))return false;
  return !profile||/^\/[A-Za-z0-9_]{1,32}\/?$/.test(url.pathname);
 }catch{return false;}
}
export function LiveVerification({userId}:{userId:string}){
 const [hasHandle,setHasHandle]=useState(false);
 const [data,setData]=useState<Application|null>(null);const [busy,setBusy]=useState(false);const [loaded,setLoaded]=useState(false);const [error,setError]=useState('');const [retry,setRetry]=useState(0);
 useEffect(()=>{const controller=new AbortController();setLoaded(false);Promise.all([api.authenticated<Application|null>('/kol/me',undefined,controller.signal),api.authenticated<{handle?:string}>('/user/profile',undefined,controller.signal)]).then(([v,profile])=>{if(!controller.signal.aborted){setData(v);setHasHandle(/^[a-z][a-z0-9_]{2,23}$/.test(profile.handle||''));setLoaded(true);setError('');}}).catch(e=>{if(!controller.signal.aborted)setError(e.message);});return ()=>controller.abort();},[userId,retry]);
 async function send(path:string,body:unknown){setBusy(true);setError('');try{await api.authenticated(path,body);setRetry(v=>v+1);}catch(e){setError(e instanceof Error?e.message:'Request failed');}finally{setBusy(false);}}
 const expired=!!data&&Date.parse(data.expires_at)<=Date.now();
 return <div><h2>{data?labels[data.status]:'Become a verified captain'}</h2>{error&&<div role="alert" className="inline-note">{error}{!loaded&&<button className="btn btn-secondary" onClick={()=>setRetry(v=>v+1)}>Retry</button>}</div>}
 {!loaded?<p>Loading verification…</p>:<><p>Platform review verifies your social account ownership. It does not endorse investments or grant campaign publishing access.</p>
 {!hasHandle&&<div className="inline-note"><p>Set your P2L @username before starting or submitting KOL verification. This is your platform username, not your Telegram or X username.</p><Link className="btn btn-primary" to="/profile">Set username in Profile</Link></div>}
 {hasHandle&&(!data||['rejected','revoked'].includes(data.status)||(data.status==='draft'&&expired))&&<button className="btn btn-primary" disabled={busy} onClick={()=>send('/kol/challenge',{})}>{data?'Start a new verification':'Get ownership code'}</button>}
 {hasHandle&&data?.status==='draft'&&!expired&&<><div className="inline-note"><div><strong>{data.code}</strong><p>Put this exact code in your X / Telegram profile bio or a public post. Keep it visible until review. A Telegram login alone does not verify group/channel ownership.</p><p>Expires: {new Date(data.expires_at).toLocaleString()}</p></div></div>
 <form className="verification-form" key={`${data.id}:${data.version}`} onSubmit={e=>{e.preventDefault();const values=Object.fromEntries(new FormData(e.currentTarget));
 if(!checkSocialLink(String(values.social_url),true)){setError('Public profile: enter an HTTPS X or Telegram profile URL, such as https://x.com/yourname.');return;}
 if(!checkSocialLink(String(values.proof_url),false)){setError('Proof link: enter an HTTPS X or Telegram profile or public post URL. X share parameters are supported.');return;}
 void send('/kol/apply',{...values,version:data.version});}}>
 <fieldset disabled={busy} style={{border:0,padding:0,display:'grid',gap:16}}>
 <label>Captain name<input name="name" required minLength={2} maxLength={60} defaultValue={data.name}/></label>
 <label>Public X / Telegram profile<input name="social_url" type="url" required placeholder="https://x.com/yourname" defaultValue={data.social_url}/></label>
 <label>Community introduction<textarea name="introduction" required minLength={20} maxLength={500} rows={4} defaultValue={data.introduction}/></label>
 <label>Proof link (profile or public post containing the code)<input name="proof_url" type="url" required defaultValue={data.proof_url}/></label>
 <button className="btn btn-primary" type="submit">{busy?'Submitting…':'Submit for review'}</button></fieldset></form></>}
 {data?.status==='pending'&&<p>Your application is awaiting manual review. If the code expires, the reviewer must reject it so you can request a new code.</p>}
 {data?.status==='approved'&&<><p>Your KOL verification is approved. You can create one team per campaign; this does not grant administrator access.</p><Link className="btn btn-primary" to="/captain">Create or view your team</Link></>}
 {data?.history?.length&&<details style={{marginTop:24}}><summary>Application and review history</summary>{data.history.map(event=><p key={event.id}><strong>{labels[event.status]||event.status}</strong> · {new Date(event.at).toLocaleString()}<br/>{event.reason}</p>)}</details>}
 </>}</div>;
}
