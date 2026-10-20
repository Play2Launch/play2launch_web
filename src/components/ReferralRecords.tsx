import {useState} from 'react';
import {Link} from 'react-router-dom';
import {api} from '../lib/api';
type Page={reward:number;next_cursor:string;items:{id:string;name:string;joined_at:number;status:'pending'|'credited';amount:number}[]};
export function ReferralRecords(){
 const [page,setPage]=useState<Page>(),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function load(after=''){if(busy)return;setBusy(true);setError('');try{const p=await api.authenticated<Page>('/points/referrals'+(after?'?after='+encodeURIComponent(after):''));setPage(old=>({...p,items:after?[...(old?.items||[]),...p.items]:p.items}));}catch(e){setError(e instanceof Error?e.message:'Could not load invitations.');}finally{setBusy(false);}}
 return <div className="referral-records"><button className="text-link" disabled={busy} onClick={()=>void load()}>{busy?'Loading invitations…':page?'Refresh invitations':'My invitations'}</button>{error&&<p role="alert">{error}</p>}{page&&<><p className="small muted">Current reward: {page.reward} P2L Points per new player who completes a valid game lasting at least 15 seconds in an active campaign. One reward per new player, across all invitation links. No team required.</p>{!page.items.length&&<p>No new players invited yet.</p>}{page.items.map(r=><div key={r.id} className="referral-record"><Link to={`/players/${r.id}`}>{r.name}</Link><time className="small muted">{new Date(r.joined_at).toLocaleDateString()}</time><span>{r.status==='credited'?(r.amount>0?`+${r.amount} P2L Points credited`:'Qualified · no reward under applicable rule'):'Waiting for a valid 15-second game'}</span></div>)}{page.next_cursor&&<button className="text-link" disabled={busy} onClick={()=>void load(page.next_cursor)}>Load more invitations</button>}</>}</div>;
}
