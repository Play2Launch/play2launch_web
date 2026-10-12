import type {SigningMaterial} from './runnerSigning';
export const RUNNER_RULES = 'paper-run-practice-v5';
export function runnerURL(entry:string,parent:string,mode:'platform'|'demo'='platform') {
  if(!entry)throw Error('PAPERHOOD game URL is not configured.');
  const url=new URL(entry);
  const local=['localhost','127.0.0.1'].includes(url.hostname);
  if(url.origin===parent||url.username||url.password||!(url.protocol==='https:'||(url.protocol==='http:'&&local&&new URL(parent).protocol==='http:')))throw Error('The game must use a separate HTTPS origin (HTTP localhost is allowed for local development).');
  url.searchParams.set('mode',mode);url.searchParams.set('embed','1');url.searchParams.set('parent_origin',parent);
  if(mode==='demo')url.searchParams.delete('seed');
  return url.toString();
}
export type RunnerSession={signing?:SigningMaterial;id:string;slug:string;game_key:string;rules:string;protocol_version:string;seed:number;expires_at:string;status:string;score:number};
export function checkRunner(s:RunnerSession,slug:string,gameID?:string) {
  if(!s||!/^gs[0-9a-z]{1,13}$/.test(s.id)||s.slug!==slug||!/^gx[0-9a-z]{1,13}$/.test(s.game_key)||(gameID&&s.game_key!==gameID)||s.rules!==RUNNER_RULES||s.protocol_version!=='p2l-game-v1'||!Number.isInteger(s.seed)||s.seed<0||s.seed>0xffffffff||!Number.isFinite(Date.parse(s.expires_at))||!['playing','accepted','expired'].includes(s.status)||!Number.isSafeInteger(s.score)||s.score<0)throw Error('Invalid platform round.');
  return s;
}
export function runnerMessage(e:MessageEvent,source:Window|null,origin:string,gameID:string,instance?:string,session?:string) {
  const d=e.data;
  return e.source===source&&source!==null&&e.origin===origin&&d&&d.protocol==='p2l-game-v1'&&d.game_id===gameID&&d.rules_version===RUNNER_RULES&&typeof d.instance_id==='string'&&/^[a-f0-9]{32}$/.test(d.instance_id)&&(!instance||d.instance_id===instance)&&(!session||d.session_id===session);
}
