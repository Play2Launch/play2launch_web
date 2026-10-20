import { Check, Flag, LockKeyhole } from 'lucide-react';
import { dollars, type IDOState } from '../lib/ido';

export function IDOFundingProgress({ state }: { state: IDOState }) {
  const hard = BigInt(state.sale.hardCapCents), soft = BigInt(state.sale.softCapCents);
  const percent = hard > 0n ? Number(state.raised * 10000n / hard) / 100 : 0;
  const softPosition = hard > 0n ? Number(soft * 10000n / hard) / 100 : 0;
  const reached = state.raised >= soft, soldOut = state.raised >= hard;
  const ended = state.now >= Number(state.sale.end), upcoming = state.now < Number(state.sale.start);
  const status = state.blocked ? 'On hold' : state.phase === 2 ? 'Refunds open' : state.phase === 1 ? 'Successfully settled' : ended ? 'Ended · Awaiting settlement' : state.paused ? 'Subscriptions paused' : upcoming ? 'Opens soon' : soldOut ? 'Sold out' : 'Subscriptions open';
  const closed = state.phase !== 0 || ended || soldOut;
  const timestamp = upcoming ? Number(state.sale.start) : Number(state.sale.end);
  const date = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(timestamp * 1000));
  return <div className="ido-funding">
    <div className="ido-funding-heading"><span className="eyebrow">PLAY TO IDO</span><span className={`ido-sale-status ${closed ? 'is-closed' : ''}`}><span aria-hidden="true" />{status}</span></div>
    <h2>{state.phase === 1 ? 'IDO successfully settled' : state.phase === 2 ? 'Claim your refund' : ended ? 'Subscriptions have ended' : 'Join the launch'}</h2>
    <div className="ido-funding-total"><div><span className="small muted">Total subscribed</span><strong>{dollars(state.raised)}</strong></div><div className="ido-funding-percent"><strong>{percent.toFixed(1)}%</strong><span>of hard cap</span></div></div>
    <div className="ido-funding-track" role="progressbar" aria-label="IDO funding" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, percent)} aria-valuetext={`${dollars(state.raised)} subscribed. Soft cap ${dollars(soft)}, ${reached ? 'reached' : 'not reached'}. Hard cap ${dollars(hard)}.`}>
      <div className="ido-funding-fill" style={{ width: `${Math.min(100, percent)}%` }} />
      <span className={`ido-cap-tick ${reached ? 'is-reached' : ''}`} style={{ left: `${Math.max(0, Math.min(100, softPosition))}%` }} title={`Soft cap ${dollars(soft)}`}><span /></span>
      <span className="ido-hard-tick" title={`Hard cap ${dollars(hard)}`} />
    </div>
    <div className="ido-cap-labels"><div><span><Check size={14} aria-hidden="true" />Soft cap</span><strong>{dollars(soft)}</strong><small>{reached ? 'Reached' : 'Minimum target'}</small></div><div><span><Flag size={14} aria-hidden="true" />Hard cap</span><strong>{dollars(hard)}</strong><small>{soldOut ? 'Filled' : 'Maximum allocation'}</small></div></div>
    <div className="ido-funding-footer"><span>{closed ? <LockKeyhole size={15} aria-hidden="true" /> : null}{state.phase !== 0 && !ended ? 'Scheduled end' : upcoming ? 'Opens' : ended ? 'Ended' : 'Closes'} {date} UTC</span><strong>{state.phase === 1 ? 'Rebates ready · Tokens follow vesting' : state.phase === 2 ? 'Refunds available to subscribers' : ended ? 'No further subscriptions' : reached ? 'Soft cap reached' : `${dollars(soft - state.raised)} to soft cap`}</strong></div>
  </div>;
}
