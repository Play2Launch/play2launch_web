import { describe, it, expect, vi } from "vitest";
import { parseCents, rebateCents, validatePurchase, walletSigner } from "./ido";
describe("IDO amounts and rebate boundaries", () => {
  it("uses integer cents and rejects ambiguous precision", () => {
    expect(parseCents("100.01")).toBe(10001n);
    expect(parseCents("0.01")).toBe(1n);
    for (const s of ["1e3", "100.001", "-1", "Infinity", "1,000", ".5", ""])
      expect(() => parseCents(s)).toThrow();
  });
  it("enforces first purchase, incremental cents, total cap and hard cap", () => {
    expect(() => validatePurchase(9999n, 0n, 0n, 5000000n)).toThrow();
    expect(() => validatePurchase(1n, 10000n, 10000n, 5000000n)).not.toThrow();
    expect(() => validatePurchase(1n, 100000n, 100000n, 5000000n)).toThrow();
    expect(() => validatePurchase(10000n, 0n, 4990001n, 5000000n)).toThrow();
  });
  it("never reuses the score allowance when a user adds funds", () => {
    expect(rebateCents(1000, 10000n)).toBe(1000n);
    expect(rebateCents(1000, 20000n)).toBe(1000n);
    expect(rebateCents(20000, 10001n)).toBe(2000n);
    expect(rebateCents(40000, 100000n)).toBe(20000n);
  });
});
it('rejects an actual wrong wallet chain before requesting a signer or sending a transaction', async () => {
 const request=vi.fn(async ({method}:{method:string}) => {
  if(method==='eth_chainId') return '0x1';
  throw new Error('Unexpected wallet request: '+method);
 });
 await expect(walletSigner({request},{configured:true,chain_id:46630,contract:'0x'+'1'.repeat(40),rpc_url:'',explorer_url:''},'0x'+'2'.repeat(40))).rejects.toThrow('Switch your wallet');
 expect(request.mock.calls.every(([args])=>args.method==='eth_chainId')).toBe(true);
});
