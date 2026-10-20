import { useEffect, useState } from 'react';
import type { Eip1193Provider } from 'ethers';

type EventProvider = Eip1193Provider & {
  on?: (event: string, listener: () => void) => void;
  removeListener?: (event: string, listener: () => void) => void;
};

// Connector-selected networks can lag behind changes made in a wallet extension.
export function useWalletChain(provider: EventProvider | undefined, cachedChain: unknown) {
  const [snapshot, setSnapshot] = useState<{ provider: EventProvider; cached: unknown; chain: number }>();
  useEffect(() => {
    if (!provider) return;
    let cancelled = false, sequence = 0;
    const refresh = async () => {
      const current = ++sequence;
      try {
        const raw = await provider.request({ method: 'eth_chainId' });
        const chain = Number(BigInt(String(raw)));
        if (!cancelled && current === sequence) setSnapshot({ provider, cached: cachedChain, chain });
      } catch {
        if (!cancelled && current === sequence) setSnapshot(undefined);
      }
    };
    const changed = () => { setSnapshot(undefined); void refresh(); };
    const visible = () => { if (document.visibilityState === 'visible') void refresh(); };
    provider.on?.('chainChanged', changed);
    window.addEventListener('focus', visible);
    document.addEventListener('visibilitychange', visible);
    const timer = setInterval(visible, 2000);
    void refresh();
    return () => {
      cancelled = true;
      provider.removeListener?.('chainChanged', changed);
      window.removeEventListener('focus', visible);
      document.removeEventListener('visibilitychange', visible);
      clearInterval(timer);
    };
  }, [provider, cachedChain]);
  if (!provider) return Number(cachedChain);
  return snapshot?.provider === provider && snapshot.cached === cachedChain ? snapshot.chain : undefined;
}
