import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Users } from 'lucide-react';
import { api } from '../lib/api';
import { UserAvatar } from './UserAvatar';

type Person = { id:string; name:string; handle?:string; avatar_url?:string };

export function FeedPeopleSearch({query}:{query:string}) {
  const normalized=query.trim().replace(/^@/,'').trim();
  const [items,setItems]=useState<Person[]>([]);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [retry,setRetry]=useState(0);
  useEffect(()=>{
    setItems([]);setError('');
    if(Array.from(normalized).length<2){setBusy(false);return;}
    const ctrl=new AbortController();setBusy(true);
    const timer=window.setTimeout(()=>{
      api.request<{items:Person[]}>(`/players/search?q=${encodeURIComponent(query.trim())}`,undefined,{signal:ctrl.signal}).then(page=>{
        if(!page||!Array.isArray(page.items)||page.items.length>20||!page.items.every(item=>item&&/^ur[0-9a-z]{1,32}$/.test(item.id)&&typeof item.name==='string'&&(item.handle===undefined||typeof item.handle==='string')&&(item.avatar_url===undefined||typeof item.avatar_url==='string')))throw new Error('Could not read people.');
        if(!ctrl.signal.aborted)setItems(page.items);
      }).catch(e=>{if(!ctrl.signal.aborted)setError(e instanceof Error?e.message:'Could not search people.');}).finally(()=>{if(!ctrl.signal.aborted)setBusy(false);});
    },300);
    return ()=>{window.clearTimeout(timer);ctrl.abort();};
  },[query,retry]);
  return <section className="feed-people-results" aria-label="People search results">
    <h2>People</h2>
    {Array.from(normalized).length<2?<p className="muted">Enter at least 2 characters to search by name or @username.</p>:<>
      {busy&&<p role="status" className="muted">Searching people…</p>}
      {error&&<p role="alert">{error} <button className="text-link" onClick={()=>setRetry(n=>n+1)}>Retry</button></p>}
      {!busy&&!error&&!items.length&&<div className="empty-panel"><Users size={28}/><h3>No people found</h3><p>Try a different name or @username.</p></div>}
      {!error&&<div className="feed-people-list">{items.map(person=><Link className="feed-person" key={person.id} to={`/players/${encodeURIComponent(person.id)}`}><span className="avatar player-avatar"><UserAvatar name={person.name} src={person.avatar_url}/></span><span className="feed-person-label"><strong>{person.name}</strong>{person.handle&&<small>@{person.handle}</small>}</span><ArrowUpRight size={17} aria-hidden="true"/></Link>)}</div>}
    </>}
  </section>;
}
