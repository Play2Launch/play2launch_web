import { api, liveAuth } from './api';

export type PlayerConfig = {
  telegram_bot_username: string;
  telegram_app_name: string;
  walletconnect_project_id: string;
  wallet_network: 'mainnet' | 'testnet';
};
export const playerConfig: PlayerConfig = {
  telegram_bot_username: '', telegram_app_name: '',
  walletconnect_project_id: '', wallet_network: 'mainnet',
};
export async function loadPlayerConfig() {
  if (!liveAuth) return;
  const value = await api.request<PlayerConfig>('/config/player', undefined, {signal: AbortSignal.timeout(15000)});
  if (!value || typeof value.telegram_bot_username !== 'string' || typeof value.telegram_app_name !== 'string' ||
      typeof value.walletconnect_project_id !== 'string' || !['mainnet', 'testnet'].includes(value.wallet_network)) {
    throw new Error('Invalid player configuration');
  }
  Object.assign(playerConfig, value);
}
