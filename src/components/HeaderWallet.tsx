import { useState } from "react";
import { Wallet } from "lucide-react";
import { loadWallet, useWalletModule } from "../lib/walletLoader";
import { walletAllowed } from "../lib/walletPolicy";

export function HeaderWallet() {
  const module = useWalletModule();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function connect() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const wallet = await loadWallet();
      await wallet.openWallet();
    } catch {
      setError("Wallet could not open. Please retry.");
    } finally {
      setBusy(false);
    }
  }
  if (!walletAllowed()) return null;
  return (
    <div className="header-wallet">
      {module ? (
        <module.WalletButton />
      ) : (
        <button
          className="btn btn-secondary"
          disabled={busy}
          onClick={() => void connect()}
        >
          <Wallet size={16} />
          {busy ? "Loading wallet…" : "Connect Wallet"}
        </button>
      )}
      {error && (
        <span role="alert" className="header-wallet-error">
          {error}
        </span>
      )}
    </div>
  );
}
