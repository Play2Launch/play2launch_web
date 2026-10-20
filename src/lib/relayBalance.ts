import {Contract,JsonRpcProvider,ZeroAddress,formatUnits} from 'ethers';
export function requiredSwapFunds(amount:bigint,native:boolean,gas:bigint,transactionValue:bigint){return {token:native?0n:amount,native:(native?(transactionValue>amount?transactionValue:amount):transactionValue)+gas};}
export async function checkSwapBalance(input:{rpc:string;chainId:number;address:string;token:string;decimals:number;symbol:string;nativeSymbol:string;amount:bigint;gas?:bigint;transactionValue?:bigint}){
 const provider=new JsonRpcProvider(input.rpc,undefined,{cacheTimeout:-1});
 try{
  if((await provider.getNetwork()).chainId!==BigInt(input.chainId))throw Error('Source network RPC mismatch. Please retry later.');
  const native=input.token.toLowerCase()===ZeroAddress||input.token.toLowerCase()==='0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
  const [nativeBalance,tokenBalance]=await Promise.all([provider.getBalance(input.address),native?Promise.resolve(0n):new Contract(input.token,['function balanceOf(address) view returns(uint256)'],provider).balanceOf(input.address) as Promise<bigint>]);
  const balance=native?nativeBalance:tokenBalance;
  const required=requiredSwapFunds(input.amount,native,input.gas??0n,input.transactionValue??0n);
  if(balance<input.amount)throw Error(`Insufficient ${input.symbol} on the source chain. Balance: ${formatUnits(balance,input.decimals)}; short by ${formatUnits(input.amount-balance,input.decimals)} ${input.symbol}.`);
  if(nativeBalance<required.native)throw Error(`Insufficient ${input.nativeSymbol} for the swap and estimated network fees. Short by ${formatUnits(required.native-nativeBalance,18)} ${input.nativeSymbol}.`);
  return `${formatUnits(balance,input.decimals)} ${input.symbol}`;
 }finally{provider.destroy()}
}
