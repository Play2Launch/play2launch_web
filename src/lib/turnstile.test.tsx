// @vitest-environment jsdom
import {act,fireEvent,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {acquireTurnstile} from './turnstile';
let options:Record<string,unknown>;
beforeEach(()=>{
 HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
 window.turnstile={render:vi.fn((_element,opts)=>{options=opts;return 'widget';}),remove:vi.fn()};
});
afterEach(()=>{delete window.turnstile;});
it('renders the requested action and cleans up after verification',async()=>{
 const result=acquireTurnstile('site-key','register');
 await screen.findByRole('dialog');await waitFor(()=>expect(options.action).toBe('register'));
 await act(async()=>{(options.callback as (s:string)=>void)('one-use');await expect(result).resolves.toBe('one-use');});
 expect(window.turnstile?.remove).toHaveBeenCalledWith('widget');expect(screen.queryByRole('dialog')).toBeNull();
});
it('cancels and removes the dialog without a token',async()=>{
 const result=acquireTurnstile('site-key','send_email');const rejected=expect(result).rejects.toThrow('cancelled');
 await screen.findByRole('dialog');await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Cancel'}));await rejected;});
 expect(screen.queryByRole('dialog')).toBeNull();
});
it('aborts when its authentication flow is closed',async()=>{
 const controller=new AbortController();const result=acquireTurnstile('site-key','signup',controller.signal);const rejected=expect(result).rejects.toMatchObject({name:'AbortError'});
 await screen.findByRole('dialog');await act(async()=>{controller.abort();await rejected;});expect(screen.queryByRole('dialog')).toBeNull();
});
