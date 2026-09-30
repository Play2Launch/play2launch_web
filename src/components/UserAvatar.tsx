import {useState} from 'react';
import {publicAvatarURL} from '../lib/avatar';

export function UserAvatar({name,src}:{name?:string;src?:string}) {
  const url=publicAvatarURL(src);
  const [failed,setFailed]=useState('');
  return url && failed!==url
    ? <img src={url} alt="" referrerPolicy="no-referrer" onError={()=>setFailed(url)} />
    : <>{name?.trim().charAt(0).toUpperCase()||'?'}</>;
}
