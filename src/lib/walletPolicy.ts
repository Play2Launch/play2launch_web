import type { Runtime } from "./entry";

// UI capability only, not authentication. Fail closed for Telegram launch hints
// even when the bridge/initData has not finished loading.
export function walletAllowed(runtime?: Runtime): boolean {
  if (runtime === "telegram" || typeof window === "undefined") return false;
  const app = window.Telegram?.WebApp;
  if (app?.initData || (app?.platform && app.platform !== "unknown"))
    return false;
  const url = new URL(window.location.href);
  const hash = new URLSearchParams(url.hash.slice(1));
  return !["tgWebAppData", "tgWebAppPlatform", "tgWebAppVersion"].some(
    (key) => url.searchParams.has(key) || hash.has(key),
  );
}

export function assertWalletAllowed() {
  if (!walletAllowed())
    throw new Error("Wallet connection is unavailable in this environment.");
}
