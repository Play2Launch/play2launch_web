import {expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({balance:vi.fn(),token:vi.fn(),destroy:vi.fn()}));
vi.mock('ethers',async importOriginal=>({...await importOriginal<typeof import('ethers')>(),JsonRpcProvider:class{getNetwork(){return Promise.resolve({chainId:56n})}getBalance=mocks.balance;destroy=mocks.destroy},Contract:class{balanceOf=mocks.token}}));
import {checkSwapBalance,requiredSwapFunds} from './relayBalance';
const input={rpc:'https://example.org',chainId:56,address:'0x1',token:'0x2',decimals:6,symbol:'USDT',nativeSymbol:'BNB',amount:100000000n,gas:1000n};
it('blocks insufficient source tokens and releases RPC resources',async()=>{mocks.balance.mockResolvedValue(10000n);mocks.token.mockResolvedValue(20000000n);await expect(checkSwapBalance(input)).rejects.toThrow('short by 80.0 USDT');expect(mocks.destroy).toHaveBeenCalled()});
it('blocks insufficient native gas even with sufficient tokens',async()=>{mocks.balance.mockResolvedValue(0n);mocks.token.mockResolvedValue(100000000n);await expect(checkSwapBalance(input)).rejects.toThrow('Insufficient BNB')});
it('accepts exact token balance with enough gas',async()=>{mocks.balance.mockResolvedValue(1000n);mocks.token.mockResolvedValue(100000000n);await expect(checkSwapBalance(input)).resolves.toBe('100.0 USDT')});
it('includes native input and fees without counting input twice',()=>{expect(requiredSwapFunds(100n,true,5n,100n).native).toBe(105n);expect(requiredSwapFunds(100n,true,5n,110n).native).toBe(115n)});
