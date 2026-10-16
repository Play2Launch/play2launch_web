import {beforeEach,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({h:vi.fn(),t:vi.fn()}));
vi.mock('./hcaptcha',()=>({acquireHCaptcha:mocks.h}));
vi.mock('./turnstile',()=>({acquireTurnstile:mocks.t}));
import {ApiClient} from './api';
const response=(code:number,data:unknown,status=200)=>new Response(JSON.stringify({code,data}),{status});
const challenge=()=>response(10008,{site_key:'turnstile',hcaptcha_site_key:'hcaptcha',action:'register'},403);
beforeEach(()=>vi.resetAllMocks());
it('collects both tokens before one retry, preserving the original body',async()=>{
 const transport=vi.fn().mockResolvedValueOnce(challenge()).mockResolvedValueOnce(response(0,{}));mocks.h.mockResolvedValue('h-proof');mocks.t.mockResolvedValue('t-proof');
 await new ApiClient('https://api.test',transport).request('/acc/create',{username:'test@example.test'});
 expect(transport).toHaveBeenCalledTimes(2);const retry=transport.mock.calls[1][1];expect(retry.headers['X-P2L-HCaptcha']).toBe('h-proof');expect(retry.headers['X-P2L-Turnstile']).toBe('t-proof');expect(retry.body).toBe(transport.mock.calls[0][1].body);
 expect(mocks.h.mock.invocationCallOrder[0]).toBeLessThan(mocks.t.mock.invocationCallOrder[0]);
});
it('does not submit or acquire Turnstile after hCaptcha cancellation',async()=>{
 const transport=vi.fn().mockResolvedValueOnce(challenge());mocks.h.mockRejectedValue(new Error('cancelled'));
 await expect(new ApiClient('https://api.test',transport).request('/acc/create',{})).rejects.toThrow('cancelled');expect(transport).toHaveBeenCalledTimes(1);expect(mocks.t).not.toHaveBeenCalled();
});
it('does not loop or reuse tokens after a server rejection',async()=>{
 const transport=vi.fn().mockImplementation(()=>Promise.resolve(challenge()));mocks.h.mockResolvedValue('h');mocks.t.mockResolvedValue('t');
 await expect(new ApiClient('https://api.test',transport).request('/acc/create',{})).rejects.toMatchObject({code:10008});expect(transport).toHaveBeenCalledTimes(2);
});
it('supports hCaptcha-only policy and reports bounded client diagnostics without credentials',async()=>{
 const transport=vi.fn().mockResolvedValueOnce(response(10008,{hcaptcha_site_key:'h',action:'signup'},403)).mockImplementation(()=>Promise.resolve(response(0,{})));
 mocks.h.mockImplementation(async(_key,_signal,report)=>{report('widget_error');return 'h-proof'});
 await new ApiClient('https://api.test',transport).request('/user/tg_login',{sensitive:'never-in-telemetry'},{authorization:'private-auth'});
 expect(mocks.t).not.toHaveBeenCalled();const report=transport.mock.calls.find(c=>c[0].endsWith('/security/challenge-failure'))!;
 expect(JSON.parse(report[1].body)).toEqual({action:'signup',reason:'widget_error'});expect(report[1].headers.Authorization).toBeUndefined();expect(report[1].headers['X-P2L-HCaptcha']).toBeUndefined();
});
