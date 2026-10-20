import { useState } from "react";
import { assertWalletAllowed } from "../lib/walletPolicy";
import { Wallet } from "lucide-react";
import {
  createAppKit,
  useAppKit,
  useAppKitAccount,
  useAppKitNetwork,
  useDisconnect,
  useAppKitProvider,
} from "@reown/appkit/react";
import { defineChain } from "@reown/appkit/networks";
import { P2LEthersAdapter } from "../lib/walletAdapter";
import { walletConfiguration, idoWalletChains } from "../lib/walletConfig";
import type { Eip1193Provider } from 'ethers';
import { IDOTransactions, type IDOTransactionProps } from './IDOTransactions';
import { useWalletChain } from '../lib/useWalletChain';

assertWalletAllowed();
const config = walletConfiguration();
const network = defineChain({
  ...config.chain,
  chainNamespace: "eip155",
  caipNetworkId: `eip155:${config.chain.id}`,
});
const idoNetworks=idoWalletChains().map(chain=>defineChain({...chain,chainNamespace:'eip155',caipNetworkId:`eip155:${chain.id}`}));
const networkFor=(id:number)=>idoNetworks.find(n=>n.id===id)||network;
// This module is lazy-loaded only after the user opens the wallet connector.
const walletKit = createAppKit({
  adapters: [new P2LEthersAdapter()],
  networks: [network, ...idoNetworks.filter(n=>n.id!==network.id)],
  defaultNetwork: network,
  // Campaigns select their own chain; keep the wallet network picker available.
  enableNetworkSwitch: true,
  projectId: config.projectId,
  metadata: {
    name: "Play To Launch",
    description: "P2L wallet connection",
    url: window.location.origin,
    icons: [`${window.location.origin}/favicon.svg`],
  },
  themeMode: "dark",
  themeVariables: {
    "--w3m-accent": "#d2fa69",
    "--w3m-border-radius-master": "2px",
  },
  features: {
    analytics: false,
    email: false,
    socials: false,
    swaps: false,
    onramp: false,
    send: false,
  },
  enableReconnect: true,
});

if (import.meta.env.DEV) {
  walletKit?.subscribeEvents?.(({ data }) => {
    if (data.event === 'CONNECT_ERROR') console.warn('[P2L wallet] Connector error:', data.properties.message);
  });
}

async function prepareConnection(target = network) {
  // AppKit can restore a chain from a previous deployment even when it is no
  // longer in networks. Reconcile that cached selection before authorization.
  if (Number(String(walletKit.getCaipNetworkId()).split(':').pop()) !== target.id) {
    await walletKit.switchNetwork(target, { throwOnFailure: true });
  }
}

export async function openWallet(chainId = network.id) {
  assertWalletAllowed();
  await prepareConnection(networkFor(chainId));
  return walletKit.open({ view: 'Connect', namespace: 'eip155' });
}

export function IDOWallet(props: IDOTransactionProps & {hideWalletButton?:boolean}) {
  const { address, isConnected } = useAppKitAccount({ namespace: 'eip155' });
  const { chainId } = useAppKitNetwork();
  const { walletProvider } = useAppKitProvider<Eip1193Provider>('eip155');
  const actualChain = useWalletChain(walletProvider, chainId);
  return <>{!props.hideWalletButton && <WalletButton targetChainId={props.config.chain_id} />}<IDOTransactions {...props} address={isConnected ? address : undefined} chainId={Number(actualChain)} provider={walletProvider} /></>;
}

export function WalletButton({targetChainId,hideNetworkLabel=false,visibility,primary=false}:{targetChainId?:number;hideNetworkLabel?:boolean;visibility?:"connected"|"disconnected";primary?:boolean} = {}) {
  const network=networkFor(targetChainId ?? config.chain.id);
  const { chainId: cachedChain, switchNetwork } = useAppKitNetwork();
  const { walletProvider } = useAppKitProvider<Eip1193Provider>('eip155');
  const chainId = useWalletChain(walletProvider, cachedChain);
  const { address, isConnected, status } = useAppKitAccount({
    namespace: "eip155",
  });
  const { open } = useAppKit();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const wrongNetwork = isConnected && Number(chainId) !== network.id;
  async function changeNetwork() {
    if (busy) return;
    setBusy(true); setError("");
    try { await switchNetwork(network); }
    catch { setError("Network switch was cancelled or failed. Please retry."); }
    finally { setBusy(false); }
  }
  async function show() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (!isConnected) await prepareConnection(network);
      await open({
        view: isConnected ? "Account" : "Connect",
        namespace: "eip155",
      });
    } catch {
      setError("Wallet could not open. Please retry.");
    } finally {
      setBusy(false);
    }
  }
  if ((visibility === "connected" && !(isConnected && address)) || (visibility === "disconnected" && isConnected && address)) return null;
  return (
    <div className="header-wallet-controls">
      <button
        className={`btn ${primary ? "btn-primary full" : "btn-secondary"} ${isConnected && address ? "wallet-identity-button" : ""}`}
        title={isConnected ? address : "Connect Wallet"}
        disabled={busy}
        onClick={() => void show()}
      >
        <Wallet size={16} aria-hidden="true" />
        <span className="wallet-identity-text">
        <span>
        {isConnected && address
          ? `${address.slice(0, 6)}…${address.slice(-4)}`
          : status === "connecting"
            ? "Connecting…"
            : "Connect Wallet"}
        </span>
        {isConnected && address && (!hideNetworkLabel || wrongNetwork) && <span className={`wallet-network-label ${wrongNetwork ? "wallet-network-warning" : ""}`}>{wrongNetwork ? `Chain ${chainId ?? "unknown"}` : network.name}</span>}
        </span>
      </button>
      {error && (
        <span className="header-wallet-error" role="alert">
          {error}
        </span>
      )}
      {isConnected && wrongNetwork && <button className="wallet-network-switch" disabled={busy} onClick={()=>void changeNetwork()} title={`Current chain: ${chainId ?? "unknown"}`}>Switch to {network.name}</button>}
    </div>
  );
}

export function WalletSession() {
  const { open } = useAppKit();
  const { address, isConnected, status } = useAppKitAccount({
    namespace: "eip155",
  });
  const { chainId, switchNetwork } = useAppKitNetwork();
  const { disconnect } = useDisconnect();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  async function action(fn: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch {
      setError("Wallet request was cancelled or failed. You can retry.");
    } finally {
      setBusy(false);
    }
  }
  const wrongNetwork = isConnected && Number(chainId) !== network.id;
  return (
    <div className="wallet-session">
      {isConnected && address ? (
        <>
          <span className="pill neutral">CONNECTED · NOT ACCOUNT-BOUND</span>
          <label>
            Wallet address
            <input
              aria-label="Connected wallet address"
              readOnly
              value={address}
              onFocus={(e) => e.target.select()}
            />
          </label>
          <p>
            {wrongNetwork
              ? `Different network selected (chain ${chainId ?? "unknown"}).`
              : `Network: ${network.name} (${network.id})`}
          </p>
          {wrongNetwork && (
            <button
              className="btn btn-primary full"
              disabled={busy}
              onClick={() => void action(() => switchNetwork(network))}
            >
              Switch to {network.name}
            </button>
          )}
          <button
            className="btn btn-secondary full"
            disabled={busy}
            onClick={() =>
              void action(async () => {
                await navigator.clipboard.writeText(address);
                setNotice("Wallet address copied.");
              })
            }
          >
            Copy address
          </button>
          <button
            className="btn btn-secondary full"
            disabled={busy}
            onClick={() =>
              void action(() => disconnect({ namespace: "eip155" }))
            }
          >
            Disconnect wallet
          </button>
        </>
      ) : (
        <>
          <p>
            {status === "connecting"
              ? "Waiting for wallet approval…"
              : `Ready to connect to ${network.name}.`}
          </p>
          <button
            className="btn btn-primary full"
            disabled={busy}
            onClick={() =>
              void action(async () => { await prepareConnection(); await open({ view: "Connect", namespace: "eip155" }); })
            }
          >
            Connect with WalletConnect
          </button>
        </>
      )}
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <p className="small muted">
        On mobile, approve in your wallet and return here.
      </p>
    </div>
  );
}
