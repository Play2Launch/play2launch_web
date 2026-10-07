// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { loadTelegramBridge, localId, mountPlatform, platformContext } from "./platform";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  delete window.Telegram;
  sessionStorage.clear();
  document.documentElement.style.removeProperty("--tg-top");
  document.documentElement.style.removeProperty("--tg-bottom");
  document
    .querySelectorAll('script[src*="telegram.org"]')
    .forEach((script) => script.remove());
  window.history.replaceState({}, "", "/");
});

it("requests native fullscreen on supported Telegram entry and tracks safe areas", () => {
  const app = {
    initData: "signed", ready: vi.fn(), expand: vi.fn(),
    disableVerticalSwipes: vi.fn(),
    isVersionAtLeast: vi.fn(() => true), requestFullscreen: vi.fn(),
    safeAreaInset: { top: 24, bottom: 12 },
    contentSafeAreaInset: { top: 40, bottom: 0 },
    onEvent: vi.fn(), offEvent: vi.fn(),
  };
  const cleanup = mountPlatform(app, "telegram");
  expect(app.ready).toHaveBeenCalledOnce();
  expect(app.expand).toHaveBeenCalledOnce();
  expect(app.isVersionAtLeast).toHaveBeenCalledWith("7.7");
  expect(app.disableVerticalSwipes).toHaveBeenCalledOnce();
  expect(app.isVersionAtLeast).toHaveBeenCalledWith("8.0");
  expect(app.requestFullscreen).toHaveBeenCalledOnce();
  expect(document.documentElement.style.getPropertyValue("--tg-top")).toBe("64px");
  const changed = app.onEvent.mock.calls.find(([event]) => event === "fullscreenChanged")![1];
  app.contentSafeAreaInset.top = 0;
  changed();
  expect(document.documentElement.style.getPropertyValue("--tg-top")).toBe("24px");
  expect(app.requestFullscreen).toHaveBeenCalledOnce();
  cleanup();
  for (const [event, callback] of app.onEvent.mock.calls) {
    expect(app.offEvent).toHaveBeenCalledWith(event, callback);
  }
});

it("keeps older clients expanded and does not request fullscreen on ordinary Web", () => {
  const app = { initData: "", expand: vi.fn(), disableVerticalSwipes: vi.fn(), requestFullscreen: vi.fn(), isVersionAtLeast: () => false };
  mountPlatform(app, "web")();
  expect(app.expand).not.toHaveBeenCalled();
  expect(app.disableVerticalSwipes).not.toHaveBeenCalled();
  mountPlatform(app, "telegram")();
  expect(app.expand).toHaveBeenCalledOnce();
  expect(app.disableVerticalSwipes).not.toHaveBeenCalled();
  expect(app.requestFullscreen).not.toHaveBeenCalled();
});

it("disables sheet swipes on Telegram 7.7 without requiring fullscreen support", () => {
  const app = {
    initData: "signed",
    isVersionAtLeast: (version: string) => version === "7.7",
    disableVerticalSwipes: vi.fn(),
    requestFullscreen: vi.fn(),
  };
  mountPlatform(app, "telegram")();
  expect(app.disableVerticalSwipes).toHaveBeenCalledOnce();
  expect(app.requestFullscreen).not.toHaveBeenCalled();
});

it("keeps fullscreen setup working if disabling swipes fails", () => {
  const app = {
    initData: "signed",
    isVersionAtLeast: () => true,
    disableVerticalSwipes: vi.fn(() => { throw new Error("unsupported"); }),
    requestFullscreen: vi.fn(),
  };
  expect(() => mountPlatform(app, "telegram")()).not.toThrow();
  expect(app.requestFullscreen).toHaveBeenCalledOnce();
});

it("does not request fullscreen again when already fullscreen, and tolerates client errors", () => {
  const app = { initData: "", isFullscreen: true, isVersionAtLeast: () => true,
    requestFullscreen: vi.fn(() => { throw new Error("unsupported"); }) };
  mountPlatform(app, "telegram")();
  expect(app.requestFullscreen).not.toHaveBeenCalled();
  app.isFullscreen = false;
  expect(() => mountPlatform(app, "telegram")()).not.toThrow();
  expect(app.requestFullscreen).toHaveBeenCalledOnce();
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
