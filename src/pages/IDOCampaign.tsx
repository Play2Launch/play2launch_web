import {IDOVestingGuide} from '../components/IDOVestingGuide';
import { IDOTokenInfo } from "../components/IDOTokenInfo";
import { IDOFundingProgress } from "../components/IDOFundingProgress";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Gamepad2, ArrowUpRight, Trophy, Wallet as WalletIcon, Gift, ArrowRight } from "lucide-react";
import type { Campaign } from "../data";
import {
  CampaignIdentityCard,
  CampaignNav,
} from "../components/CampaignHeader";
import { FollowButton } from "../components/FollowButton";
import { useApp } from "../state";
import { api } from "../lib/api";
import {
  dollars,
  idoPath,
  readIDO,
  type IDOConfig,
  type IDOEligibility,
  type IDOState,
} from "../lib/ido";
import { loadWallet, useWalletModule } from "../lib/walletLoader";
import { walletAllowed } from "../lib/walletPolicy";

export default function IDOCampaign({
  campaign: c,
  campaignId,
}: {
  campaign: Campaign;
  campaignId?: string;
}) {
  const navigate = useNavigate();
  const [paymentBalanceTarget,setPaymentBalanceTarget] = useState<HTMLDivElement|null>(null);
  const app = useApp(),
    walletModule = useWalletModule(),
    Wallet = walletModule?.IDOWallet,
    WalletControl = walletModule?.WalletButton;
  const [config, setConfig] = useState<IDOConfig>(),
    [state, setState] = useState<IDOState>(),
    [eligibility, setEligibility] = useState<IDOEligibility>(),
    [eligibilityOwner, setEligibilityOwner] = useState<string>(),
    [error, setError] = useState(""),
    [walletError, setWalletError] = useState(""),
    [version, setVersion] = useState(0),
    [loadingWallet, setLoadingWallet] = useState(false);
  useEffect(() => {
    const ctrl = new AbortController();
    setError("");
    api
      .request<IDOConfig>(idoPath(c.id), undefined, { signal: ctrl.signal })
      .then(async (p) => {
        if (ctrl.signal.aborted) return;
        setConfig((old) =>
          old && JSON.stringify(old) === JSON.stringify(p) ? old : p,
        );
        if (p.configured) {
          const s = await readIDO(p);
          if (!ctrl.signal.aborted) setState(s);
        }
      })
      .catch((e) => {
        if (!ctrl.signal.aborted) setError(e.message);
      });
    return () => ctrl.abort();
  }, [c.id, version]);
  useEffect(() => {
    if (!config?.configured) return;
    let cancelled = false, pending = false;
    const timer = setInterval(async () => {
      if (pending || document.visibilityState === "hidden") return;
      pending = true;
      try { const next = await readIDO(config); if (!cancelled) setState(next); }
      catch { /* Keep the last confirmed funding state during a transient RPC error. */ }
      finally { pending = false; }
    }, 10000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [config]);
  useEffect(() => {
    const ctrl = new AbortController();
    setEligibility(undefined);
    setEligibilityOwner(undefined);
    if (app.user)
      void api
        .authenticated<IDOEligibility>(
          idoPath(c.id) + "/eligibility",
          undefined,
          ctrl.signal,
        )
        .then((v) => {
          if (!ctrl.signal.aborted) { setEligibility(v); setEligibilityOwner(app.user?.id); }
        })
        .catch((e) => {
          if (!ctrl.signal.aborted) setError(e.message);
        });
    return () => ctrl.abort();
  }, [c.id, app.user?.id, version]);
  async function connect() {
    setLoadingWallet(true);
    setWalletError("");
    try {
      const module = await loadWallet();
      await module.openWallet(config?.chain_id);
    } catch (e) {
      setWalletError(
        e instanceof Error ? e.message : "Could not connect wallet.",
      );
    } finally {
      setLoadingWallet(false);
    }
  }
  return (
    <>
      <CampaignNav campaign={c} live />
      <CampaignIdentityCard campaign={c} stage={c.stage} />
      <div className="campaign-layout ido-layout">
        <div className="ido-main">
          {campaignId && (
            <div className="campaign-follow-row">
              <span className="muted">Keep this campaign on your radar.</span>
              <FollowButton kind="campaign" targetId={campaignId} />
            </div>
          )}
        <section className="ido-subscribe ido-contract-panel" aria-label="Subscription and claims">
          {state ? <IDOFundingProgress state={state} /> : <><span className="eyebrow">PLAY TO IDO</span><h2>Join the launch</h2></>}
          {config?.configured === false && (
            <p className="notice">
              Subscription details are coming soon. Play now to build your best
              score.
            </p>
          )}
          {!config && !error && (
            <p role="status">Loading subscription details…</p>
          )}
          {error && (
            <div className="notice" role="alert">
              {error}
              <button
                className="btn btn-secondary"
                onClick={() => setVersion((v) => v + 1)}
              >
                Retry
              </button>
            </div>
          )}
          {config?.configured && <IDOTokenInfo config={config} state={state} paymentBalanceSlot={<div className="ido-payment-wallet-balance" ref={setPaymentBalanceTarget}>{(!Wallet || !app.user) && <small>Connect wallet to see balance</small>}</div>} walletControl={
            app.user && walletAllowed(app.platform?.runtime) && WalletControl ? <WalletControl targetChainId={config.chain_id} hideNetworkLabel visibility="connected" /> : null
          }/>}
          {config?.configured && <div className="ido-connect-row">
            {!app.user ? <button className="btn btn-primary full" onClick={() => app.setAuthOpen(true)}>Connect wallet</button>
            : !walletAllowed(app.platform?.runtime) ? <p className="small muted">Open in your browser to connect a wallet.</p>
            : WalletControl ? <WalletControl targetChainId={config.chain_id} visibility="disconnected" primary />
            : <button className="btn btn-primary full" disabled={loadingWallet} onClick={() => void connect()}>{loadingWallet ? "Opening wallet…" : "Connect wallet"}</button>}
          </div>}
          {config?.configured && app.user && walletAllowed(app.platform?.runtime) && Wallet && (
            <Wallet
              key={`${c.id}:${app.user.id}`}
              hideWalletButton
              paymentBalanceTarget={paymentBalanceTarget}
              slug={c.id}
              config={config}
              eligibility={eligibilityOwner === app.user.id ? eligibility : undefined}
              currentAccountEmail={app.user.email}
              onPlay={() => navigate(`/campaign/${c.id}/play`)}
              onRefresh={() => setVersion((v) => v + 1)}
            />
          )}
          {walletError && (
            <p className="ido-error" role="alert">
              {walletError}
            </p>
          )}
        </section>
          {state?.phase === 2 ? <section className="ido-explainer" aria-label="Refund guide"><div className="ido-section-title"><span className="eyebrow">PRINCIPAL REFUND</span><h2>Your subscription can be refunded</h2></div><p>Claim your full subscription amount with the wallet and P2L account used to subscribe.</p><p className="small muted">Refunds return your principal once. This IDO will not distribute rebates or tokens.</p></section> : <section className="ido-explainer" aria-label="Rebate guide">
            <div className="ido-section-title"><span className="eyebrow">PLAY MORE. GET MORE BACK.</span><h2>How rebates work</h2></div>
            <div className="ido-rebate-equation">
              <div><span className="ido-explain-icon"><WalletIcon size={22} /></span><strong>$5</strong><span>Subscribed</span></div>
              <span className="ido-equation-sign" aria-label="plus">+</span>
              <div><span className="ido-explain-icon"><Gamepad2 size={22} /></span><strong>100</strong><span>Game points</span></div>
              <span className="ido-equation-sign" aria-label="equals">=</span>
              <div className="ido-rebate-result"><span className="ido-explain-icon"><Gift size={22} /></span><strong>$1</strong><span>Rebate after settlement</span></div>
            </div>
            <div className="ido-example"><span>Full rebate example</span><strong>$1,000 subscribed + 20,000 points <ArrowRight size={18} /> $200 back</strong><span>You keep your full token allocation. Tokens unlock according to the schedule below.</span></div>
            <details className="ido-rules"><summary>Rebate rules &amp; purchase limits</summary><ul>
              <li>First subscription: $100 minimum. Add any cent amount up to $1,000 in total.</li>
              <li>1 point = 1 cent. Your highest valid score counts, not the sum of your games.</li>
              <li>Your rebate is the lowest of your points value, 20% of your subscription, or $200. Amounts round down to the nearest cent.</li>
              <li>Adding funds does not reuse your points allowance. Claim rebates after successful settlement, separately from token vesting.</li>
            </ul></details>
          </section>}
          <IDOVestingGuide state={state}/>
        </div>
        <aside className="ido-game-sidebar" aria-label="Game and personal score">
          <section className="ido-game-card unlock-panel">
            <span className="eyebrow">YOUR PERSONAL BEST</span>
            <h2>
              <Gamepad2 size={23} /> Market Combo
            </h2>
            <p>
              Choose LONG or SHORT, follow the beat and keep your combo going.
            </p>
            <div className="ido-balances">
              <div>
                <span>Highest valid score</span>
                <strong>
                  {eligibility
                    ? eligibility.highest_score.toLocaleString()
                    : "—"}
                </strong>
              </div>
              <div>
                <span>Subscription eligibility</span>
                <strong className="ido-small-value">
                  {eligibility?.eligible
                    ? "Unlocked"
                    : app.user
                      ? "Complete a game"
                      : "Sign in to play"}
                </strong>
              </div>
            </div>
            <Link className="btn btn-primary" to={`/campaign/${c.id}/play`}>
              Play Market Combo <ArrowUpRight size={16} />
            </Link>
            <Link
              className="btn btn-secondary"
              to={`/campaign/${c.id}/leaderboard`}
            >
              <Trophy size={16} /> Leaderboard
            </Link>
          </section>

          <section className="ido-steps" aria-label="Participation steps">
            <h3>Your path to the launch</h3>
            <div><span>01</span><p><strong>Play a round</strong><small>Unlock your subscription.</small></p><Gamepad2 size={19} /></div>
            <div><span>02</span><p><strong>Subscribe</strong><small>$100 to start · $1,000 max.</small></p><WalletIcon size={19} /></div>
            <div><span>03</span><p><strong>Claim your rewards</strong><small>Rebate + tokens as they unlock.</small></p><Gift size={19} /></div>
          </section>
        </aside>
      </div>
    </>
  );
}
