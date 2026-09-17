// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { loadTelegramBridge, localId, platformContext } from "./platform";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  delete window.Telegram;
  sessionStorage.clear();
  document
    .querySelectorAll('script[src*="telegram.org"]')
    .forEach((script) => script.remove());
  window.history.replaceState({}, "", "/");
});

it("does not load Telegram on an ordinary Web entry", async () => {
  window.history.replaceState({}, "", "/?startapp=hello");
  await loadTelegramBridge();
  expect(document.querySelector('script[src*="telegram.org"]')).toBeNull();
});

it("loads the bridge for Telegram data and releases boot after a network timeout", async () => {
  vi.useFakeTimers();
  window.history.replaceState({}, "", "/#tgWebAppData=auth_date%3D123");
  const boot = loadTelegramBridge();
  expect(document.querySelector('script[src*="telegram.org"]')).not.toBeNull();
  await vi.advanceTimersByTimeAsync(2500);
  await expect(boot).resolves.toBeUndefined();
});

it("uses an existing bridge without adding another script", async () => {
  window.Telegram = { WebApp: { initData: "auth_date=123" } };
  await loadTelegramBridge();
  expect(document.querySelector('script[src*="telegram.org"]')).toBeNull();
});

it("creates device-local ids on insecure LAN previews without randomUUID", () => {
  vi.stubGlobal("crypto", { getRandomValues: crypto.getRandomValues.bind(crypto) });
  expect(localId()).toMatch(/^[a-f0-9]{32}$/);
  expect(localId()).not.toBe(localId());
});

it("reloads the SDK on a clean route using the official launch cache", async () => {
  sessionStorage.setItem("__telegram__initParams", JSON.stringify({tgWebAppData:"auth_date=123&hash=signed"}));
  window.history.replaceState({}, "", "/profile");
  const boot = loadTelegramBridge();
  const script = document.querySelector<HTMLScriptElement>('script[src*="telegram.org"]')!;
  expect(script).not.toBeNull();
  // Emulate the official SDK restoring its own data; app code does not copy credentials.
  window.Telegram = {WebApp:{initData:"auth_date=123&hash=signed",platform:"android"}};
  script.dispatchEvent(new Event("load"));
  await boot;
  expect(platformContext(window.Telegram.WebApp,new URL(window.location.href))).toMatchObject({runtime:"telegram",initData:"auth_date=123&hash=signed"});
  expect(sessionStorage.getItem("p2l.telegram-tab.v1")).toBe("1");
});

it("does not fall back to Web after cleaned launch URL and SDK timeout, and allows retry", async () => {
  vi.useFakeTimers();
  window.history.replaceState({},"","/#tgWebAppData=auth_date%3D123");
  const initial = loadTelegramBridge();
  await vi.advanceTimersByTimeAsync(2500); await initial;
  window.history.replaceState({},"","/campaign/phood");
  expect(platformContext(undefined,new URL(window.location.href))).toMatchObject({runtime:"telegram",initData:""});
  const retry=loadTelegramBridge();
  const script=document.querySelector('script[src*="telegram.org"]')!;
  expect(script).not.toBeNull();
  window.Telegram={WebApp:{initData:"fresh-server-validated-data"}};
  script.dispatchEvent(new Event("load")); await retry;
  expect(platformContext(window.Telegram.WebApp,new URL(window.location.href)).initData).toBe("fresh-server-validated-data");
});

it("deduplicates bridge loads and treats malformed cached data as unauthenticated", async () => {
  sessionStorage.setItem("__telegram__initParams","bad-json");
  expect(platformContext(undefined,new URL(window.location.href)).runtime).toBe("web");
  sessionStorage.setItem("p2l.telegram-tab.v1","1");
  const a=loadTelegramBridge(), b=loadTelegramBridge();
  expect(document.querySelectorAll('script[src*="telegram.org"]')).toHaveLength(1);
  document.querySelector('script[src*="telegram.org"]')!.dispatchEvent(new Event("error"));
  await Promise.all([a,b]);
  expect(platformContext(undefined,new URL(window.location.href))).toMatchObject({runtime:"telegram",initData:""});
});
