import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Share2, Copy, ArrowUpRight } from 'lucide-react';
import {shareOrigin} from '../lib/entry';

export function PostShare({id}:{id:string}) {
 const [open,setOpen]=useState(false),[copied,setCopied]=useState(false),[failed,setFailed]=useState(false);
 const path=`/posts/${encodeURIComponent(id)}`;
 const url=new URL(path,shareOrigin(window.location.origin)).href;
 async function copy(){
  try {await navigator.clipboard.writeText(url);setCopied(true);setFailed(false);}
  catch {setFailed(true);setCopied(false);}
 }
 return <div className="post-share">
  <Link className="post-action" to={path}>View post <ArrowUpRight size={13}/></Link>
  <button className="post-action" aria-expanded={open} onClick={()=>setOpen(v=>!v)}><Share2 size={14}/>Share</button>
  {open && <div className="post-share-panel" aria-label="Share this post">
   <button className="text-link" onClick={()=>void copy()}><Copy size={14}/> {copied?'Copied':'Copy link'}</button>
   <a href={`https://t.me/share/url?${new URLSearchParams({url,text:'Check out this post on Play2Launch'})}`} target="_blank" rel="noopener noreferrer">Telegram ↗</a>
   <a href={`https://twitter.com/intent/tweet?${new URLSearchParams({url,text:'Check out this post on Play2Launch'})}`} target="_blank" rel="noopener noreferrer">X ↗</a>
   {copied&&<span role="status" className="small muted">Link copied.</span>}
   {failed&&<label className="small muted">Copy this link<input aria-label="Post link" readOnly value={url} onFocus={e=>e.currentTarget.select()}/></label>}
  </div>}
 </div>;
}
