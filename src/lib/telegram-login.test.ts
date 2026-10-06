// @vitest-environment jsdom
import {it,expect,vi,afterEach} from 'vitest';
const exchange=vi.hoisted(()=>vi.fn());
vi.mock('./api',()=>({api:{telegramExchange:exchange}}));
import {safeReturnPath} from './telegram-login';
it('only allows local return paths',()=>{
 for(const path of ['https://evil.test','//evil.test','/\\evil.test','/auth/telegram#ticket=x','/\n/evil.test',null])expect(safeReturnPath(path)).toBe('/');
 expect(safeReturnPath('/campaign/phood/teams?invite=abc')).toBe('/campaign/phood/teams?invite=abc');
});
afterEach(()=>{sessionStorage.clear();exchange.mockReset();history.replaceState(null,'','/');});
it('redeems only once across remounts, strips the URL ticket and returns the invite route',async()=>{
 vi.resetModules();
 const {finishTelegramLogin}=await import('./telegram-login');
 const context={guestId:'g',entry:{referrerId:'ur123',source:'share',target:'teams'}};
 sessionStorage.setItem('p2l.telegram-oidc.v1',JSON.stringify({verifier:'v'.repeat(43),created:Date.now(),returnPath:'/campaign/phood/teams?invite=abc',context}));
 history.replaceState(null,'','/auth/telegram#ticket='+'t'.repeat(43));
 exchange.mockResolvedValue({kind:'authenticated'});
 const a=finishTelegramLogin(),b=finishTelegramLogin();expect(a).toBe(b);
 expect((await a).returnPath).toBe('/campaign/phood/teams?invite=abc');
 expect(location.hash).toBe('');expect(exchange).toHaveBeenCalledTimes(1);
 expect(exchange).toHaveBeenCalledWith('t'.repeat(43),'v'.repeat(43),context);
 expect(sessionStorage.getItem('p2l.telegram-oidc.v1')).toBeNull();
});
it('rejects a callback opened without its original browser state',async()=>{
 vi.resetModules();const {finishTelegramLogin}=await import('./telegram-login');
 history.replaceState(null,'','/auth/telegram#ticket='+'t'.repeat(43));
 await expect(finishTelegramLogin()).rejects.toThrow('expired');expect(exchange).not.toHaveBeenCalled();
});
