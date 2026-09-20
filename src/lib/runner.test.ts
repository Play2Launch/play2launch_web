import {it,expect} from 'vitest';
import {runnerURL,runnerMessage,checkRunner,RUNNER_RULES} from './runner';
it('restricts iframe origin and always requests platform mode',()=>{
 const u=new URL(runnerURL('http://127.0.0.1:5190/?seed=42','http://localhost:5173'));
 expect(u.searchParams.get('mode')).toBe('platform');expect(u.searchParams.get('parent_origin')).toBe('http://localhost:5173');
 for(const entry of ['javascript:alert(1)','https://web.test','http://remote.test','https://user:pass@game.test'])expect(()=>runnerURL(entry,'https://web.test')).toThrow();
 expect(()=>runnerURL('http://localhost:5190','https://web.test')).toThrow();
});
it('requires source, origin, game, instance and session',()=>{
 const source={} as Window;const data={protocol:'p2l-game-v1',game_id:'gx1',rules_version:RUNNER_RULES,instance_id:'a'.repeat(32),session_id:'gs1'};
 const event={source,origin:'https://game.test',data} as MessageEvent;
 expect(runnerMessage(event,source,event.origin,'gx1',data.instance_id,'gs1')).toBe(true);
 expect(runnerMessage(event,{} as Window,event.origin,'gx1')).toBe(false);
 expect(runnerMessage(event,source,'https://other.test','gx1')).toBe(false);
 expect(runnerMessage(event,source,event.origin,'gx1',data.instance_id,'gs2')).toBe(false);
});
it('checks returned server session rules and uint32 seed',()=>{
 const s={id:'gs1',slug:'phood',game_key:'gx1',rules:RUNNER_RULES,protocol_version:'p2l-game-v1',seed:42,expires_at:new Date().toISOString(),status:'playing',score:0};
 expect(checkRunner(s,'phood')).toBe(s);expect(()=>checkRunner({...s,seed:1.5},'phood')).toThrow();
});
