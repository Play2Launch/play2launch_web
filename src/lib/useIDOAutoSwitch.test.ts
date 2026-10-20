// @vitest-environment jsdom
import {renderHook,waitFor} from '@testing-library/react';
import {it,expect,vi} from 'vitest';
import {useIDOAutoSwitch} from './useIDOAutoSwitch';
it('switches once after connection, without fighting Relay network changes',async()=>{
 const change=vi.fn().mockResolvedValue(undefined);
 const {rerender}=renderHook(({chain,connected})=>useIDOAutoSwitch(connected,'0xabc',chain,4663,change),{initialProps:{chain:1,connected:false}});
 expect(change).not.toHaveBeenCalled();rerender({chain:1,connected:true});await waitFor(()=>expect(change).toHaveBeenCalledTimes(1));
 rerender({chain:4663,connected:true});rerender({chain:56,connected:true});expect(change).toHaveBeenCalledTimes(1);
 rerender({chain:56,connected:false});rerender({chain:56,connected:true});await waitFor(()=>expect(change).toHaveBeenCalledTimes(2));
});
it('does not repeatedly prompt after rejection',async()=>{
 const change=vi.fn().mockRejectedValue(Error('rejected'));
 const {result,rerender}=renderHook(()=>useIDOAutoSwitch(true,'0xabc',1,4663,change));
 await waitFor(()=>expect(result.current).toContain('cancelled'));rerender();expect(change).toHaveBeenCalledTimes(1);
});
it('records an already correct connection without prompting',()=>{
 const change=vi.fn();const {rerender}=renderHook(({chain})=>useIDOAutoSwitch(true,'0xabc',chain,4663,change),{initialProps:{chain:4663}});
 rerender({chain:56});expect(change).not.toHaveBeenCalled();
});
