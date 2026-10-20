import {lazy, Suspense} from 'react';
import {waitForIDOReceipt} from '../lib/idoReceipt';
const RelayPaymentSwap = lazy(()=>import('./RelayPaymentSwap'));
import {createPortal} from 'react-dom';
import {IDOPersonalProgress} from './IDOPersonalProgress';
import { useEffect, useRef, useState } from "react";
import { WarningNotice } from "./WarningNotice";
import { Contract, formatUnits, ZeroAddress, type Eip1193Provider } from "ethers";
import { api } from "../lib/api";
import { vestingStatus, vestingParts } from "../lib/vesting";
import {
  tokenQuantity,
  durationLabel,
  dollars,
  idoABI,
  idoPath,
  parseCents,
  paymentABI,
  readIDO,
  recordIDOTransaction,
  validatePurchase,
  walletSigner,
  type IDOConfig,
  type IDOEligibility,
  type IDOState,
} from "../lib/ido";

export type IDOTransactionProps = {
  slug: string;
  config: IDOConfig;
  eligibility?: IDOEligibility;
  currentAccountEmail?: string;
  onRefresh: () => void;
  onPlay?: () => void;
  paymentBalanceTarget?: HTMLElement | null;
  subscriptionTarget?: HTMLElement | null;
};
type HistoryRow = { hash: string; event: string; data?: string; verified_at?: string };
export function IDOTransactions({
  slug,
  config,
  eligibility,
  currentAccountEmail,
  onRefresh,
  onPlay,
  paymentBalanceTarget,
  subscriptionTarget,
  address,
  chainId,
  provider,
}: IDOTransactionProps & {
  address?: string;
  chainId: number;
  provider?: Eip1193Provider;
}) {
  const [state, setState] = useState<IDOState>(),
    [amount, setAmount] = useState("100"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [hash, setHash] = useState(""),
    [version, setVersion] = useState(0),
    [historyVersion, setHistoryVersion] = useState(0);
  const [relayOpen,setRelayOpen]=useState(false);
  const balanceOwner = useRef<string>();
  const lock = useRef(false),
    generation = useRef(0);
  const [history, setHistory] = useState<HistoryRow[]>([]),
    [syncNotice, setSyncNotice] = useState("");
  useEffect(() => {
    let cancelled = false;
    setHistory([]);
    setSyncNotice("");
    if (!address) return;
    void (async () => {
      // Bound each catch-up pass so a long outage cannot flood the RPC.
      for (let batch = 0; batch < 10 && !cancelled; batch++) {
        const v = await api.authenticated<{
        caught_up: boolean;
        items?: HistoryRow[];
        }>(idoPath(slug) + "/sync", {});
        if (!cancelled) {
          setHistory(v.items || []);
          setSyncNotice(
            v.caught_up
              ? ""
              : batch < 9
                ? "Syncing earlier activity…"
                : "Earlier activity is still syncing. Refresh to continue.",
          );
        }
        if (v.caught_up) break;
      }
    })()
      .catch(() => {
        if (!cancelled)
          setSyncNotice(
            "Account history could not sync. Your on-chain balance is unaffected.",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [slug, address, version, historyVersion, config.contract]);
  useEffect(() => {
    const current = ++generation.current;
    setState(undefined);
    setError("");
    setNotice("");
    setHash("");
    if (!address) return;
    void readIDO(config, address, eligibility?.user_id)
      .then((s) => {
        if (current === generation.current) { balanceOwner.current = address; setState(s); }
      })
      .catch((e) => {
        if (current === generation.current) setError(e.message);
      });
    return () => {
      generation.current++;
    };
  // Reads use the configured IDO RPC, not the wallet network. Clearing state on
  // a Relay source-chain switch would unmount the active swap and lose its state.
  }, [address, config, version, eligibility?.user_id]);
  useEffect(() => {
    if (!address) return;
    let cancelled = false, pending = false;
    const refresh = async () => {
      if (lock.current || pending || document.visibilityState === "hidden") return;
      pending = true;
      try {
        const next = await readIDO(config, address, eligibility?.user_id);
        if (!cancelled && !lock.current) { balanceOwner.current = address; setState(next); }
      } catch { /* Keep the last verified balance; manual refresh reports errors. */ }
      finally { pending = false; }
    };
    const timer = setInterval(() => void refresh(), 10000);
    document.addEventListener("visibilitychange", refresh);
    return () => { cancelled = true; clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, [address, config, eligibility?.user_id]);
  const paid = state ? BigInt(state.account.paidCents) : 0n;
  const correctNetwork = chainId === config.chain_id;
  const wrongWallet = !!state?.boundWallet && state.boundWallet !== ZeroAddress && state.boundWallet.toLowerCase() !== address?.toLowerCase();
  const wrongIdentity =
    !!state &&
    (wrongWallet || (paid > 0n &&
    (!eligibility || String(state.account.userId).toLowerCase() !==
      eligibility.user_id.toLowerCase())));
  const active =
    !!state &&
    state.phase === 0 &&
    !state.blocked &&
    !state.paused &&
    state.now >= Number(state.sale.start) &&
    state.now < Number(state.sale.end);
  const claimable = state
    ? state.vested - BigInt(state.account.claimedTokens)
    : 0n;
  const tokenAmount = (value: bigint) => {
    const [whole, fraction] = formatUnits(value, 18).split(".");
    return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",") +
      (fraction && fraction !== "0" ? `.${fraction}` : "");
  };
  const vesting = state?.phase === 1 ? vestingStatus(state) : null;
  const emailParts = currentAccountEmail?.trim().split("@");
  const maskedEmail = emailParts?.length === 2 && emailParts[0] && emailParts[1]
    ? `${emailParts[0].slice(0, Math.min(3, Math.max(0, emailParts[0].length - 1)))}***@${emailParts[1]}`
    : "Email not available";
  async function transact(
    kind: "subscribe" | "claimRebate" | "claimTokens" | "claimRefund",
  ) {
    if (
      lock.current ||
      !provider ||
      !address ||
      !correctNetwork ||
      wrongIdentity || !eligibility
    )
      return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    setHash("");
    const current = generation.current;
    const assertCurrent = () => {
      if (generation.current !== current)
        throw new Error("Wallet or page changed. Please retry.");
    };
    try {
      const signer = await walletSigner(provider, config, address);
      assertCurrent();
      const c = new Contract(config.contract, idoABI, signer);
      let tx;
      if (kind === "subscribe") {
        const fresh = await readIDO(config, address, eligibility?.user_id);
        assertCurrent();
        const cents = parseCents(amount);
        validatePurchase(
          cents,
          BigInt(fresh.account.paidCents),
          fresh.raised,
          BigInt(fresh.sale.hardCapCents),
        );
        if (
          fresh.blocked ||
          fresh.paused ||
          fresh.phase !== 0 ||
          fresh.now < Number(fresh.sale.start) ||
          fresh.now >= Number(fresh.sale.end)
        )
          throw new Error("Subscriptions are currently closed.");
        setNotice(
          "Confirm the wallet verification message. No funds move in this step.",
        );
        const challenge = await api.authenticated<{
          nonce: string;
          message: string;
        }>(idoPath(slug) + "/challenge", { wallet: address });
        assertCurrent();
        const signature = await signer.signMessage(challenge.message);
        assertCurrent();
        const credential = await api.authenticated<{
          eligibility: Record<string, string>;
          signature: string;
        }>(idoPath(slug) + "/credential", {
          nonce: challenge.nonce,
          signature,
        });
        assertCurrent();
        const token = new Contract(fresh.payment, paymentABI, signer),
          units = cents * fresh.units;
        if (BigInt(await token.balanceOf(address)) < units)
          throw new Error("Insufficient payment token balance.");
        const allowance = BigInt(
          await token.allowance(address, config.contract),
        );
        assertCurrent();
        if (allowance < units) {
          if (allowance > 0n) {
            setNotice("Reset the existing token allowance in your wallet.");
            const reset = await token.approve(config.contract, 0n);
            setHash(reset.hash);
            await waitForIDOReceipt(reset, config);
            assertCurrent();
          }
          setNotice("Approve only this subscription amount in your wallet.");
          const approval = await token.approve(config.contract, units);
          setHash(approval.hash);
          setNotice("Approval submitted. Waiting for confirmation…");
          await waitForIDOReceipt(approval, config);
          assertCurrent();
        }
        await walletSigner(provider, config, address);
        assertCurrent();
        setNotice("Confirm your subscription in your wallet.");
        await c.subscribe.staticCall(
          cents,
          credential.eligibility,
          credential.signature,
        );
        assertCurrent();
        tx = await c.subscribe(
          cents,
          credential.eligibility,
          credential.signature,
        );
      } else {
        setNotice("Confirm the claim in your wallet.");
        await c[kind].staticCall();
        assertCurrent();
        await walletSigner(provider, config, address);
        assertCurrent();
        tx = await c[kind]();
      }
      if (current === generation.current) {
        setHash(tx.hash);
        setNotice("Transaction submitted. Waiting for confirmation…");
      }
      const receipt = await waitForIDOReceipt(tx, config, 2);
      if (!receipt || receipt.status !== 1)
        throw new Error("Transaction did not succeed.");
      // A submitted transaction can confirm after logout/account switching.
      // Let that account's history backfill reconcile it, never sync under the new login.
      if (current !== generation.current) return;
      let syncPending = false;
      try {
        await recordIDOTransaction(slug, tx.hash);
      } catch {
        syncPending = true;
      }
      if (current === generation.current) {
        setState(await readIDO(config, address, eligibility?.user_id));
        setNotice(
          syncPending
            ? "Confirmed on chain. Account history is still syncing; refresh to retry."
            : "Transaction confirmed. Your balances are up to date.",
        );
        onRefresh();
        setHistoryVersion((v) => v + 1);
      }
    } catch (e) {
      if (current === generation.current) {
        setNotice("");
        setError(
          e instanceof Error ? e.message : "Transaction failed. Please retry.",
        );
      }
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const purchasePreview=(()=>{try{return state?parseCents(amount)*BigInt(state.sale.tokenUnitsPerDollar)/100n:0n}catch{return 0n}})();
  const paymentDecimals=state?.units?state.units.toString().length+1:6;
  const getPaymentButton=<button type="button" className="btn btn-primary ido-get-payment" disabled={busy||!address||!provider||!state} onClick={()=>setRelayOpen(true)}>Get {state?.paymentSymbol||"payment token"} ↗</button>;
  const balancePortal = paymentBalanceTarget ? createPortal(<div className="ido-payment-actions"><small>{!address ? "Connect wallet to see balance" : !state || balanceOwner.current !== address ? (error ? "Balance unavailable" : "Loading balance…") : state.paymentBalance == null ? "Balance unavailable" : <>Wallet balance: <b>{tokenQuantity(state.paymentBalance,paymentDecimals)} {state.paymentSymbol}</b></>}</small>{getPaymentButton}</div>,paymentBalanceTarget) : null;
  const refreshButton = (
      <button
        className="btn btn-secondary full"
        disabled={busy}
        onClick={() => {
          setVersion((v) => v + 1);
          onRefresh();
        }}
      >
        Refresh balances
      </button>
  );
  const transactionWarnings = <>
      {!correctNetwork && (
        <WarningNotice title="Switch your wallet network" urgent><p>
          Switch your wallet to chain {config.chain_id} to continue.
        </p></WarningNotice>
      )}
      {!eligibility && <p role="status">Verifying your P2L account before enabling transactions…</p>}
      {wrongIdentity && eligibility && (
        <WarningNotice title="Account and wallet don’t match" urgent>
            <dl className="ido-identity-details">
              <div><dt>Current account</dt><dd>{maskedEmail}</dd></div>
              <div><dt>Current wallet</dt><dd>{address?.slice(0, 6)}…{address?.slice(-4)}</dd></div>
            </dl>
            <p>{wrongWallet ? "This P2L account already subscribed with a different wallet. Switch back to the wallet used for your subscription." : "This wallet subscribed with a different P2L account."}</p>
            <p>Switch to the matching account or wallet to continue. Purchases and claims are disabled.</p>
        </WarningNotice>
      )}
  </>;
  const transactionFeedback = <>
      {notice && (
        <p role="status" className="small">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="ido-error">
          {error}
        </p>
      )}
      {hash && (
        <a
          className="text-link"
          target="_blank"
          rel="noreferrer"
          href={`${config.explorer_url}/tx/${hash}`}
        >
          View transaction ↗
        </a>
      )}
  </>;
  const subscriptionForm = state?.phase === 0 ? (
            <section className="ido-subscription-form" aria-label="Subscribe to IDO">
              {transactionWarnings}
              <label className="ido-amount">
                {paid > 0n ? "Add to your subscription" : "Subscription amount"}
                <div>
                  <span>{state.paymentSymbol || "$"}</span>
                  <input
                    aria-label="Subscription amount"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    disabled={busy}
                  />
                </div>
              </label>
              <div className="ido-purchase-preview">{!paymentBalanceTarget && <span className="ido-purchase-balance"><span>Available balance: <strong>{state.paymentBalance==null?'Unavailable':tokenQuantity(state.paymentBalance,paymentDecimals)} {state.paymentSymbol}</strong></span>{getPaymentButton}</span>}<span>You receive <strong>{tokenQuantity(purchasePreview,18)} {state.tokenSymbol}</strong>{state.token===ZeroAddress?' · Token binding pending':''}</span></div>
              <p className="small muted">
                First purchase $100 minimum. Add any cent amount afterwards, up
                to $1,000 total. Pay the full amount now; claim your rebate
                after settlement.
              </p>
              {active && eligibility?.eligible === false && onPlay ? (
                <>
                  <WarningNotice title="Play a round first"><p>No valid game score yet. Play one round before you can subscribe.</p></WarningNotice>
                  <button className="btn btn-primary full" disabled={busy} onClick={onPlay}>
                    Play a game to subscribe ↗
                  </button>
                </>
              ) : <button
                className="btn btn-primary full"
                disabled={
                  busy ||
                  wrongIdentity ||
                  !correctNetwork ||
                  !active ||
                  !eligibility?.eligible ||
                  paid >= 100000n
                }
                onClick={() => void transact("subscribe")}
              >
                {busy
                  ? "Waiting for wallet…"
                  : !active
                    ? "Subscriptions closed"
                    : !eligibility?.eligible
                      ? "Complete a game to unlock"
                      : paid > 0n
                        ? "Add subscription"
                        : "Subscribe"}
              </button>}
              {transactionFeedback}
              {refreshButton}
            </section>
          ) : null;
  if (!address)
    return (
      <p className="small muted">
        {balancePortal}Connect your wallet to view your subscription and claims.
      </p>
    );
  return (
    <div className="ido-account">
      {balancePortal}
      {relayOpen && address && provider && state && <Suspense fallback={<p role="status">Loading swap…</p>}><RelayPaymentSwap key={`${address}:${slug}:${config.chain_id}:${state.payment}`} slug={slug} config={config} address={address} provider={provider} payment={state.payment} symbol={state.paymentSymbol} paymentIcon={state.paymentIcon} onClose={()=>setRelayOpen(false)} onComplete={()=>{setVersion(v=>v+1);onRefresh()}}/></Suspense>}
      {!subscriptionForm && transactionWarnings}
      {!state && !error && <p role="status">Loading your on-chain balance…</p>}
      {subscriptionForm && (subscriptionTarget ? createPortal(subscriptionForm, subscriptionTarget) : subscriptionForm)}
      {state && (
        <>
          <IDOPersonalProgress state={state} score={eligibility && !wrongIdentity ? eligibility.highest_score : undefined} active={active} />
          {state.phase !== 2 && paid > 0n && (
            <section className="ido-token-summary" aria-label="Your tokens">
              <h3>Your {state.tokenSymbol || "token"} balance</h3>
              <div className="ido-balances">
                <div><span>Total allocation</span><strong className="ido-small-value">{tokenAmount(state.allocation)}</strong></div>
                <div><span>Claimed</span><strong className="ido-small-value">{tokenAmount(BigInt(state.account.claimedTokens))}</strong></div>
                <div><span>{state.phase === 0 ? "Awaiting settlement" : "Locked"}</span><strong className="ido-small-value">{tokenAmount(state.allocation > state.vested ? state.allocation - state.vested : 0n)}</strong></div>
                <div><span>Available to claim</span><strong className="ido-small-value">{tokenAmount(claimable > 0n ? claimable : 0n)}</strong></div>
              </div>
              <p className="small">In your wallet <strong>{state.tokenBalance == null ? "Unavailable" : tokenAmount(state.tokenBalance)} {state.tokenSymbol || ""}</strong></p>
              <p className="small muted">Wallet balance includes tokens from other transfers. Claimed tracks tokens received from this IDO.</p>
            </section>
          )}
          {state.blocked && (
            <p role="alert">
              This contract is frozen or undergoing migration. Transactions are
              unavailable.
            </p>
          )}
          {state.phase === 1 && (
            <>
              <h3>Your claims</h3>
              {state.splitVesting && <div className="ido-vesting-parts">{vestingParts(state).map(part=><section className="ido-vesting" key={part.label} aria-label={part.label}>
                <h4>{part.label}</h4><strong>{part.allocation===0n?'No allocation':part.status}</strong>
                <progress aria-label={`${part.label} unlocked`} max={100} value={part.percent}/>
                <p>{tokenAmount(part.vested)} / {tokenAmount(part.allocation)} {state.tokenSymbol} unlocked</p>
                <p className="small muted">{Number(part.schedule.initialBps)/100}% at TGE · {durationLabel(Number(part.schedule.cliff))} lockup · {durationLabel(Number(part.schedule.duration))} release</p>
                <dl><dt>TGE</dt><dd>{new Date(part.start*1000).toLocaleString()}</dd><dt>Linear release starts</dt><dd>{new Date(part.cliffEnd*1000).toLocaleString()}</dd><dt>Fully unlocked</dt><dd>{new Date(part.end*1000).toLocaleString()}</dd>{part.next!=null&&<><dt>Next release</dt><dd>{new Date(part.next*1000).toLocaleString()} · {tokenAmount(part.nextAmount)} {state.tokenSymbol}</dd></>}</dl>
              </section>)}</div>}
              {state.splitVesting && <p className="small muted">One claim collects the available amount from both schedules. Cash rebates are claimed separately; claiming them does not change token vesting.</p>}
              {vesting && <section className="ido-vesting" aria-label="Vesting status">
                <strong>{vesting.status}</strong>
                <progress aria-label="Tokens unlocked" max={100} value={vesting.percent} />
                <p className="small">{vesting.percent}% unlocked · {tokenAmount(state.vested)} / {tokenAmount(state.allocation)} {state.tokenSymbol}</p>
                <dl>
                  <dt>Starts</dt><dd>{new Date(vesting.start * 1000).toLocaleString()}</dd>
                  {!state.splitVesting && Number(state.vesting.cliff) > 0 && <><dt>Cliff ends</dt><dd>{new Date(vesting.cliffEnd * 1000).toLocaleString()}</dd></>}
                  <dt>Fully unlocked</dt><dd>{new Date(vesting.end * 1000).toLocaleString()}</dd>
                  {vesting.next != null && <><dt>Next release</dt><dd>{new Date(vesting.next * 1000).toLocaleString()} · {tokenAmount(vesting.nextAmount)} {state.tokenSymbol}</dd></>}
                </dl>
                <p className="small muted">Unlocks and balances refresh every 10 seconds.</p>
              </section>}
              {!state.splitVesting && <p className="small muted">
                Vesting starts{" "}
                {new Date(Number(state.vesting.start) * 1000).toLocaleString()}.
                Initial release {Number(state.vesting.initialBps) / 100}%;
                remaining tokens release over{" "}
                {durationLabel(Number(state.vesting.duration))}
                {` in ${durationLabel(Number(state.vesting.interval))} intervals`}
                {Number(state.vesting.cliff) > 0
                  ? ` after a ${durationLabel(Number(state.vesting.cliff))} lockup`
                  : ""}
                .
              </p>}
              <div className="ido-claim-actions"><button
                className="btn btn-primary full"
                disabled={
                  busy ||
                  wrongIdentity ||
                  !correctNetwork ||
                  state.blocked ||
                  claimable <= 0n
                }
                onClick={() => void transact("claimTokens")}
              >
                Claim tokens
              </button>
              <button
                className="btn btn-secondary full"
                disabled={
                  busy ||
                  wrongIdentity ||
                  !correctNetwork ||
                  state.blocked ||
                  state.account.rebateClaimed ||
                  BigInt(state.account.rebateCents) === 0n
                }
                onClick={() => void transact("claimRebate")}
              >
                {state.account.rebateClaimed
                  ? "Rebate claimed"
                  : "Claim rebate"}
              </button>
              </div>
            </>
          )}
          {state.phase === 2 && (
            <>
              <h3>Refunds are open</h3>
              <p>The administrator has enabled full principal refunds.</p>
              <button
                className="btn btn-primary full"
                disabled={
                  busy ||
                  wrongIdentity ||
                  !correctNetwork ||
                  state.blocked ||
                  state.account.refunded ||
                  paid === 0n
                }
                onClick={() => void transact("claimRefund")}
              >
                {state.account.refunded
                  ? "Refund claimed"
                  : `Claim ${dollars(paid)} refund`}
              </button>
            </>
          )}
        </>
      )}
      {!subscriptionForm && transactionFeedback}
      {history.length > 0 && (
        <details>
          <summary>Transaction history</summary>
          {history.map((row) => (
            <p key={row.hash + row.event}>
              <a
                className="text-link"
                target="_blank"
                rel="noreferrer"
                href={`${config.explorer_url}/tx/${row.hash}`}
              >
                {row.event === "TokensClaimed" ? "Tokens claimed" : row.event} · {row.hash.slice(0, 10)}… ↗
              </a>
              {row.event === "TokensClaimed" && /^0x[0-9a-fA-F]{64}$/.test(row.data || "") && <span className="small"> · {tokenAmount(BigInt(row.data!))} {state?.tokenSymbol || "Token"}</span>}
              {row.verified_at && Number.isFinite(Date.parse(row.verified_at)) && <small className="muted"> · Verified {new Date(row.verified_at).toLocaleString()}</small>}
            </p>
          ))}
        </details>
      )}
      {syncNotice && <p className="small muted">{syncNotice}</p>}
      {state?.phase !== 0 && refreshButton}
    </div>
  );
}
