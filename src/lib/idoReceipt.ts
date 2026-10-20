import {JsonRpcProvider, type TransactionReceipt} from 'ethers';
import type {IDOConfig} from './ido';

type PendingTransaction = {hash:string;wait:(confirmations?:number)=>Promise<TransactionReceipt|null>};
export async function waitForIDOReceipt(tx:PendingTransaction, config:IDOConfig, confirmations=1) {
  try {
    const receipt = await tx.wait(confirmations);
    if (!receipt || receipt.status !== 1) throw new Error('Transaction did not succeed.');
    return receipt;
  } catch (error) {
    const e = error as {payload?:{method?:string};code?:string};
    // Preserve reverts, cancellations and replacement handling from ethers.
    if (e?.payload?.method !== 'eth_getTransactionReceipt') throw error;
  }
  const rpc = new JsonRpcProvider(config.rpc_url);
  try {
    const deadline = Date.now() + 120_000;
    if (Number((await rpc.getNetwork()).chainId) !== config.chain_id)
      throw new Error('The confirmation RPC is on a different network.');
    while (Date.now() < deadline) {
      let receipt:TransactionReceipt|null = null;
      let block = 0;
      try {
        receipt = await rpc.getTransactionReceipt(tx.hash);
        if (receipt) block = await rpc.getBlockNumber();
      } catch {
        // A temporary read failure must never resend the transaction.
      }
      if (receipt?.status === 0) throw new Error('Transaction reverted on chain.');
      if (receipt?.status === 1 && block - receipt.blockNumber + 1 >= confirmations) return receipt;
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
    throw new Error('Transaction submitted, but confirmation is taking longer than expected. Check the transaction link before trying again.');
  } catch (error) {
    if (error instanceof Error && !('code' in error)) throw error;
    throw new Error('Transaction submitted, but its status could not be checked. Check the transaction link before trying again.');
  } finally {
    rpc.destroy();
  }
}
