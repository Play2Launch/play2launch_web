import type {Execute} from '@relayprotocol/relay-sdk';
export const nativeETH = '0x0000000000000000000000000000000000000000';
const sourceIds = new Set([1, 10, 8453, 42161]);
export function gasSourceChains<T extends {id: number; currency: {symbol: string; decimals: number}}>(chains: T[]) {
  return chains.filter(c => sourceIds.has(c.id) && c.currency.symbol === 'ETH' && c.currency.decimals === 18);
}
export function assertGasQuote(quote: Execute, source: number, address: string, amount: bigint) {
  const input = quote.details?.currencyIn, output = quote.details?.currencyOut;
  if (!sourceIds.has(source) || input?.currency?.chainId !== source || input.currency.address?.toLowerCase() !== nativeETH || input.currency.decimals !== 18 || input.amount !== amount.toString()
    || output?.currency?.chainId !== 4663 || output.currency.address?.toLowerCase() !== nativeETH || output.currency.decimals !== 18
    || quote.details?.recipient?.toLowerCase() !== address.toLowerCase() || !output.amount || BigInt(output.amount) <= 0n
    || !quote.steps?.length || quote.steps.some(step => step.kind !== 'transaction' || !step.items?.length || step.items.some(item => {
      const tx = item.data as {chainId?: number; from?: string} | undefined;
      return !tx || tx.chainId !== source || tx.from?.toLowerCase() !== address.toLowerCase();
    }))) throw new Error('Only native ETH transfers to your wallet on Robinhood Chain are supported.');
}
