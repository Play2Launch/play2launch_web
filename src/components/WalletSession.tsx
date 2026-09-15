import { useState } from "react";
import { assertWalletAllowed } from "../lib/walletPolicy";
import { Wallet } from "lucide-react";
import {
  createAppKit,
  useAppKit,
  useAppKitAccount,
  useAppKitNetwork,
  useDisconnect,
} from "@reown/appkit/react";
import { defineChain } from "@reown/appkit/networks";
import { EthersAdapter } from "@reown/appkit-adapter-ethers";
import { walletConfiguration } from "../lib/walletConfig";

assertWalletAllowed();
const config = walletConfiguration();
const network = defineChain({
  ...config.chain,
  chainNamespace: "eip155",
  caipNetworkId: `eip155:${config.chain.id}`,
});
// This module is lazy-loaded only after the user opens the wallet connector.
const walletKit = createAppKit({
  adapters: [new EthersAdapter()],
  networks: [network],
  defaultNetwork: network,
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

export function openWallet() {
  assertWalletAllowed();
  return walletKit.open();
}

export function WalletButton() {
  const { address, isConnected, status } = useAppKitAccount({
    namespace: "eip155",
  });
  const { open } = useAppKit();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function show() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
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
  return (
    <>
      <button
        className="btn btn-secondary"
        title={isConnected ? address : "Connect Wallet"}
        disabled={busy}
        onClick={() => void show()}
      >
        <Wallet size={16} />
        {isConnected && address
          ? `${address.slice(0, 6)}…${address.slice(-4)}`
          : status === "connecting"
            ? "Connecting…"
            : "Connect Wallet"}
      </button>
      {error && (
        <span className="header-wallet-error" role="alert">
          {error}
        </span>
      )}
    </>
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
              void action(() => open({ view: "Connect", namespace: "eip155" }))
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
