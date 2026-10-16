// @vitest-environment jsdom
import {act,fireEvent,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
let options:Record<string,unknown>;
beforeEach(()=>{
 vi.resetModules();window.hcaptcha={render:vi.fn((_el,opts)=>{options=opts;return 'widget'}),remove:vi.fn()};
 vi.spyOn(document.head,'appendChild').mockImplementation((node)=>{queueMicrotask(()=>window.p2lHCaptchaReady?.());return node});
});
afterEach(()=>{vi.restoreAllMocks();delete window.hcaptcha});
it('cleans up the widget and overlay after success',async()=>{
 const {acquireHCaptcha}=await import('./hcaptcha');const report=vi.fn(),result=acquireHCaptcha('site',undefined,report);
 await screen.findByRole('dialog');await waitFor(()=>expect(options.sitekey).toBe('site'));
 await act(async()=>{(options.callback as (s:string)=>void)('proof');await expect(result).resolves.toBe('proof')});
 expect(window.hcaptcha?.remove).toHaveBeenCalledWith('widget');expect(screen.queryByRole('dialog')).toBeNull();expect(report).not.toHaveBeenCalled();
});
it('reports widget errors once per reason and cancellation without a registration submission',async()=>{
 const {acquireHCaptcha}=await import('./hcaptcha');const report=vi.fn(),result=acquireHCaptcha('site',undefined,report);const rejected=expect(result).rejects.toThrow('Verification did not complete');
 await screen.findByRole('dialog');await waitFor(()=>expect(window.hcaptcha?.render).toHaveBeenCalled());
 await act(async()=>{(options['error-callback'] as ()=>void)();(options['error-callback'] as ()=>void)()});expect(report).toHaveBeenCalledTimes(1);
 await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Cancel'}));await rejected});expect(report).toHaveBeenLastCalledWith('cancelled');expect(screen.queryByRole('dialog')).toBeNull();
});
