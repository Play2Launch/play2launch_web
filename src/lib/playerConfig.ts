export type PlayerConfig = {
  telegram_bot_username: string;
  telegram_app_name: string;
  walletconnect_project_id: string;
  wallet_network: 'mainnet' | 'testnet';
};

// Public build-time settings. No server configuration request is required.
export function readPlayerConfig(env: Record<string, string | undefined>): PlayerConfig {
  return {
    telegram_bot_username: (env.VITE_TELEGRAM_BOT_USERNAME || '').trim().replace(/^@/, ''),
    telegram_app_name: (env.VITE_TELEGRAM_APP_NAME || '').trim(),
    walletconnect_project_id: (env.VITE_WALLETCONNECT_PROJECT_ID || '').trim(),
    wallet_network: (env.VITE_WALLET_NETWORK || 'mainnet') as PlayerConfig['wallet_network'],
  };
}
export const playerConfig = readPlayerConfig(import.meta.env);
