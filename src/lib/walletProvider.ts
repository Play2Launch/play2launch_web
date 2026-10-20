import type { Eip1193Provider } from 'ethers';

const wrapped = new WeakMap<object, Eip1193Provider>();
function chainNumber(value: unknown): bigint | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return;
  try { return BigInt(value); } catch { return; }
}

// AppKit's ethers adapter compares eth_chainId (hex) to a numeric chain ID.
// Avoid asking an injected wallet to switch to the network it is already on.
// A real network change still goes through the wallet's normal approval flow.
export function stableWalletProvider<T extends Eip1193Provider>(provider: T): T {
  const previous = wrapped.get(provider);
  if (previous) return previous as T;
  const request: Eip1193Provider['request'] = async (args) => {
    if (args.method === 'wallet_switchEthereumChain' && Array.isArray(args.params)) {
      const target = chainNumber(args.params[0]?.chainId);
      if (target !== undefined) {
        const current = await provider.request({ method: 'eth_chainId' });
        if (chainNumber(current) === target) return null;
      }
    }
    return provider.request(args);
  };
  const proxy = new Proxy(provider, {
    get(target, property) {
      if (property === 'request') return request;
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  wrapped.set(provider, proxy);
  wrapped.set(proxy, proxy);
  return proxy;
}
