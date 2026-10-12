// @vitest-environment jsdom
import {beforeEach,expect,it,vi} from 'vitest';
beforeEach(()=>{localStorage.clear();vi.resetModules();});
it('retains browser identifiers across reloads and reuses the existing invite visitor',async()=>{
 localStorage.setItem('p2l.invite-visitor.v1','a'.repeat(32));
 const first=await import('./clientIdentity');const a=first.clientIdentityHeaders();
 expect(a['X-P2L-Client-ID']).toBe('a'.repeat(32));expect(first.visitorID()).toBe(a['X-P2L-Client-ID']);
 expect(a['X-P2L-Device-ID']).toMatch(/^[a-f0-9]{32}$/);expect(a['X-P2L-Device-ID']).not.toBe(a['X-P2L-Client-ID']);
 vi.resetModules();expect((await import('./clientIdentity')).clientIdentityHeaders()).toEqual(a);
});
it('does not break signup when browser storage is disabled',async()=>{
 const get=vi.spyOn(Storage.prototype,'getItem').mockImplementation(()=>{throw new Error('blocked')});
 const set=vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('blocked')});
 try{const m=await import('./clientIdentity');expect(m.clientIdentityHeaders()).toEqual(m.clientIdentityHeaders());expect(m.visitorID()).toMatch(/^[a-f0-9]{32}$/);}finally{get.mockRestore();set.mockRestore();}
});
