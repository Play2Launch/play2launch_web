import { publicAvatarURL } from "../lib/avatar";

export function teamAvatarURL(team: unknown): string | undefined {
  if(!team || typeof team!=="object" || !("avatar_url" in team))return undefined;
  return typeof team.avatar_url==="string"?team.avatar_url:undefined;
}

export function TeamAvatarImage({url,initial}: {url?:string;initial:string}) {
  const src=publicAvatarURL(url);
  return <>{initial}{src && <img src={src} alt="" loading="lazy" onError={e=>{e.currentTarget.hidden=true;}} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",borderRadius:"inherit"}} />}</>;
}
