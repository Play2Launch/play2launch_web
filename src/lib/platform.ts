import type { Runtime } from "./entry";
export type TelegramApp = {
  initData: string;
  platform?: string;
  ready?: () => void;
  expand?: () => void;
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

export async function loadTelegramBridge(): Promise<void> {
  if (window.Telegram?.WebApp?.initData) return;
  if (
    platformContext(undefined, new URL(window.location.href)).runtime !==
    "telegram"
  )
    return;
  await new Promise<void>((resolve) => {
    const script = document.createElement("script");
    const finish = () => {
      clearTimeout(timeout);
      resolve();
    };
    const timeout = setTimeout(finish, 2500);
    script.src = "https://telegram.org/js/telegram-web-app.js";
    script.async = true;
    script.onload = finish;
    script.onerror = finish;
    document.head.appendChild(script);
  });
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
  const runtime: Runtime = raw ? "telegram" : "web";
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
  return () => {
    app.offEvent?.("safeAreaChanged", resize);
    app.offEvent?.("contentSafeAreaChanged", resize);
  };
}
