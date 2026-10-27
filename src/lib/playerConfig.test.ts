import { beforeEach, expect, it, vi } from 'vitest';
import { api } from './api';
import { loadPlayerConfig, playerConfig } from './playerConfig';
import { walletConfiguration } from './walletConfig';
vi.mock('./api', () => ({liveAuth: true, api: {request: vi.fn()}}));
beforeEach(() => {
  vi.mocked(api.request).mockReset();
  Object.assign(playerConfig, {telegram_bot_username:'',telegram_app_name:'',walletconnect_project_id:'',wallet_network:'mainnet'});
});
it('loads server settings before wallet and sharing consumers read them', async () => {
  const settings = {telegram_bot_username:'p2l_bot',telegram_app_name:'play',walletconnect_project_id:'0123456789abcdef0123456789abcdef',wallet_network:'testnet'};
  vi.mocked(api.request).mockResolvedValue(settings);
  await loadPlayerConfig();
  expect(playerConfig.telegram_bot_username).toBe('p2l_bot');
  expect(walletConfiguration().chain.id).toBe(46630);
  expect(walletConfiguration().projectId).toBe(settings.walletconnect_project_id);
});
it('allows unconfigured optional integrations and rejects malformed responses', async () => {
  vi.mocked(api.request).mockResolvedValue({...playerConfig});
  await loadPlayerConfig();
  expect(() => walletConfiguration()).toThrow();
  vi.mocked(api.request).mockResolvedValue({wallet_network:'other'});
  await expect(loadPlayerConfig()).rejects.toThrow('Invalid player configuration');
  expect(playerConfig.wallet_network).toBe('mainnet');
});
it('propagates an unavailable service so startup can offer retry', async () => {
  vi.mocked(api.request).mockRejectedValue(new Error('offline'));
  await expect(loadPlayerConfig()).rejects.toThrow('offline');
});
