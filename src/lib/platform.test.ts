// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { loadTelegramBridge, localId } from "./platform";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  delete window.Telegram;
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
