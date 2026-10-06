import {api,type AuthContext} from './api';

const key='p2l.telegram-oidc.v1';
const base64url=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
export function safeReturnPath(value:unknown):string {
 if(typeof value!=='string'||!value.startsWith('/')||value.startsWith('//')||value.includes('\\')||/[\u0000-\u001f]/.test(value)||value.startsWith('/auth/telegram'))return '/';
 return value;
}
export async function beginTelegramLogin(context:AuthContext){
 const verifier=base64url(crypto.getRandomValues(new Uint8Array(32)));
 const challenge=base64url(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))));
 const returnPath=safeReturnPath(location.pathname+location.search+location.hash);
 sessionStorage.setItem(key,JSON.stringify({verifier,returnPath,context,created:Date.now()}));
 location.assign(api.telegramStartURL(challenge,context.entry.referrerId));
}
// One redemption across React StrictMode remounts; no long-lived token in the URL.
let completion:ReturnType<typeof redeem>|undefined;
async function redeem(){
 const params=new URLSearchParams(location.hash.slice(1));
 history.replaceState(null,'',location.pathname);
 const stored=sessionStorage.getItem(key);sessionStorage.removeItem(key);
 if(params.has('error'))throw new Error('Telegram sign-in was cancelled or expired. Please try again.');
 const pending=JSON.parse(stored||'null');const ticket=params.get('ticket')||'';
 if(!pending||!/^[A-Za-z0-9_-]{43}$/.test(ticket)||!/^[A-Za-z0-9_-]{43}$/.test(pending.verifier)||typeof pending.created!=='number'||Date.now()-pending.created>12*60*1000||!pending.context?.entry)throw new Error('This Telegram login has expired. Please start again in this browser.');
 const result=await api.telegramExchange(ticket,pending.verifier,pending.context);
 return {result,returnPath:safeReturnPath(pending.returnPath)};
}
export function finishTelegramLogin(){return completion??=redeem();}
