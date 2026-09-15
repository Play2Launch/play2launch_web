import { useState } from "react";
import { walletConfiguration } from "../lib/walletConfig";
import { loadWallet, useWalletModule } from "../lib/walletLoader";
import { walletAllowed } from "../lib/walletPolicy";

export function WalletPanel() {
  const Panel = useWalletModule()?.WalletSession;
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function load() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      walletConfiguration();
      await loadWallet();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Wallet connection could not be loaded. Please retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (!walletAllowed()) return null;
  return (
    <section className="wallet-panel" aria-label="Wallet connection">
      <h3>Wallet · Robinhood Chain</h3>
      <p>
        Connect via WalletConnect. This does not bind a wallet to your P2L
        account or enable token claims.
      </p>
      {Panel ? (
        <Panel />
      ) : (
        <button
          className="btn btn-secondary full"
          disabled={busy}
          onClick={() => void load()}
        >
          {busy ? "Loading wallet connector…" : "Open wallet connection"}
        </button>
      )}
      {error && <p role="alert">{error}</p>}
      <p className="small muted">
        No signature, transfer or token approval is requested. Your wallet
        session is separate from account login.
      </p>
    </section>
  );
}
