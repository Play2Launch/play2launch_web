# Wallet connection V1

Profile (`/profile`) → Open wallet connection → Connect with WalletConnect. Uses Reown AppKit with the Ethers adapter, lazy-loaded on explicit user action. Existing account/TMA authentication is unchanged. SDK-persisted sessions are restored when the connector is opened; wallet changes and remote disconnects update through AppKit subscriptions/hooks.

Configure `VITE_WALLETCONNECT_PROJECT_ID` and `VITE_WALLET_NETWORK` (`mainnet` or `testnet`) in the Web build environment. Restart Vite locally or rebuild and deploy the production Web bundle after changes. The player does not request `/api/v1/config/player`. An empty Project ID disables wallet connection. These settings are public; never include private keys. Configure allowed origins in the Reown dashboard.

Official Robinhood configuration: https://docs.robinhood.com/chain/connecting/

- Mainnet: 4663, https://rpc.mainnet.chain.robinhood.com
- Testnet: 46630, https://rpc.testnet.chain.robinhood.com
- Gas currency: ETH. Public RPC endpoints are rate-limited and require a production infrastructure review before token/contract work.

This version only connects/disconnects, displays/copies the address and requests a network switch on user action. It does not sign messages, send transactions, approve tokens, bind wallets to server accounts, change reward eligibility, or claim tokens. Wallet sessions are browser-scoped and separate from P2L login/logout; a connected address must never be treated as a verified account-bound address. No SDK swap/onramp/email/social login/send UI is enabled; analytics is disabled.

WalletConnect is Web-only. Telegram Mini App runtime, launch hints (query/hash), or an active Telegram bridge suppress both header and profile wallet entry points. The shared loader refuses SDK imports there; SDK initialization also checks this policy. Launch routes are unavailable in TMA and no external-wallet/claim redirect is offered. This is a UI capability policy, not authentication or a complete review of campaign content under Telegram's blockchain guidelines. Review campaign text/assets before publishing any TMA activity.

Use an HTTPS deployment for mobile Web WalletConnect. Approve in the wallet then return to the dapp. A desktop localhost page is not accessible on a phone. Connection approval, rejection, disconnect and session restoration need manual testing with a real wallet; automated tests do not authorize or execute real wallet actions.

Dependency review: the Coinbase transitive SDK pins vulnerable axios 1.16.0; a scoped override uses 1.20.0. npm audit after this change has no high/critical findings, but still reports four moderate findings on the existing React Router/Vitest dependency paths. Major framework/test-runner upgrades are deferred rather than applying audit --force. The wallet SDK creates a large lazy chunk; it does not load on ordinary browsing, but first wallet opening needs a larger download.
