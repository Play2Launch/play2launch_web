import {beforeEach,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({acquire:vi.fn()}));
vi.mock('./turnstile',()=>({acquireTurnstile:mocks.acquire}));
import {ApiClient} from './api';
const response=(code:number,data:unknown,status=200)=>new Response(JSON.stringify({code,data}),{status});
const challenge=()=>response(10008,{site_key:'public-key',action:'register'},403);
beforeEach(()=>vi.resetAllMocks());
it('retries the same protected request once with a fresh token and preserves auth and body',async()=>{
 const transport=vi.fn().mockResolvedValueOnce(challenge()).mockResolvedValueOnce(response(0,{ok:true}));
 mocks.acquire.mockResolvedValue('fresh-token');
 const client=new ApiClient('https://api.test',transport);
 await expect(client.request('/acc/create',{username:'person@example.test'},{authorization:'cookie'})).resolves.toEqual({ok:true});
 expect(mocks.acquire).toHaveBeenCalledWith('public-key','register',undefined);
 const first=transport.mock.calls[0][1],retry=transport.mock.calls[1][1];
 expect(first.headers['X-P2L-Turnstile']).toBeUndefined();
 expect(retry.headers['X-P2L-Turnstile']).toBe('fresh-token');
 expect(retry.credentials).toBe('include');expect(retry.body).toBe(first.body);
});
it('does not loop when validation rejects the submitted token',async()=>{
 const transport=vi.fn().mockImplementation(()=>Promise.resolve(challenge()));mocks.acquire.mockResolvedValue('used');
 await expect(new ApiClient('https://api.test',transport).request('/acc/create',{})).rejects.toMatchObject({code:10008});
 expect(transport).toHaveBeenCalledTimes(2);expect(mocks.acquire).toHaveBeenCalledTimes(1);
});
it('cancellation never retries a protected write',async()=>{
 const transport=vi.fn().mockResolvedValue(challenge());mocks.acquire.mockRejectedValue(new Error('cancelled'));
 await expect(new ApiClient('https://api.test',transport).request('/acc/create',{})).rejects.toThrow('cancelled');
 expect(transport).toHaveBeenCalledTimes(1);
});
it('does not automatically retry network failures or provider outages',async()=>{
 for(const value of [()=>Promise.reject(new TypeError('offline')),()=>Promise.resolve(response(10006,null,503))]){
  const transport=vi.fn(value);
  await expect(new ApiClient('https://api.test',transport).request('/acc/create',{})).rejects.toThrow();
  expect(transport).toHaveBeenCalledTimes(1);
 }
 expect(mocks.acquire).not.toHaveBeenCalled();
});
it('does not reuse a registration token for sending email',async()=>{
 const transport=vi.fn().mockResolvedValueOnce(challenge()).mockResolvedValueOnce(response(0,{})).mockResolvedValueOnce(response(10008,{site_key:'public-key',action:'send_email'},403)).mockResolvedValueOnce(response(0,{}));
 mocks.acquire.mockResolvedValueOnce('registration-token').mockResolvedValueOnce('mail-token');
 const client=new ApiClient('https://api.test',transport);
 await client.request('/acc/create',{});await client.request('/acc/send_email',{});
 expect(transport.mock.calls[2][1].headers['X-P2L-Turnstile']).toBeUndefined();
 expect(transport.mock.calls[3][1].headers['X-P2L-Turnstile']).toBe('mail-token');
});
