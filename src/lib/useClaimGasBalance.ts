import {useCallback, useEffect, useState} from 'react';
import {formatEther, type Eip1193Provider} from 'ethers';

type EventProvider = Eip1193Provider & {
  on?: (event: string, listener: () => void) => void;
  removeListener?: (event: string, listener: () => void) => void;
};
type BalanceResult = {status: 'ready'; balance: bigint} | {status: 'loading' | 'error' | 'wrong-network' | 'disconnected'};
type Snapshot = {provider: EventProvider; address: string; chainId: number; result: BalanceResult};

export function claimGasAmount(balance: bigint) {
  if (balance === 0n) return '0';
  if (balance < 1_000_000_000_000n) return '<0.000001';
  const [whole, fraction = ''] = formatEther(balance).split('.');
  const trimmed = fraction.slice(0, 6).replace(/0+$/, '');
  return whole + (trimmed ? '.' + trimmed : '');
}

// Read only the selected wallet's native balance on the claim network. Never
// reuse a previous wallet/network balance or present an RPC failure as zero.
export function useClaimGasBalance(provider: EventProvider | undefined, address: string | undefined, chainId: number) {
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    if (!provider || !address) return;
    let cancelled = false, sequence = 0;
    const read = async () => {
      const current = ++sequence;
      const publish = (result: BalanceResult) => {
        if (!cancelled && current === sequence) setSnapshot({provider, address, chainId, result});
      };
      try {
        const before = await provider.request({method: 'eth_chainId'});
        if (BigInt(String(before)) !== BigInt(chainId)) {
          publish({status: 'wrong-network'});
          return;
        }
        const raw = await provider.request({method: 'eth_getBalance', params: [address, 'latest']});
        const after = await provider.request({method: 'eth_chainId'});
        if (BigInt(String(after)) !== BigInt(chainId)) {
          publish({status: 'wrong-network'});
          return;
        }
        if (typeof raw !== 'string' || !/^0x[0-9a-f]+$/i.test(raw)) throw new Error('Invalid balance response');
        publish({status: 'ready', balance: BigInt(raw)});
      } catch {
        publish({status: 'error'});
      }
    };
    const changed = () => {setSnapshot(undefined); void read();};
    const visible = () => {if (document.visibilityState === 'visible') void read();};
    provider.on?.('chainChanged', changed);
    provider.on?.('accountsChanged', changed);
    window.addEventListener('focus', visible);
    document.addEventListener('visibilitychange', visible);
    const timer = window.setInterval(visible, 15000);
    void read();
    return () => {
      cancelled = true;
      provider.removeListener?.('chainChanged', changed);
      provider.removeListener?.('accountsChanged', changed);
      window.removeEventListener('focus', visible);
      document.removeEventListener('visibilitychange', visible);
      window.clearInterval(timer);
    };
  }, [provider, address, chainId, revision]);
  const state: BalanceResult = !provider || !address ? {status: 'disconnected'}
    : snapshot?.provider === provider && snapshot.address === address && snapshot.chainId === chainId
      ? snapshot.result : {status: 'loading'};
  return {state, refresh};
}
