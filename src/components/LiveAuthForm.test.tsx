// @vitest-environment jsdom
import {StrictMode} from 'react';
import {afterEach, expect, it, vi} from 'vitest';
import {act, cleanup, fireEvent, render, screen} from '@testing-library/react';
const mocks=vi.hoisted(()=>({register:vi.fn(),login:vi.fn(),sendVerification:vi.fn(),setAuthError:vi.fn()}));
vi.mock('../lib/api',()=>({api:{...mocks,request:()=>Promise.resolve({enabled:false})}}));
vi.mock('../state',()=>({useApp:()=>({platform:{runtime:'web'},authBusy:false,setAuthError:mocks.setAuthError,authContext:()=>({}),
 executeAuth:async(work:(signal:AbortSignal)=>Promise<unknown>,done:(value:unknown)=>void)=>{
  try{done(await work(new AbortController().signal));}catch(e){mocks.setAuthError((e as Error).message);}
 },completeLiveLogin:vi.fn()})}));
import {LiveAuthForm} from './LiveAuthForm';
const account={account_id:'ac1',username:'test@example.com',status:0};
afterEach(()=>{cleanup();vi.useRealTimers();vi.resetAllMocks();});
async function enterVerification(register:boolean){
 mocks.register.mockResolvedValue(account);mocks.login.mockResolvedValue({kind:'verification',account});
 render(<StrictMode><LiveAuthForm/></StrictMode>);
 if(register)fireEvent.click(screen.getByText('Create an account'));
 fireEvent.change(screen.getByLabelText('Email address'),{target:{value:account.username}});
 fireEvent.change(screen.getByLabelText('Password'),{target:{value:'password123'}});
 if(register)fireEvent.change(screen.getByLabelText('Confirm password'),{target:{value:'password123'}});
 await act(async()=>{fireEvent.click(screen.getByRole('button',{name:register?'Create account':'Sign in'}));});
}
it('automatically sends once after registration and allows resend only after 60 seconds',async()=>{
 vi.useFakeTimers();mocks.sendVerification.mockResolvedValue({});
 await enterVerification(true);
 expect(mocks.sendVerification).toHaveBeenCalledTimes(1);
 expect(mocks.sendVerification.mock.calls[0][0]).toBe('ac1');
 expect((screen.getByText('Resend code in 60s') as HTMLButtonElement).disabled).toBe(true);
 await act(async()=>{vi.advanceTimersByTime(59_000);});
 expect((screen.getByText('Resend code in 1s') as HTMLButtonElement).disabled).toBe(true);
 await act(async()=>{vi.advanceTimersByTime(1000);});
 await act(async()=>{fireEvent.click(screen.getByText('Resend code'));});
 expect(mocks.sendVerification).toHaveBeenCalledTimes(2);
 expect(screen.getByText('Resend code in 60s')).toBeTruthy();
});
it('automatically sends when an unactivated account signs in',async()=>{
 mocks.sendVerification.mockResolvedValue({});
 await enterVerification(false);
 expect(mocks.sendVerification).toHaveBeenCalledTimes(1);
 expect(screen.getByRole('status').textContent).toContain('Activation code sent');
});
it('shows delivery failure without automatic retries and keeps the cooldown',async()=>{
 vi.useFakeTimers();mocks.sendVerification.mockRejectedValue(new Error('Mail unavailable'));
 await enterVerification(true);
 expect(screen.getByRole('status').textContent).toContain('Could not confirm delivery');
 expect(mocks.setAuthError).toHaveBeenCalledWith('Mail unavailable');
 await act(async()=>{vi.advanceTimersByTime(60_000);});
 expect(mocks.sendVerification).toHaveBeenCalledTimes(1);
 expect((screen.getByText('Resend code') as HTMLButtonElement).disabled).toBe(false);
});
