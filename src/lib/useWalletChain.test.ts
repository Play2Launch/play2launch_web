// @vitest-environment jsdom
import { renderHook, waitFor, act, cleanup } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useWalletChain } from './useWalletChain';
afterEach(cleanup);
it('uses the actual chain instead of a stale connector selection and tracks changes', async () => {
  let chain = '0x1';
  let listener: (() => void) | undefined;
  const provider = { request: vi.fn(async () => chain), on: vi.fn((_: string, fn: () => void) => { listener = fn; }), removeListener: vi.fn() };
  const view = renderHook(() => useWalletChain(provider, 46630));
  expect(view.result.current).toBeUndefined();
  await waitFor(() => expect(view.result.current).toBe(1));
  act(() => { chain = '0xb626'; listener?.(); });
  await waitFor(() => expect(view.result.current).toBe(46630));
  // Returning from a wallet signature dialog must not temporarily invalidate
  // the unchanged chain and cancel the pending transaction generation.
  let finishRefresh: (value: string) => void = () => {};
  provider.request.mockImplementationOnce(() => new Promise<string>(resolve => { finishRefresh = resolve; }));
  act(() => window.dispatchEvent(new Event('focus')));
  expect(view.result.current).toBe(46630);
  await act(async () => finishRefresh('0xb626'));
  expect(view.result.current).toBe(46630);
  provider.request.mockRejectedValueOnce(new Error('disconnected'));
  act(() => listener?.());
  await waitFor(() => expect(view.result.current).toBeUndefined());
  view.unmount();
  expect(provider.removeListener).toHaveBeenCalledWith('chainChanged', listener);
});
