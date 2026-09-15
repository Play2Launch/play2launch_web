import { useSyncExternalStore } from "react";
import { assertWalletAllowed } from "./walletPolicy";

type WalletModule = typeof import("../components/WalletSession");
let loaded: WalletModule | null = null;
let pending: Promise<WalletModule> | undefined;
const listeners = new Set<() => void>();
export function loadWallet() {
  assertWalletAllowed();
  if (!pending)
    pending = import("../components/WalletSession")
      .then((module) => {
        loaded = module;
        listeners.forEach((fn) => fn());
        return module;
      })
      .catch((error) => {
        pending = undefined;
        throw error;
      });
  return pending;
}
export function useWalletModule() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    () => loaded,
    () => null,
  );
}
