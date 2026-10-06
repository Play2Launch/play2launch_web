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
const callbackErrors:Record<string,string>={
 TG_COOKIE_MISSING:'The login browser cookie is missing. Please start again in the same browser.',
 TG_STATE_MISMATCH:'The login attempt does not match this browser. Please start again.',
 TG_STATE_EXPIRED:'This login attempt has expired. Please start again.',
 TG_STATE_STORE:'The login service is temporarily unavailable.',
 TG_STATE_INVALID:'The login state could not be read. Please start again.',
 TG_STATE_CONSUME:'This login attempt could not be completed. Please start again.',
 TG_AUTH_DECLINED:'Telegram authorization was declined or cancelled.',
 TG_CODE_MISSING:'Telegram did not return an authorization code.',
 TG_TOKEN_REQUEST:'The server could not prepare Telegram verification.',
 TG_TOKEN_NETWORK:'The server could not reach Telegram for verification.',
 TG_TOKEN_REJECTED:'Telegram rejected the server verification request.',
 TG_TOKEN_RESPONSE:'Telegram returned an unexpected verification response.',
 TG_TOKEN_VERIFY:'The server could not verify the Telegram identity token.',
 TG_CLAIMS_INVALID:'Telegram returned an invalid identity.',
 TG_USER_ID_MISSING:'Telegram did not return a valid user ID.',
 TG_NONCE_MISMATCH:'Telegram identity verification did not match this login attempt.',
 TG_ISSUED_TIME:'Telegram identity verification failed its time check.',
 TG_TICKET_CREATE:'The server could not create a login ticket.',
 TG_TICKET_STORE:'The server could not save the login ticket.',
};
function callbackError(params:URLSearchParams){
 const reason=params.get('reason')||'';
 if(!Object.prototype.hasOwnProperty.call(callbackErrors,reason))return 'Telegram sign-in failed. Please try again.';
 const diagnostic=params.get('diagnostic')||'';
 return `${callbackErrors[reason]} (${reason}${/^[A-Za-z0-9_-]{12}$/.test(diagnostic)?`; ref: ${diagnostic}`:''})`;
}
async function redeem(){
 const params=new URLSearchParams(location.hash.slice(1));
 history.replaceState(null,'',location.pathname);
 const stored=sessionStorage.getItem(key);sessionStorage.removeItem(key);
 if(params.has('error'))throw new Error(callbackError(params));
 const pending=JSON.parse(stored||'null');const ticket=params.get('ticket')||'';
 if(!pending||!/^[A-Za-z0-9_-]{43}$/.test(ticket)||!/^[A-Za-z0-9_-]{43}$/.test(pending.verifier)||typeof pending.created!=='number'||Date.now()-pending.created>12*60*1000||!pending.context?.entry)throw new Error('This Telegram login has expired. Please start again in this browser.');
 const result=await api.telegramExchange(ticket,pending.verifier,pending.context);
 return {result,returnPath:safeReturnPath(pending.returnPath)};
}
export function finishTelegramLogin(){return completion??=redeem();}
