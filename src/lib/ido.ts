import {
  id,
  BrowserProvider,
  Contract,
  JsonRpcProvider,
  ZeroAddress,
  formatUnits,
  type Eip1193Provider,
} from "ethers";
import { api } from "./api";

export type IDOConfig = {
  metadata?: {token:{address:string;name:string;symbol:string;icon:string;website:string;x:string;telegram:string}};
  network?: {name:string;icon:string;testnet:boolean;payments:{symbol:string;address:string;icon:string}[]};
  configured: boolean;
  chain_id: number;
  contract: string;
  rpc_url: string;
  explorer_url: string;
};
export type IDOEligibility = {
  eligible: boolean;
  highest_score: number;
  user_id: string;
};
export const idoABI = [
  "function userWallet(bytes32) view returns(address)",
  "function sale() view returns(uint64 start,uint64 end,uint256 softCapCents,uint256 hardCapCents,uint256 tokenUnitsPerDollar,uint256 saleAllocation,uint256 promisedSupply)",
  "function migrationVersion() view returns(bytes32)",
  "function vestedTokenParts(address) view returns(uint256 base,uint256 rebate,uint256 baseAllocation,uint256 rebateAllocation)",
  "function vesting() view returns(uint64 start,uint64 cliff,uint64 duration,uint64 interval,uint16 initialBps)",
  "function accounts(address) view returns(bytes32 userId,uint256 paidCents,uint256 rebateCents,uint256 claimedTokens,bool rebateRegistered,bool rebateClaimed,bool refunded)",
  "function phase() view returns(uint8)",
  "function frozen() view returns(bool)",
  "function migrated() view returns(bool)",
  "function importing() view returns(bool)",
  "function subscriptionsPaused() view returns(bool)",
  "function totalPaidCents() view returns(uint256)",
  "function participantCount() view returns(uint256)",
  "function paymentToken() view returns(address)",
  "function paymentUnitsPerCent() view returns(uint256)",
  "function saleToken() view returns(address)",
  "function vestedTokens(address) view returns(uint256)",
  "function subscribe(uint256,(bytes32 userId,address wallet,uint256 maxCents,uint256 deadline,uint256 epoch),bytes)",
  "function claimRebate()",
  "function claimTokens()",
  "function claimRefund()",
];
export const paymentABI = [
  "function allowance(address,address) view returns(uint256)",
  "function approve(address,uint256) returns(bool)",
  "function balanceOf(address) view returns(uint256)",
];
// Lightweight public summary: no wallet connection or per-account reads.
export async function readIDOFunding(config: IDOConfig) {
  const provider = new JsonRpcProvider(config.rpc_url);
  try {
    if (Number((await provider.getNetwork()).chainId) !== config.chain_id) throw new Error('Wrong IDO network');
    const block = await provider.getBlock('latest');
    if (!block) throw new Error('Missing block');
    const c = new Contract(config.contract, idoABI, provider), options = {blockTag:block.number};
    const [sale,raised,subscribers,phase] = await Promise.all([c.sale(options),c.totalPaidCents(options),c.participantCount(options),c.phase(options)]);
    return {raised:BigInt(raised),soft:BigInt(sale.softCapCents),hard:BigInt(sale.hardCapCents),subscribers:BigInt(subscribers),phase:Number(phase)};
  } finally { provider.destroy(); }
}
export function parseCents(value: string): bigint {
  if (!/^(0|[1-9]\d{0,6})(\.\d{1,2})?$/.test(value.trim()))
    throw new Error("Enter a dollar amount with up to two decimal places.");
  const [whole, fraction = ""] = value.trim().split(".");
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
}
export const dollars = (cents: bigint) => {
  const [whole, fraction = ""] = formatUnits(cents, 2).split(".");
  return (
    "$" +
    whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",") +
    "." +
    fraction.padEnd(2, "0")
  );
};
export function durationLabel(seconds: number) {
  for (const [unit, size] of [
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ] as const)
    if (seconds >= size && seconds % size === 0)
      return `${seconds / size} ${unit}${seconds / size === 1 ? "" : "s"}`;
  return `${seconds} second${seconds === 1 ? "" : "s"}`;
}
export function rebateCents(score: number, paid: bigint) {
  return [BigInt(Math.max(0, Math.floor(score))), paid / 5n, 20000n].reduce(
    (a, b) => (a < b ? a : b),
  );
}
export function validatePurchase(
  cents: bigint,
  paid: bigint,
  raised: bigint,
  hard: bigint,
) {
  if (cents <= 0n || (paid === 0n && cents < 10000n))
    throw new Error("Your first subscription must be at least $100.");
  if (paid + cents > 100000n)
    throw new Error("Your total subscription cannot exceed $1,000.");
  if (raised + cents > hard)
    throw new Error("This amount exceeds the remaining sale allocation.");
}
export async function readIDO(config: IDOConfig, wallet = ZeroAddress, userId?: string) {
  const provider = new JsonRpcProvider(config.rpc_url, undefined, {
    staticNetwork: false,
  });
  try {
    if (Number((await provider.getNetwork()).chainId) !== config.chain_id)
      throw new Error("IDO network configuration mismatch.");
    const c = new Contract(config.contract, idoABI, provider);
    const block = await provider.getBlock("latest");
    if (!block) throw new Error("Could not read the latest block.");
    const options = { blockTag: block.number };
    const identity: { boundWallet?: string } = userId
      ? { boundWallet: String(await c.userWallet(userId, options)) }
      : {};
    const [
      sale,
      legacyVesting,
      account,
      phase,
      frozen,
      migrated,
      importing,
      paused,
      raised,
      payment,
      units,
      token,
      vested,
    ] = await Promise.all([
      c.sale(options),
      c.vesting(options),
      c.accounts(wallet, options),
      c.phase(options),
      c.frozen(options),
      c.migrated(options),
      c.importing(options),
      c.subscriptionsPaused(options),
      c.totalPaidCents(options),
      c.paymentToken(options),
      c.paymentUnitsPerCent(options),
      c.saleToken(options),
      c.vestedTokens(wallet, options),
    ]);
    let vesting=legacyVesting;
    let splitVesting: {base:bigint;rebate:bigint;baseVested:bigint;rebateVested:bigint}|undefined;
    const schema=await c.migrationVersion(options);
    const version=schema===id('P2L_IDO_MIGRATION_V2')?2:schema===id('P2L_IDO_MIGRATION_V1')?1:0;
    if(!version)throw new Error('Unsupported vesting version');
    if(version===2){
      const v2=new Contract(config.contract,['function vesting() view returns(uint64 start,uint64 cliff,uint64 duration,uint64 interval,uint16 initialBps,uint64 rebateCliff,uint64 rebateDuration,uint64 rebateInterval)'],provider);
      const [schedule,parts]=await Promise.all([v2.vesting(options),c.vestedTokenParts(wallet,options)]);
      vesting=schedule;
      splitVesting={base:BigInt(parts[2]),rebate:BigInt(parts[3]),baseVested:BigInt(parts[0]),rebateVested:BigInt(parts[1])};
    }
    const paymentAsset = new Contract(String(payment), ["function symbol() view returns(string)","function balanceOf(address) view returns(uint256)"],provider);
    const [paymentName,paymentFunds]=await Promise.allSettled([paymentAsset.symbol(options),paymentAsset.balanceOf(wallet,options)]);
    const registered=config.network?.payments.find(p=>p.address.toLowerCase()===String(payment).toLowerCase());
    const paymentSymbol=registered?.symbol || (paymentName.status==='fulfilled'?String(paymentName.value):'Payment token');
    const paymentBalance=paymentFunds.status==='fulfilled'?BigInt(paymentFunds.value):null;
    let tokenBalance: bigint | null = null;
    let tokenSymbol = "Token";
    if (String(token) !== ZeroAddress) {
      const asset = new Contract(String(token), [
        "function balanceOf(address) view returns(uint256)",
        "function symbol() view returns(string)",
      ], provider);
      const [balance, symbol] = await Promise.allSettled([
        asset.balanceOf(wallet, options), asset.symbol(options),
      ]);
      if (balance.status === "fulfilled") tokenBalance = BigInt(balance.value);
      if (symbol.status === "fulfilled") tokenSymbol = String(symbol.value);
    }
    return {
      ...identity,
      splitVesting,
      sale,
      vesting,
      account,
      phase: Number(phase),
      blocked: Boolean(frozen || migrated || importing),
      paused: Boolean(paused),
      raised: BigInt(raised),
      payment: String(payment),
      units: BigInt(units),
      token: String(token),
      paymentSymbol,
      paymentBalance,
      paymentIcon:registered?.icon,
      tokenBalance,
      tokenSymbol,
      allocation: BigInt(account.paidCents) * BigInt(sale.tokenUnitsPerDollar) / 100n,
      vested: BigInt(vested),
      now: block.timestamp,
    };
  } finally {
    provider.destroy();
  }
}
export type IDOState = Awaited<ReturnType<typeof readIDO>>;
export async function walletSigner(
  provider: Eip1193Provider,
  config: IDOConfig,
  expected: string,
) {
  const browser = new BrowserProvider(provider);
  if (Number((await browser.getNetwork()).chainId) !== config.chain_id)
    throw new Error(`Switch your wallet to chain ${config.chain_id}.`);
  const signer = await browser.getSigner();
  if ((await signer.getAddress()).toLowerCase() !== expected.toLowerCase())
    throw new Error("Wallet changed. Refresh and try again.");
  return signer;
}
export const idoPath = (slug: string) =>
  `/campaigns/${encodeURIComponent(slug)}/ido`;
export async function recordIDOTransaction(slug: string, hash: string) {
  return api.authenticated(idoPath(slug) + "/transactions", { hash });
}

export function tokenQuantity(value:bigint,decimals=18){
 const [whole,fraction]=formatUnits(value,decimals).split('.');
 const trimmed=fraction?.replace(/0+$/,'');
 return whole.replace(/\B(?=(\d{3})+(?!\d))/g,',')+(trimmed?'.'+trimmed:'');
}
