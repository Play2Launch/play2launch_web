import {afterEach,expect,it,vi} from 'vitest';
const rpc=vi.hoisted(()=>({getNetwork:vi.fn(),getTransactionReceipt:vi.fn(),getBlockNumber:vi.fn(),destroy:vi.fn()}));
vi.mock('ethers',()=>({JsonRpcProvider:vi.fn(function(){return rpc;})}));
import {waitForIDOReceipt} from './idoReceipt';
import type {IDOConfig} from './ido';
const config={rpc_url:'https://rpc.example',chain_id:4663} as IDOConfig;
const failure={code:'UNKNOWN_ERROR',payload:{method:'eth_getTransactionReceipt'},error:{code:-32603}};
const receipt={status:1,blockNumber:100} as any;
afterEach(()=>{vi.resetAllMocks();vi.useRealTimers();});
it('recovers the submitted transaction via the configured RPC',async()=>{
 rpc.getNetwork.mockResolvedValue({chainId:4663n});
 rpc.getTransactionReceipt.mockResolvedValue(receipt);
 rpc.getBlockNumber.mockResolvedValue(101);
 const tx={hash:'0xabc',wait:vi.fn().mockRejectedValue(failure)};
 expect(await waitForIDOReceipt(tx,config,2)).toBe(receipt);
 expect(rpc.getTransactionReceipt).toHaveBeenCalledWith('0xabc');
 expect(tx.wait).toHaveBeenCalledTimes(1);
 expect(rpc.destroy).toHaveBeenCalledOnce();
});
it('does not treat a reverted receipt as success',async()=>{
 rpc.getNetwork.mockResolvedValue({chainId:4663n});
 rpc.getTransactionReceipt.mockResolvedValue({...receipt,status:0});
 rpc.getBlockNumber.mockResolvedValue(101);
 await expect(waitForIDOReceipt({hash:'0xabc',wait:vi.fn().mockRejectedValue(failure)},config)).rejects.toThrow('reverted');
});
it('preserves wallet transaction replacement errors',async()=>{
 const replacement={code:'TRANSACTION_REPLACED',cancelled:true};
 await expect(waitForIDOReceipt({hash:'0xabc',wait:vi.fn().mockRejectedValue(replacement)},config)).rejects.toBe(replacement);
 expect(rpc.getTransactionReceipt).not.toHaveBeenCalled();
});
it('waits for the requested confirmation depth and retries temporary RPC errors',async()=>{
 vi.useFakeTimers();
 rpc.getNetwork.mockResolvedValue({chainId:4663n});
 rpc.getTransactionReceipt.mockRejectedValueOnce(Error('temporary')).mockResolvedValue(receipt);
 rpc.getBlockNumber.mockResolvedValueOnce(100).mockResolvedValue(101);
 const pending=waitForIDOReceipt({hash:'0xabc',wait:vi.fn().mockRejectedValue(failure)},config,2);
 await vi.advanceTimersByTimeAsync(3000);
 expect(await pending).toBe(receipt);
 expect(rpc.getTransactionReceipt).toHaveBeenCalledTimes(3);
});
