// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
const mocks = vi.hoisted(() => ({
  account: {
    address: "0x" + "1".repeat(40),
    isConnected: true,
    status: "connected",
  },
  chainId: 4663,
  open: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn().mockResolvedValue(undefined),
  switchNetwork: vi.fn().mockResolvedValue(undefined),
  create: vi.fn(),
  cachedChain: vi.fn().mockReturnValue(4663),
  selectNetwork: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@reown/appkit/react", () => ({
  createAppKit: (...args: unknown[]) => { mocks.create(...args); return {ready:async()=>{},getAddress:()=>mocks.account.isConnected?mocks.account.address:undefined,getCaipNetworkId: mocks.cachedChain, switchNetwork:mocks.selectNetwork, open:mocks.open}; },
  useAppKit: () => ({ open: mocks.open }),
  useAppKitAccount: () => mocks.account,
  useAppKitNetwork: () => ({
    chainId: mocks.chainId,
    switchNetwork: mocks.switchNetwork,
  }),
  useDisconnect: () => ({ disconnect: mocks.disconnect }),
  useAppKitProvider: () => ({ walletProvider: undefined }),
}));
vi.mock("@reown/appkit-adapter-ethers", () => ({ EthersAdapter: class {} }));
vi.mock("@reown/appkit/networks", () => ({ defineChain: (v: unknown) => v }));
vi.mock("../lib/walletConfig", async original => ({
  ...await original<typeof import("../lib/walletConfig")>(),
  walletConfiguration: () => ({
    projectId: "a".repeat(32),
    chain: { id: 4663, name: "Robinhood Chain" },
  }),
}));
import { WalletSession, WalletButton, openWallet } from "./WalletSession";
it('reconciles a stale cached network before opening the connector', async () => {
  mocks.account.isConnected=false;
  mocks.cachedChain.mockReturnValueOnce(46630);
  await openWallet();
  expect(mocks.selectNetwork).toHaveBeenCalledWith(expect.objectContaining({id:4663}),{throwOnFailure:true});
  expect(mocks.open).toHaveBeenLastCalledWith({view:'Connect',namespace:'eip155'});
});
afterEach(()=>{cleanup();mocks.chainId=4663;mocks.account.isConnected=true;mocks.account.status='connected';mocks.switchNetwork.mockClear();});
it("shows the configured chain only when connected to it and allows retry after rejection",async()=>{
 const view=render(<WalletButton/>);
 expect(screen.getByText('Robinhood Chain')).toBeTruthy();
 expect(mocks.create.mock.calls[0][0].enableNetworkSwitch).toBe(true);
 expect(mocks.switchNetwork).not.toHaveBeenCalled();
 mocks.chainId=1;view.rerender(<WalletButton/>);
 expect(screen.queryByText('Robinhood Chain')).toBeNull();
 mocks.switchNetwork.mockRejectedValueOnce(new Error('rejected'));
 fireEvent.click(screen.getByRole('button',{name:'Switch to Robinhood Chain'}));
 await screen.findByRole('alert');
 fireEvent.click(screen.getByRole('button',{name:'Switch to Robinhood Chain'}));
 await waitFor(()=>expect(mocks.switchNetwork).toHaveBeenCalledTimes(2));
 expect(mocks.switchNetwork).toHaveBeenLastCalledWith(expect.objectContaining({id:4663}));
 mocks.chainId=4663;view.rerender(<WalletButton/>);
 expect(screen.getByText('Robinhood Chain')).toBeTruthy();
});
it("keeps header address and disconnected label in sync", async () => {
  const view = render(<WalletButton />);
  const button=screen.getByRole("button", { name: "0x1111…1111 Robinhood Chain" });
  expect(button.contains(screen.getByText("Robinhood Chain"))).toBe(true);
  fireEvent.click(button);
  await waitFor(() =>
    expect(mocks.open).toHaveBeenCalledWith({
      view: "Account",
      namespace: "eip155",
    }),
  );
  mocks.account.isConnected = false;
  mocks.account.status = "disconnected";
  view.rerender(<WalletButton />);
  expect(screen.getByRole("button", { name: "Connect Wallet" })).toBeTruthy();
  mocks.account.isConnected = true;
  mocks.account.status = "connected";
});
it("shows actual account, handles network mismatch and disconnects without signing", async () => {
  const view = render(<WalletSession />);
  expect(
    (
      screen.getByRole("textbox", {
        name: "Connected wallet address",
      }) as HTMLInputElement
    ).value,
  ).toBe(mocks.account.address);
  mocks.chainId = 1;
  view.rerender(<WalletSession />);
  fireEvent.click(
    screen.getByRole("button", { name: "Switch to Robinhood Chain" }),
  );
  await waitFor(() => expect(mocks.switchNetwork).toHaveBeenCalled());
  await waitFor(() =>
    expect(
      (
        screen.getByRole("button", {
          name: "Disconnect wallet",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false),
  );
  fireEvent.click(screen.getByRole("button", { name: "Disconnect wallet" }));
  await waitFor(() =>
    expect(mocks.disconnect).toHaveBeenCalledWith({ namespace: "eip155" }),
  );
  expect(mocks.create.mock.calls[0][0].features).toMatchObject({
    analytics: false,
    email: false,
    socials: false,
    send: false,
    swaps: false,
    onramp: false,
  });
});

it('uses the campaign network instead of the global default',async()=>{
 render(<WalletButton targetChainId={1}/>);
 fireEvent.click(screen.getByRole('button',{name:'Switch to Ethereum'}));
 await waitFor(()=>expect(mocks.switchNetwork).toHaveBeenCalledWith(expect.objectContaining({id:1})));
});

it('opens the restored account rather than adding the same wallet again',async()=>{
 mocks.account.isConnected=true; mocks.open.mockClear(); mocks.selectNetwork.mockClear();
 await openWallet();
 expect(mocks.open).toHaveBeenCalledWith({view:'Account',namespace:'eip155'});
 expect(mocks.selectNetwork).not.toHaveBeenCalled();
});
