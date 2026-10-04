import { useState } from 'react';
import { shareLinks } from '../lib/entry';
import { ReferralRecords } from './ReferralRecords';

export function FriendInvite({userId}:{userId:string}) {
  const [notice,setNotice]=useState('');
  const links=shareLinks(window.location.origin,{referrerId:userId,source:'share',target:'campaign'}, {bot:import.meta.env.VITE_TELEGRAM_BOT_USERNAME,app:import.meta.env.VITE_TELEGRAM_APP_NAME});
  async function copy(value:string){try{await navigator.clipboard.writeText(value);setNotice('Invite link copied.');}catch{setNotice('Select and copy the link manually.');}}
  return <section className="team-invite-card" aria-label="Invite friends">
    <h3>Invite friends</h3><p>Invite friends to P2L. This link does not join or change anyone’s team. Existing players are not counted as new referrals.</p>
    <label className="team-invite-field">Your invitation<input aria-label="Friend invitation" readOnly value={links.web} onFocus={e=>e.target.select()}/></label>
    <button className="btn btn-secondary" onClick={()=>void copy(links.web)}>Copy invitation</button>
    {links.telegram&&<><label className="team-invite-field">Telegram Mini App invitation<input aria-label="Telegram friend invitation" readOnly value={links.telegram} onFocus={e=>e.target.select()}/></label><button className="btn btn-secondary" onClick={()=>void copy(links.telegram!)}>Copy Telegram invitation</button></>}
    {notice&&<p role="status">{notice}</p>}
    <ReferralRecords/>
  </section>;
}
