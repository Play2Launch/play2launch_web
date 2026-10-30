// @vitest-environment jsdom
import {act, cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {parseEther} from 'ethers';
import {AirdropActions} from './AirdropActions';

const mocks = vi.hoisted(() => ({authenticated: vi.fn(), getBalance: vi.fn(), signMessage: vi.fn(), claim: vi.fn(), refresh: vi.fn()}));
vi.mock('../lib/api', () => ({api: {authenticated: mocks.authenticated}}));
vi.mock('./RelayPaymentSwap', () => ({default: (props: {purpose:string;payment:string;symbol:string;config:{chain_id:number};onComplete:()=>void;onClose:()=>void}) => <div role="dialog" aria-label="ETH gas bridge"><span>{props.purpose}:{props.payment}:{props.symbol}:{props.config.chain_id}</span><button onClick={()=>{props.onComplete();props.onClose();}}>Finish bridge</button></div>}));
vi.mock('ethers', async original => ({
  ...await original<typeof import('ethers')>(),
  BrowserProvider: class {
    getNetwork = async () => ({chainId: 4663n});
    getBalance = mocks.getBalance;
    getSigner = async () => ({getAddress: async () => wallet, address: wallet, signMessage: mocks.signMessage});
  },
  Contract: class {claim = mocks.claim;},
}));
const wallet = '0x' + '1'.repeat(40);
const secondWallet = '0x' + '2'.repeat(40);
const entry = {wallet: '', claim_id: 'claim', amount: '123'};
const data = {settings: {chain_id: 4663, contract: '0x' + '3'.repeat(40)}, network: {name: 'Robinhood Chain', explorer_url: 'https://example.com'}};
function providerFixture() {
  let balance = '0x' + parseEther('0.0005').toString(16), chain = '0x1237';
  const listeners = new Map<string, () => void>();
  const provider = {
    request: vi.fn(async ({method}: {method: string}): Promise<unknown> => {
      if (method === 'eth_chainId') return chain;
      if (method === 'eth_getBalance') return balance;
      throw new Error('Unexpected wallet request');
    }),
    on: vi.fn((event: string, listener: () => void) => {listeners.set(event, listener);}),
    removeListener: vi.fn(),
  };
  return {provider, setBalance: (value: bigint) => {balance = '0x' + value.toString(16);}, setChain: (value: string) => {chain = value;}, changed: () => listeners.get('chainChanged')?.()};
}
function props(provider: ReturnType<typeof providerFixture>['provider']) {
  return {provider, address: wallet, data, entry, slug: 'phood', refresh: mocks.refresh};
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.getBalance.mockResolvedValue(parseEther('0.0005'));
  mocks.signMessage.mockResolvedValue('signature');
  mocks.authenticated.mockImplementation(async (path: string) => path.endsWith('/challenge') ? {message: 'Bind wallet'} : path.endsWith('/credential') ? {entry: {...entry, wallet, proof: []}, expires: 1, signature: 'ticket'} : {});
  mocks.claim.mockResolvedValue({hash: '0xabc', wait: async () => {}});
  mocks.refresh.mockResolvedValue(undefined);
});
afterEach(cleanup);

it('shows native ETH on the claim network without requesting a signature', async () => {
  const {provider} = providerFixture();
  render(<AirdropActions {...props(provider)}/>);
  expect(await screen.findByText('0.0005 ETH')).toBeTruthy();
  expect(screen.getByText('Gas balance · Robinhood Chain')).toBeTruthy();
  expect(screen.getByRole('button', {name: 'Bind wallet and claim all'}).hasAttribute('disabled')).toBe(false);
  expect(mocks.authenticated).not.toHaveBeenCalled();
  expect(mocks.signMessage).not.toHaveBeenCalled();
});

it('blocks a zero balance and enables claiming after a funded balance is refreshed', async () => {
  const fixture = providerFixture();
  fixture.setBalance(0n);
  render(<AirdropActions {...props(fixture.provider)}/>);
  expect(await screen.findByText('0 ETH')).toBeTruthy();
  const claim = screen.getByRole('button', {name: 'Bind wallet and claim all'});
  expect(claim.hasAttribute('disabled')).toBe(true);
  expect(screen.getByRole('alert').textContent).toContain('Add ETH to this wallet');
  fireEvent.click(claim);
  expect(mocks.authenticated).not.toHaveBeenCalled();
  fixture.setBalance(parseEther('0.0002'));
  fireEvent.click(screen.getByRole('button', {name: 'Refresh balance'}));
  expect(await screen.findByText('0.0002 ETH')).toBeTruthy();
  expect(claim.hasAttribute('disabled')).toBe(false);
});

it('does not display another network balance and updates after a chain change', async () => {
  const fixture = providerFixture();
  fixture.setChain('0x1');
  render(<AirdropActions {...props(fixture.provider)}/>);
  await screen.findByText('Switch to Robinhood Chain to check your ETH balance.');
  expect(fixture.provider.request.mock.calls.some(([args]) => args.method === 'eth_getBalance')).toBe(false);
  expect(screen.getByRole('button', {name: 'Bind wallet and claim all'}).hasAttribute('disabled')).toBe(true);
  act(() => {fixture.setChain('0x1237'); fixture.changed();});
  expect(await screen.findByText('0.0005 ETH')).toBeTruthy();
});

it('shows unavailable rather than zero after a failed balance read', async () => {
  const {provider} = providerFixture();
  provider.request.mockRejectedValueOnce(new Error('RPC offline'));
  render(<AirdropActions {...props(provider)}/>);
  await screen.findByText('Unable to load ETH balance. Refresh to try again.');
  expect(screen.queryByText('0 ETH')).toBeNull();
  expect(screen.queryByRole('alert')).toBeNull();
});

it('rejects a stale balance response after the selected wallet changes', async () => {
  const {provider} = providerFixture();
  let resolveOld: (balance: string) => void = () => {};
  provider.request.mockImplementationOnce(async () => '0x1237')
    .mockImplementationOnce(() => new Promise(resolve => {resolveOld = resolve;}));
  const view = render(<AirdropActions {...props(provider)}/>);
  await waitFor(() => expect(provider.request).toHaveBeenCalledTimes(2));
  view.rerender(<AirdropActions {...props(provider)} address={secondWallet}/>);
  await screen.findByText('0.0005 ETH');
  await act(async () => resolveOld('0x0'));
  expect(screen.queryByText('0 ETH')).toBeNull();
  expect(screen.getByText('0.0005 ETH')).toBeTruthy();
});

it('refreshes the balance when returning from the wallet app', async () => {
  const fixture = providerFixture();
  const view = render(<AirdropActions {...props(fixture.provider)}/>);
  await screen.findByText('0.0005 ETH');
  fixture.setBalance(parseEther('0.0003'));
  fireEvent(window, new Event('focus'));
  await screen.findByText('0.0003 ETH');
  view.unmount();
  expect(fixture.provider.removeListener).toHaveBeenCalledWith('chainChanged', expect.any(Function));
  expect(fixture.provider.removeListener).toHaveBeenCalledWith('accountsChanged', expect.any(Function));
});

it('does not round a small nonzero balance to zero or promise gas sufficiency', async () => {
  const fixture = providerFixture();
  fixture.setBalance(1n);
  render(<AirdropActions {...props(fixture.provider)}/>);
  expect(await screen.findByText('<0.000001 ETH')).toBeTruthy();
  expect(screen.getByText(/wallet will show the actual fee/)).toBeTruthy();
  expect(screen.getByRole('button', {name: 'Bind wallet and claim all'}).hasAttribute('disabled')).toBe(false);
});

it('rechecks ETH before binding and stops before signing when funds are gone', async () => {
  const {provider} = providerFixture();
  mocks.getBalance.mockResolvedValue(0n);
  render(<AirdropActions {...props(provider)}/>);
  await screen.findByText('0.0005 ETH');
  fireEvent.click(screen.getByRole('button', {name: 'Bind wallet and claim all'}));
  expect((await screen.findByRole('alert')).textContent).toContain('You need ETH on Robinhood Chain');
  expect(mocks.authenticated).not.toHaveBeenCalled();
  expect(mocks.signMessage).not.toHaveBeenCalled();
  expect(mocks.claim).not.toHaveBeenCalled();
});

it('continues the normal claim flow and refreshes ETH after confirmation', async () => {
  const fixture = providerFixture();
  mocks.claim.mockImplementation(async () => ({hash: '0xabc', wait: async () => {fixture.setBalance(parseEther('0.0004'));}}));
  render(<AirdropActions {...props(fixture.provider)}/>);
  await screen.findByText('0.0005 ETH');
  fireEvent.click(screen.getByRole('button', {name: 'Bind wallet and claim all'}));
  await screen.findByText('0.0004 ETH');
  expect(mocks.claim).toHaveBeenCalledWith('claim', '123', 1, [], 'ticket');
  expect(mocks.refresh).toHaveBeenCalledOnce();
});

it('opens an ETH-only top-up with zero gas and does not automatically claim afterward', async () => {
  const fixture = providerFixture();
  fixture.setBalance(0n);
  render(<AirdropActions {...props(fixture.provider)}/>);
  await screen.findByText('0 ETH');
  fireEvent.click(screen.getByRole('button',{name:'Add ETH via Relay'}));
  const dialog = await screen.findByRole('dialog',{name:'ETH gas bridge'});
  expect(dialog.textContent).toContain('airdrop-gas:0x0000000000000000000000000000000000000000:ETH:4663');
  fixture.setBalance(parseEther('0.0005'));
  fireEvent.click(screen.getByRole('button',{name:'Finish bridge'}));
  await screen.findByText('0.0005 ETH');
  expect(mocks.claim).not.toHaveBeenCalled();
  expect(mocks.signMessage).not.toHaveBeenCalled();
});

it('does not offer a mainnet ETH bridge on an airdrop testnet', async () => {
  const {provider}=providerFixture();
  render(<AirdropActions {...props(provider)} data={{...data,settings:{...data.settings,chain_id:46630}}}/>);
  await screen.findByText('Switch to Robinhood Chain to check your ETH balance.');
  expect(screen.queryByRole('button',{name:'Add ETH via Relay'})).toBeNull();
});
