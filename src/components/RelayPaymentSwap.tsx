import {configuredRelayChains,walletChainImages} from '../lib/walletConfig';
import {ensureRelaySourceChain,relayErrorMessage} from '../lib/relayWallet';
import {checkSwapBalance} from '../lib/relayBalance';
import {RelayAssetSelect} from './RelayAssetSelect';
import {AssetIcon} from './AssetIcon';
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  createClient,
  convertViemChainToRelayChain,
  execute,
  type Execute,
} from "@relayprotocol/relay-sdk";
import {
  createWalletClient,
  custom,
  defineChain,
  parseUnits,
  formatUnits,
} from "viem";
import type { Eip1193Provider } from "ethers";
import { relayConfigured, relayRequest } from "../lib/relay";
import type { IDOConfig } from "../lib/ido";

type Chain = {
  id: number;
  name: string;
  displayName?: string;
  iconUrl?: string;
  vmType?: string;
  disabled?: boolean;
  httpRpcUrl: string;
  explorerUrl: string;
  currency: { name: string; symbol: string; decimals: number };
};
type Currency = { address: string; symbol: string; decimals: number; name?: string; metadata?: {logoURI?: string}; logoURI?: string };
export default function RelayPaymentSwap({
  slug,
  config,
  address,
  provider,
  payment,
  symbol,
  paymentIcon,
  onClose,
  onComplete,
}: {
  slug: string;
  config: IDOConfig;
  address: string;
  provider: Eip1193Provider;
  payment: string;
  symbol: string;
  paymentIcon?: string;
  onClose: () => void;
  onComplete: () => void;
}) {
  const [chains, setChains] = useState<Chain[]>([]),
    [source, setSource] = useState(0),
    [coins, setCoins] = useState<Currency[]>([]),
    [coin, setCoin] = useState(""),
    [amount, setAmount] = useState(""),
    [quote, setQuote] = useState<Execute>(),
    [quotedAt, setQuotedAt] = useState(0),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [status, setStatus] = useState(""),
    [ready, setReady] = useState(false);
  const active = useRef(true),
    locked = useRef(false),
    dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    const old = document.body.style.overflow,
      previous = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    dialog.current?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const nodes = Array.from(
        dialog.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href]",
        ) || [],
      );
      const first = nodes[0],
        last = nodes[nodes.length - 1];
      if (!first) {
        e.preventDefault();
        return;
      }
      if (
        e.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === dialog.current)
      ) {
        e.preventDefault();
        last.focus();
      } else if (
        !e.shiftKey &&
        (document.activeElement === last ||
          document.activeElement === dialog.current)
      ) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      document.body.style.overflow = old;
      document.removeEventListener("keydown", trap);
      previous?.focus();
    };
  }, []);
  useEffect(() => {
    active.current = true;
    let cancelled = false;
    relayConfigured(slug)
      .then(async (c) => {
        if (!c.configured)
          throw new Error(
            "Payment token swaps are not enabled yet. Please check back soon.",
          );
        const data = await relayRequest<{ chains: Chain[] }>(slug, "/chains");
        const supported = configuredRelayChains(data.chains);
        if (!supported.some((c) => c.id === config.chain_id))
          throw new Error(
            "Relay does not support this IDO network yet. Test tokens cannot be obtained here.",
          );
        if (!cancelled) {
          setChains(supported);
          setSource(
            supported.find((c) => c.id !== config.chain_id)?.id ||
              config.chain_id,
          );
          setReady(true);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      active.current = false;
    };
  }, [slug, config.chain_id, address, payment]);
  useEffect(() => {
    if (!source) return;
    let cancelled = false;
    setCoins([]);
    setCoin("");
    setQuote(undefined);
    setLoading(true);
    relayRequest<Currency[]>(slug, "/currencies/v2", "POST", {
      chainIds: [source],
    })
      .then((c) => {
        if (!cancelled) {
          setCoins(c);
          setCoin(c[0]?.address || "");
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, source]);
  const [sourceBalance,setSourceBalance]=useState<{key:string;text:string}>();
  const balanceKey=[source,coin.toLowerCase(),address.toLowerCase()].join(':');
  async function verifyBalance(value: bigint, route?: Execute) {
    const chain=chains.find(c=>c.id===source),currency=coins.find(c=>c.address===coin);
    if(!chain||!currency)throw Error("Select a source chain and token.");
    let transactionValue=0n;
    for(const step of route?.steps||[])for(const item of step.items||[]){
      const tx=item.data as {chainId?:number;value?:string}|undefined;
      if(tx?.chainId===source&&tx.value)transactionValue+=BigInt(tx.value);
    }
    const gas=route?.fees?.gas?.amount;
    try {
      const balance=await checkSwapBalance({rpc:chain.httpRpcUrl,chainId:source,address,token:coin,decimals:currency.decimals,symbol:currency.symbol,nativeSymbol:chain.currency.symbol,amount:value,gas:gas?BigInt(gas):0n,transactionValue});
      if(active.current)setSourceBalance({key:balanceKey,text:balance});
    } catch(e) {
      if(e instanceof Error&&/Insufficient|mismatch/.test(e.message))throw e;
      throw Error("Unable to verify your source-chain balance. Please retry before swapping.");
    }
  }
  async function getQuote() {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    setQuote(undefined);
    setStatus("");
    setSourceBalance(undefined);
    try {
      const currency = coins.find((c) => c.address === coin);
      if (
        !currency ||
        !/^\d+(\.\d+)?$/.test(amount) ||
        amount.split(".")[1]?.length > currency.decimals
      )
        throw new Error("Enter a valid amount.");
      const value = parseUnits(amount, currency.decimals);
      if (value <= 0n) throw new Error("Enter an amount greater than zero.");
      await verifyBalance(value);
      const q = await relayRequest<Execute>(slug, "/quote/v2", "POST", {
        user: address,
        originChainId: source,
        originCurrency: coin,
        amount: value.toString(),
      });
      if (
        q.details?.recipient?.toLowerCase() !== address.toLowerCase() ||
        q.details?.currencyIn?.currency?.chainId !== source ||
        q.details?.currencyIn?.currency?.address?.toLowerCase() !==
          coin.toLowerCase() ||
        !q.details?.currencyOut ||
        q.details.currencyOut.currency?.chainId !== config.chain_id ||
        q.details.currencyOut.currency?.address?.toLowerCase() !==
          payment.toLowerCase() ||
        q.steps.some((s) => s.kind !== "transaction")
      )
        throw new Error(
          "This route is not supported. Choose another source token.",
        );
      await verifyBalance(value,q);
      if (active.current) {
        setQuote(q);
        setQuotedAt(Date.now());
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Quote unavailable");
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  async function swap() {
    if (!quote || locked.current) return;
    if (Date.now() - quotedAt > 45000) {
      setQuote(undefined);
      setError("Quote expired. Please request a fresh quote.");
      return;
    }
    locked.current = true;
    setBusy(true);
    setError("");
    setStatus("Confirm the swap steps in your wallet.");
    const base = "https://p2l-relay.invalid";
    const client = createClient({
      baseApiUrl: base,
      chains: chains.map((c) =>
        convertViemChainToRelayChain(
          defineChain({
            id: c.id,
            name: c.name,
            nativeCurrency: c.currency,
            rpcUrls: { default: { http: [c.httpRpcUrl] } },
            blockExplorers: { default: { name: c.name, url: c.explorerUrl } },
          }),
        ),
      ),
      pollingInterval: 5000,
      maxPollingAttemptsBeforeTimeout: 120,
    });
    const previous = client.utils.axios.defaults.adapter;
    client.utils.axios.defaults.adapter = async (request) => {
      const url = new URL(request.url || "", request.baseURL || base);
      if (
        ![
          base,
          "https://api.relay.link",
          "https://api.testnets.relay.link",
        ].includes(url.origin)
      )
        throw new Error("Unexpected Relay endpoint");
      for (const [key, value] of Object.entries(request.params || {}))
        url.searchParams.set(key, String(value));
      const data = await relayRequest(
        slug,
        url.pathname,
        (request.method || "GET").toUpperCase(),
        typeof request.data === "string"
          ? JSON.parse(request.data)
          : request.data,
        Object.fromEntries(url.searchParams),
      );
      return {
        data,
        status: 200,
        statusText: "OK",
        headers: {},
        config: request,
      };
    };
    try {
      const currency=coins.find(c=>c.address===coin);
      if(!currency)throw Error("Select a source token.");
      await verifyBalance(parseUnits(amount,currency.decimals),quote);
      setStatus("Switch to the source network in your wallet to continue.");
      await ensureRelaySourceChain(provider,source,address);
      if(!active.current)throw Error("Wallet changed. Reopen the swap.");
      setStatus("Confirm the approval and swap transactions in your wallet.");
      const wallet = createWalletClient({
        account: address as `0x${string}`,
        transport: custom({
          request: async (args) => {
            if (!active.current)
              throw new Error("Wallet changed. Reopen the swap.");
            if (/sendTransaction|sign/i.test(args.method)) {
              const accounts = await provider.request({
                method: "eth_accounts",
              });
              if (accounts[0]?.toLowerCase() !== address.toLowerCase())
                throw new Error("Wallet changed. Reopen the swap.");
            }
            return provider.request(args);
          },
        }),
      });
      const result = await execute({
        quote,
        wallet,
        disableCapabilitiesCheck: true,
        onProgress: () => {
          if (active.current)
            setStatus("Waiting for wallet confirmations and Relay settlement…");
        },
      });
      if (
        result.data.error ||
        result.data.steps.some(
          (s) => s.error || s.items.some((i) => i.status !== "complete"),
        )
      )
        throw new Error(
          "Swap has not completed. Check Relay activity before retrying.",
        );
      if (result.data.refunded)
        throw new Error(
          "Swap refunded. Check your source wallet before retrying.",
        );
      setStatus("Swap completed. Your payment-token balance is refreshing.");
      setQuote(undefined);
      onComplete();
    } catch (e) {
      setStatus("");
      setError(
        relayErrorMessage(e),
      );
      setQuote(undefined);
    } finally {
      client.utils.axios.defaults.adapter = previous;
      locked.current = false;
      setBusy(false);
    }
  }
  const out = quote?.details?.currencyOut;
  return createPortal(
    <div className="relay-overlay">
      <section
        ref={dialog}
        tabIndex={-1}
        className="relay-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="relay-title"
      >
        <header>
          <div className="relay-title-group">
            <span className="relay-token-icon"><AssetIcon kind={paymentIcon || symbol.toLowerCase().replace('mock ', '')} size={44}/></span>
            <div><span className="relay-title-caption">PAYMENT TOKEN</span><h2 id="relay-title">Get {symbol}</h2></div>
          </div>
          <button
            className="btn btn-secondary"
            disabled={busy}
            onClick={onClose}
            aria-label="Close swap"
          >
            Close
          </button>
        </header>
        <p className="muted">
          Swap from another chain into your wallet. Subscribe separately after
          your tokens arrive.
        </p>
        <div className="relay-destination">
          <small>YOU RECEIVE</small>
          <strong>
            {symbol} ·{" "}
            {config.network?.name ||
              (config.chain_id === 4663
                ? "Robinhood"
                : config.chain_id === 1
                  ? "Ethereum"
                  : `Chain ${config.chain_id}`)}
          </strong>
          <small>
            To {address.slice(0, 6)}…{address.slice(-4)}
          </small>
        </div>
        {loading && <p role="status">Loading available routes…</p>}
        {error && (
          <div className="relay-warning" role="alert">
            {error}
          </div>
        )}
        {ready && (
          <>
            <div className="relay-fields">
              <RelayAssetSelect label="From chain" value={String(source)} disabled={busy || loading}
                options={chains.map(c=>({value:String(c.id),label:c.displayName||c.name,icon:c.iconUrl||walletChainImages[c.id]}))}
                onChange={value=>{setSource(Number(value));setQuote(undefined);setError("")}}/>
              <RelayAssetSelect label="Pay with" value={coin} disabled={busy || loading}
                options={coins.map(c=>({value:c.address,label:c.symbol,detail:c.name,icon:c.metadata?.logoURI||c.logoURI}))}
                onChange={value=>{setCoin(value);setQuote(undefined)}}/>
            </div>
            <label className="relay-amount">
              Amount
              <input
                inputMode="decimal"
                value={amount}
                disabled={busy}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setQuote(undefined);
                }}
              />
            </label>
            {sourceBalance?.key===balanceKey&&<small className="muted" aria-live="polite">Source wallet balance: <strong>{sourceBalance.text}</strong></small>}
            {out && (
              <div className="relay-quote">
                <strong>
                  You receive ≈ {out.amountFormatted} {symbol}
                </strong>
                <span>
                  Minimum:{" "}
                  {out.minimumAmount
                    ? formatUnits(
                        BigInt(out.minimumAmount),
                        out.currency?.decimals || 6,
                      )
                    : "—"}{" "}
                  {symbol}
                </span>
                <span>Slippage tolerance: 0.5%</span>
                {Object.entries(quote?.fees || {}).map(([name, fee]) => (
                  <small key={name}>
                    {name}: {fee?.amountFormatted} {fee?.currency?.symbol}
                  </small>
                ))}
                <small>
                  Quote valid for 45 seconds. Your wallet will show transaction
                  fees before confirmation.
                </small>
              </div>
            )}
            <button
              className="btn btn-primary full"
              disabled={busy || loading || !coin || !amount}
              onClick={quote ? swap : getQuote}
            >
              {busy ? "Processing…" : quote ? "Confirm swap" : "Review quote"}
            </button>
          </>
        )}
        {status && <p role="status">{status}</p>}
        <a
          href="https://relay.link/transactions"
          target="_blank"
          rel="noreferrer"
        >
          View Relay activity ↗
        </a>
        <small className="muted">
          Keep this window open during a swap. If interrupted, check Relay
          activity before retrying.
        </small>
      </section>
    </div>,
    document.body,
  );
}
