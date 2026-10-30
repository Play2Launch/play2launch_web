import type {Execute} from '@relayprotocol/relay-sdk';
export const nativeETH = '0x0000000000000000000000000000000000000000';
const sourceIds = new Set([1, 10, 56, 130, 137, 324, 5000, 8453, 42161, 43114, 57073, 59144, 534352]);
export function gasSourceChains<T extends {id: number}>(chains: T[]) {
  return chains.filter(c => sourceIds.has(c.id));
}
export function assertGasQuote(quote: Execute, source: number, address: string, amount: bigint, token: string, decimals: number) {
  const input = quote.details?.currencyIn, output = quote.details?.currencyOut;
  if (!sourceIds.has(source) || input?.currency?.chainId !== source || input.currency.address?.toLowerCase() !== token.toLowerCase() || input.currency.decimals !== decimals || input.amount !== amount.toString()
    || output?.currency?.chainId !== 4663 || output.currency.address?.toLowerCase() !== nativeETH || output.currency.decimals !== 18
    || quote.details?.recipient?.toLowerCase() !== address.toLowerCase() || !output.amount || BigInt(output.amount) <= 0n
    || !quote.steps?.length || quote.steps.some(step => step.kind !== 'transaction' || !step.items?.length || step.items.some(item => {
      const tx = item.data as {chainId?: number; from?: string} | undefined;
      return !tx || tx.chainId !== source || tx.from?.toLowerCase() !== address.toLowerCase();
    }))) throw new Error('The quote must use your selected source asset and deliver native ETH to your wallet on Robinhood Chain.');
}
