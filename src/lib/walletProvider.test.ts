import { expect, it, vi } from 'vitest';
import { stableWalletProvider } from './walletProvider';

it('skips a redundant network switch after wallet authorization', async () => {
  const request = vi.fn().mockResolvedValue('0xb626');
  const provider = stableWalletProvider({ request });
  expect(await provider.request({ method: 'wallet_switchEthereumChain', params: [{chainId:'0xB626'}] })).toBeNull();
  expect(request).toHaveBeenCalledTimes(1);
  expect(request).toHaveBeenCalledWith({method:'eth_chainId'});
  expect(stableWalletProvider(provider)).toBe(provider);
});

it('preserves real network switches and wallet rejection', async () => {
  const rejection = new Error('User rejected');
  const request = vi.fn().mockResolvedValueOnce('0x1').mockRejectedValueOnce(rejection);
  const args = {method:'wallet_switchEthereumChain',params:[{chainId:'0xb626'}]};
  await expect(stableWalletProvider({request}).request(args)).rejects.toBe(rejection);
  expect(request).toHaveBeenLastCalledWith(args);
});

it('preserves authorization, signatures and provider event context', async () => {
  const original = { request: vi.fn().mockResolvedValue(['account']), on() { return this; } };
  const provider = stableWalletProvider(original);
  expect(await provider.request({method:'eth_requestAccounts'})).toEqual(['account']);
  await provider.request({method:'personal_sign',params:['message']});
  expect(original.request).toHaveBeenLastCalledWith({method:'personal_sign',params:['message']});
  expect(provider.on()).toBe(original);
});
