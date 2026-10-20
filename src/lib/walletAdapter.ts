import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import { stableWalletProvider } from './walletProvider';

export class P2LEthersAdapter extends EthersAdapter {
  override async connect(params: Parameters<EthersAdapter['connect']>[0]) {
    try {
      if (import.meta.env.DEV) console.info('[P2L wallet] Network selection', JSON.stringify({requested:params.chainId, configured:this.getCaipNetworks().map(n=>n.id)}));
      const connector = this.connectors.find(c => c.id.toLowerCase() === params.id.toLowerCase());
      if (connector?.provider && connector.type !== 'AUTH' && connector.type !== 'WALLET_CONNECT') {
        connector.provider = stableWalletProvider(connector.provider);
      }
      return await super.connect(params);
    } catch (error) {
      // Keep failures visible for debugging without logging accounts or credentials.
      console.warn('[P2L wallet] Connection failed:', error instanceof Error ? error.message : 'Unknown wallet error');
      throw error;
    }
  }
}
