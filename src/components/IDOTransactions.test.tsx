// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { IDOState } from "../lib/ido";
const mocks = vi.hoisted(() => ({ read: vi.fn(), auth: vi.fn(), signer: vi.fn() }));
vi.mock("../lib/ido", async (original) => ({
  ...(await original<typeof import("../lib/ido")>()),
  readIDO: mocks.read,
  walletSigner: mocks.signer,
}));
vi.mock("../lib/api", () => ({ api: { authenticated: mocks.auth } }));
vi.mock("./RelayPaymentSwap", () => ({
  default: () => <div role="dialog" aria-label="Payment swap"><input aria-label="Swap amount" defaultValue="" /></div>,
}));
import { IDOTransactions } from "./IDOTransactions";
const config = {
  configured: true,
  chain_id: 46630,
  contract: "0x" + "1".repeat(40),
  rpc_url: "https://rpc.example",
  explorer_url: "https://explorer.example",
};
const wallet = "0x" + "2".repeat(40);
const state = () =>
  ({
    account: {
      userId: "0x123",
      paidCents: 10000n,
      rebateCents: 1000n,
      claimedTokens: 0n,
      rebateClaimed: false,
      refunded: false,
    },
    sale: { start: 1n, end: 9999999999n, hardCapCents: 5000000n },
    vesting: { start: 1n, initialBps: 1000n, duration: 60n, cliff: 0n, interval: 10n },
    phase: 0,
    blocked: false,
    paused: false,
    now: 100,
    raised: 10000n,
    vested: 0n,
    allocation: 10000n * 10n ** 18n,
    tokenBalance: 0n,
    tokenSymbol: "PHOOD",
  }) as unknown as IDOState;
beforeEach(() => {
  mocks.auth.mockResolvedValue({ caught_up: true, items: [] });
});
it("distinguishes allocation, claims and transferred wallet holdings", async () => {
  const s = state();
  s.phase = 1;
  s.vested = 4000n * 10n ** 18n;
  s.account.claimedTokens = 1000n * 10n ** 18n;
  s.tokenBalance = 750n * 10n ** 18n;
  mocks.read.mockResolvedValue(s);
  render(<IDOTransactions slug="combo" config={config} onRefresh={() => {}} address={wallet} chainId={46630} />);
  await screen.findByText("Your PHOOD balance");
  for (const value of ["10,000", "1,000", "6,000", "3,000", "750 PHOOD"]) {
    expect(screen.getByText(value)).toBeTruthy();
  }
});
it("keeps claims disabled until identity is verified and when another account uses the wallet", async () => {
  const s = state(); s.phase = 1; s.vested = 1000n;
  mocks.read.mockResolvedValue(s);
  const props = { slug:"combo", config, onRefresh:vi.fn(), address:wallet, chainId:46630 };
  const view = render(<IDOTransactions {...props} />);
  await screen.findByRole("button", {name:"Claim tokens"});
  const disabled = () => expect((screen.getByRole("button", {name:"Claim tokens"}) as HTMLButtonElement).disabled).toBe(true);
  disabled();
  view.rerender(<IDOTransactions {...props} eligibility={{user_id:"0x123",eligible:true,highest_score:1000}} />);
  await waitFor(() => expect((screen.getByRole("button", {name:"Claim tokens"}) as HTMLButtonElement).disabled).toBe(false));
  view.rerender(<IDOTransactions {...props} eligibility={{user_id:"0x456",eligible:true,highest_score:1000}} />);
  await screen.findByText(/different P2L account/); disabled();
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it("preserves the open swap and input when the wallet switches to the source chain", async () => {
  const s = state();
  s.payment = "0x" + "3".repeat(40);
  s.paymentSymbol = "USDG";
  mocks.read.mockResolvedValue(s);
  const props = {
    slug: "combo", config, address: wallet, chainId: 46630,
    provider: { request: vi.fn() }, onRefresh: vi.fn(),
    eligibility: { eligible: true, highest_score: 1000, user_id: "0x123" },
  };
  const view = render(<IDOTransactions {...props} />);
  fireEvent.click(await screen.findByRole("button", { name: /Get USDG/ }));
  const dialog = await screen.findByRole("dialog", { name: "Payment swap" });
  fireEvent.change(screen.getByLabelText("Swap amount"), { target: { value: "100" } });
  const reads = mocks.read.mock.calls.length;
  view.rerender(<IDOTransactions {...props} chainId={56} />);
  expect(screen.getByRole("dialog", { name: "Payment swap" })).toBe(dialog);
  expect((screen.getByLabelText("Swap amount") as HTMLInputElement).value).toBe("100");
  expect(mocks.read).toHaveBeenCalledTimes(reads);
  expect((screen.getByRole("button", { name: "Add subscription" }) as HTMLButtonElement).disabled).toBe(true);
});
it("places subscription controls in the token card with only one balance and get-token action", async () => {
  const s = state();
  s.paymentSymbol = "USDG";
  s.paymentBalance = 100000000n;
  mocks.read.mockResolvedValue(s);
  const balance = document.createElement("div");
  const subscription = document.createElement("div");
  document.body.append(balance, subscription);
  try {
    render(<IDOTransactions slug="combo" config={config} address={wallet} chainId={46630}
      provider={{request: vi.fn()}} onRefresh={vi.fn()}
      paymentBalanceTarget={balance} subscriptionTarget={subscription} />);
    const input = await screen.findByLabelText("Subscription amount");
    expect(subscription.contains(input)).toBe(true);
    expect(subscription.contains(screen.getByRole("button", {name: "Refresh balances"}))).toBe(true);
    expect(screen.getAllByRole("button", {name: /Get USDG/})).toHaveLength(1);
    expect(balance.contains(screen.getByRole("button", {name: /Get USDG/}))).toBe(true);
    expect(screen.queryByText(/Available balance:/)).toBeNull();
  } finally {
    cleanup();
    balance.remove();
    subscription.remove();
  }
});
it("catches up multiple history batches and stops once synchronized", async () => {
  mocks.read.mockResolvedValue(state());
  mocks.auth.mockResolvedValueOnce({ caught_up: false, items: [] })
    .mockResolvedValue({ caught_up: true, items: [{ hash: "0xabc", event: "Subscribed" }] });
  render(<IDOTransactions slug="combo" config={config} onRefresh={() => {}} address={wallet} chainId={46630} />);
  await screen.findByText("Transaction history");
  expect(mocks.auth).toHaveBeenCalledTimes(2);
  expect(screen.queryByText(/still syncing/)).toBeNull();
});
it("bounds history catch-up requests when the chain remains behind", async () => {
  mocks.read.mockResolvedValue(state());
  mocks.auth.mockResolvedValue({ caught_up: false, items: [] });
  render(<IDOTransactions slug="combo" config={config} onRefresh={() => {}} address={wallet} chainId={46630} />);
  await screen.findByText(/Refresh to continue/);
  expect(mocks.auth).toHaveBeenCalledTimes(10);
});
it("disables subscribing on the wrong network and prevents another account using a bound wallet", async () => {
  mocks.read.mockResolvedValue(state());
  const props = {
    slug: "combo",
    config,
    eligibility: { eligible: true, highest_score: 1000, user_id: "0x123" },
    onRefresh: vi.fn(),
    address: wallet,
    chainId: 1,
  };
  const view = render(<IDOTransactions {...props} />);
  await screen.findByText("$100.00");
  expect(
    (
      screen.getByRole("button", {
        name: "Add subscription",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  view.rerender(
    <IDOTransactions
      {...props}
      chainId={46630}
      eligibility={{ ...props.eligibility, user_id: "0x456" }}
      currentAccountEmail="ttkuraki@live.com"
    />,
  );
  await screen.findByText(/different P2L account/);
  expect(screen.getByText("ttk***@live.com")).toBeTruthy();
  expect(screen.queryByText("ttkuraki@live.com")).toBeNull();
  expect(screen.getByText(`${wallet.slice(0, 6)}…${wallet.slice(-4)}`)).toBeTruthy();
  expect(
    (
      screen.getByRole("button", {
        name: "Add subscription",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
});
it("only shows the refund action in the refund phase and disables a completed refund", async () => {
  const s = state();
  s.phase = 2;
  s.account.refunded = true;
  mocks.read.mockResolvedValue(s);
  render(
    <IDOTransactions
      slug="combo"
      config={config}
      onRefresh={() => {}}
      address={wallet}
      chainId={46630}
    />,
  );
  await waitFor(() =>
    expect(
      (
        screen.getByRole("button", {
          name: "Refund claimed",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true),
  );
  expect(screen.queryByRole("button", { name: "Claim rebate" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Subscribe" })).toBeNull();
});

it("blocks a different wallet even when that wallet has no purchases", async () => {
  const s = state();
  s.account.paidCents = 0n;
  mocks.read.mockResolvedValue({ ...s, boundWallet: "0x9999999999999999999999999999999999999999" });
  render(<IDOTransactions slug="combo" config={config} eligibility={{ eligible: true, highest_score: 1500, user_id: "0x123" }} currentAccountEmail="ttkuraki@live.com" onRefresh={() => {}} address={wallet} chainId={46630} />);
  await screen.findByText(/This P2L account already subscribed with a different wallet/);
  expect((screen.getByRole("button", { name: "Subscribe" }) as HTMLButtonElement).disabled).toBe(true);
  expect(mocks.read).toHaveBeenCalledWith(config, wallet, "0x123");
});

it.each([1, 2])("blocks all claims on a wrong network and recovers after switching back (phase %s)", async (phase) => {
  const s = state(); s.phase = phase; s.vested = 1000n;
  mocks.read.mockResolvedValue(s);
  const props = {slug:"combo", config, onRefresh:vi.fn(), address:wallet,
    eligibility:{user_id:"0x123", eligible:true, highest_score:1000}};
  const view = render(<IDOTransactions {...props} chainId={46630} />);
  const name = phase === 2 ? "Claim $100.00 refund" : "Claim tokens";
  await waitFor(() => expect((screen.getByRole("button", {name}) as HTMLButtonElement).disabled).toBe(false));
  view.rerender(<IDOTransactions {...props} chainId={1} />);
  await screen.findByText(/Switch your wallet to chain/);
  await waitFor(() => expect((screen.getByRole("button", {name}) as HTMLButtonElement).disabled).toBe(true));
  view.rerender(<IDOTransactions {...props} chainId={46630} />);
  await waitFor(() => expect((screen.getByRole("button", {name}) as HTMLButtonElement).disabled).toBe(false));
  view.rerender(<IDOTransactions {...props} chainId={46630} eligibility={{...props.eligibility,user_id:"0x456"}} />);
  await screen.findByText(/different P2L account/);
  expect((screen.getByRole("button", {name}) as HTMLButtonElement).disabled).toBe(true);
});

it.each(['account', 'wallet', 'network'])('abandons a pending wallet operation after changing %s', async (change) => {
 const s=state();s.phase=2;mocks.read.mockResolvedValue(s);
 let release: (value: unknown) => void = () => {};
 mocks.signer.mockImplementationOnce(()=>new Promise(resolve=>{release=resolve;}));
 const request=vi.fn();
 const props={slug:'combo',config,onRefresh:vi.fn(),address:wallet,chainId:46630,provider:{request},eligibility:{user_id:'0x123',eligible:true,highest_score:1000}};
 const view=render(<IDOTransactions {...props}/>);
 const button=await screen.findByRole('button',{name:'Claim $100.00 refund'});
 fireEvent.click(button);
 await waitFor(()=>expect(mocks.signer).toHaveBeenCalledTimes(1));
 view.rerender(<IDOTransactions {...props} address={change==='wallet'?'0x'+'3'.repeat(40):wallet} chainId={change==='network'?1:46630} eligibility={{...props.eligibility,user_id:change==='account'?'0x456':'0x123'}}/>);
 await act(async()=>release({}));
 expect(request).not.toHaveBeenCalled();
 expect(props.onRefresh).not.toHaveBeenCalled();
 expect(screen.queryByText(/Transaction submitted/)).toBeNull();
});
it("opens the game instead of a wallet transaction when no valid score exists", async () => {
  mocks.read.mockResolvedValue(state());
  const onPlay = vi.fn();
  render(<IDOTransactions slug="combo" config={config} eligibility={{eligible:false,highest_score:0,user_id:"0x123"}} onRefresh={() => {}} onPlay={onPlay} address={wallet} chainId={46630} />);
  const button = await screen.findByRole("button", {name:/Play a game to subscribe/});
  expect((button as HTMLButtonElement).disabled).toBe(false);
  expect(screen.getByText(/No valid game score yet/)).toBeTruthy();
  fireEvent.click(button);
  expect(onPlay).toHaveBeenCalledTimes(1);
  expect(mocks.signer).not.toHaveBeenCalled();
});
it('shows both vesting allocations but keeps one token claim action',async()=>{
 const s=state();s.phase=1;s.now=150;s.vesting={start:100n,cliff:0n,duration:90n,interval:1n,initialBps:3000n,rebateCliff:30n,rebateDuration:90n,rebateInterval:1n};s.splitVesting={base:8000n*10n**18n,rebate:2000n*10n**18n,baseVested:4000n*10n**18n,rebateVested:100n*10n**18n};s.vested=4100n*10n**18n;mocks.read.mockResolvedValue(s);
 render(<IDOTransactions slug="combo" config={config} onRefresh={()=>{}} address={wallet} chainId={46630}/>);
 await screen.findByRole('region',{name:'Base tokens'});expect(screen.getByRole('region',{name:'Rebate-backed tokens'})).toBeTruthy();expect(screen.getAllByRole('button',{name:'Claim tokens'})).toHaveLength(1);
});
