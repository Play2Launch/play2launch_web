import type { Runtime } from "./entry";
export type TelegramApp = {
  initData: string;
  platform?: string;
  ready?: () => void;
  expand?: () => void;
  isFullscreen?: boolean;
  isVersionAtLeast?: (version: string) => boolean;
  requestFullscreen?: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  openTelegramLink?: (url: string) => void;
  safeAreaInset?: { top: number; bottom: number };
  contentSafeAreaInset?: { top: number; bottom: number };
  BackButton?: {
    show(): void;
    hide(): void;
    onClick(fn: () => void): void;
    offClick(fn: () => void): void;
  };
  onEvent?: (event: string, callback: () => void) => void;
  offEvent?: (event: string, callback: () => void) => void;
};
/** Device-local label, never an authentication credential. Works on LAN HTTP previews. */
export function localId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const values = new Uint8Array(16);
  crypto.getRandomValues(values);
  return Array.from(values, (value) =>
    value.toString(16).padStart(2, "0"),
  ).join("");
}

const telegramTabKey = "p2l.telegram-tab.v1";
function rememberedTelegramTab(): boolean {
  try {
    if (sessionStorage.getItem(telegramTabKey) === "1") return true;
    // The official SDK restores its own launch data from this tab-scoped cache.
    const cached = JSON.parse(sessionStorage.getItem("__telegram__initParams") || "null");
    return typeof cached?.tgWebAppData === "string" && cached.tgWebAppData.length > 0;
  } catch { return false; }
}
let bridgeLoading: Promise<void> | undefined;
export async function loadTelegramBridge(): Promise<void> {
  const context = platformContext(window.Telegram?.WebApp, new URL(window.location.href));
  if (context.runtime !== "telegram") return;
  // Persist only the runtime marker, not credentials or an authenticated identity.
  try { sessionStorage.setItem(telegramTabKey, "1"); } catch { /* Restricted WebView. */ }
  if (window.Telegram?.WebApp?.initData) return;
  if (bridgeLoading) return bridgeLoading;
  bridgeLoading = new Promise<void>((resolve) => {
    const script = document.createElement("script");
    const finish = () => {
      clearTimeout(timeout);
      script.remove();
      resolve();
    };
    const timeout = setTimeout(finish, 2500);
    script.src = "https://telegram.org/js/telegram-web-app.js";
    script.async = true;
    script.onload = finish;
    script.onerror = finish;
    document.head.appendChild(script);
  });
  try { await bridgeLoading; } finally { bridgeLoading = undefined; }
}
declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramApp };
  }
}
export function platformContext(
  app: TelegramApp | undefined,
  url: URL,
): { runtime: Runtime; initData: string; start?: string } {
  const hash = new URLSearchParams(url.hash.slice(1));
  const raw =
    app?.initData ||
    url.searchParams.get("tgWebAppData") ||
    hash.get("tgWebAppData") ||
    "";
  // Runtime detection is not identity verification. Only the backend can validate initData.
  const runtime: Runtime = raw || (app?.platform && app.platform !== "unknown") || rememberedTelegramTab() ? "telegram" : "web";
  const start = raw
    ? new URLSearchParams(raw).get("start_param") || undefined
    : undefined;
  return { runtime, initData: raw, start };
}
export function mountPlatform(app: TelegramApp | undefined, runtime: Runtime) {
  if (runtime !== "telegram" || !app) return () => {};
  try {
    app.ready?.();
    app.expand?.();
    app.setHeaderColor?.("#0b0d0b");
    app.setBackgroundColor?.("#0b0d0b");
  } catch {
    /* Optional client capabilities must not block play. */
  }
  const resize = () => {
    document.documentElement.style.setProperty(
      "--tg-top",
      `${(app.safeAreaInset?.top || 0) + (app.contentSafeAreaInset?.top || 0)}px`,
    );
    document.documentElement.style.setProperty(
      "--tg-bottom",
      `${(app.safeAreaInset?.bottom || 0) + (app.contentSafeAreaInset?.bottom || 0)}px`,
    );
  };
  resize();
  app.onEvent?.("safeAreaChanged", resize);
  app.onEvent?.("contentSafeAreaChanged", resize);
  app.onEvent?.("fullscreenChanged", resize);
  // expand() is only the expanded sheet. Native fullscreen needs Bot API 8.0.
  // Request once on entry; do not force users back in after they exit fullscreen.
  try {
    if (!app.isFullscreen && app.isVersionAtLeast?.("8.0")) {
      app.requestFullscreen?.();
    }
  } catch {
    /* Unsupported clients keep the expanded sheet; authentication is unaffected. */
  }
  return () => {
    app.offEvent?.("safeAreaChanged", resize);
    app.offEvent?.("contentSafeAreaChanged", resize);
    app.offEvent?.("fullscreenChanged", resize);
  };
}
