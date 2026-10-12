// Browser-scoped random identifiers, not a hardware fingerprint or proof of identity.
const memory=new Map<string,string>();
const valid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{32}$/.test(v);
function persistentID(key:string){
  try{const old=localStorage.getItem(key);if(valid(old)){memory.set(key,old);return old;}}catch{/* Storage may be unavailable. */}
  const id=memory.get(key)||Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');
  memory.set(key,id);
  try{localStorage.setItem(key,id);}catch{/* Retain a page-session identifier only. */}
  return id;
}
export const visitorID=()=>persistentID('p2l.invite-visitor.v1');
export function clientIdentityHeaders():Record<string,string>{
  if(typeof window==='undefined')return {};
  const telegram=Boolean((window as Window&{Telegram?:{WebApp?:{initData?:string}}}).Telegram?.WebApp?.initData)||/tgWebApp(?:Data|StartParam)=/.test((window.location?.search||'')+(window.location?.hash||''));
  return {'X-P2L-Device-ID':persistentID('p2l.browser-device.v1'),'X-P2L-Client-ID':visitorID(),'X-P2L-Client-Type':telegram?'telegram':'web'};
}
