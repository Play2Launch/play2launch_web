// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { walletAllowed } from "./walletPolicy";
import { loadWallet } from "./walletLoader";
import { HeaderWallet } from "../components/HeaderWallet";
import { WalletPanel } from "../components/WalletPanel";
const sdk = vi.hoisted(() => vi.fn());
vi.mock("../components/WalletSession", () => {
  sdk();
  return {};
});
afterEach(() => {
  cleanup();
  delete window.Telegram;
  window.history.replaceState({}, "", "/");
});
it("retains Web wallet entrances without initializing SDK", () => {
  render(
    <>
      <HeaderWallet />
      <WalletPanel />
    </>,
  );
  expect(screen.getByRole("button", { name: "Connect Wallet" })).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Open wallet connection" }),
  ).toBeTruthy();
  expect(sdk).not.toHaveBeenCalled();
});
it.each([
  "/?tgWebAppPlatform=ios",
  "/#tgWebAppData=test",
  "/?tgWebAppVersion=8.0",
])("blocks Telegram before bridge loads: %s", (path) => {
  window.history.replaceState({}, "", path);
  render(
    <>
      <HeaderWallet />
      <WalletPanel />
    </>,
  );
  expect(screen.queryByRole("button")).toBeNull();
  expect(() => loadWallet()).toThrow("unavailable");
  expect(sdk).not.toHaveBeenCalled();
});
it("blocks runtime and active bridge independently", () => {
  expect(walletAllowed("telegram")).toBe(false);
  window.Telegram = { WebApp: { initData: "", platform: "android" } };
  expect(walletAllowed()).toBe(false);
  expect(() => loadWallet()).toThrow("unavailable");
  expect(sdk).not.toHaveBeenCalled();
});
