import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';

export function ScoreShare({ sessionId }: { sessionId: string }) {
  const [shared, setShared] = useState<boolean>(), [busy, setBusy] = useState(false), [error, setError] = useState(''), [retry, setRetry] = useState(0);
  const lock = useRef(false), request = useRef<AbortController>();
  useEffect(() => {
    const ctrl = new AbortController(); request.current = ctrl;
    setError(''); setShared(undefined);
    api.authenticated<{ shared: boolean }>(`/social/scores/${encodeURIComponent(sessionId)}`, undefined, ctrl.signal)
      .then(v => { if (typeof v?.shared !== 'boolean') throw new Error('Could not read sharing status.'); if (!ctrl.signal.aborted) setShared(v.shared); })
      .catch(e => { if (!ctrl.signal.aborted) setError(e instanceof Error ? e.message : 'Could not read sharing status.'); });
    return () => { ctrl.abort(); request.current?.abort(); };
  }, [sessionId, retry]);
  async function toggle() {
    if (lock.current || shared === undefined) return;
    lock.current = true; setBusy(true); setError('');
    const ctrl = new AbortController(); request.current = ctrl;
    try {
      const v = await api.authenticated<{ shared: boolean }>(`/social/scores/${encodeURIComponent(sessionId)}`, { shared: !shared }, ctrl.signal);
      if (typeof v?.shared !== 'boolean') throw new Error('Could not update sharing status.');
      if (!ctrl.signal.aborted) setShared(v.shared);
    } catch (e) { if (!ctrl.signal.aborted) setError(e instanceof Error ? e.message : 'Could not share score.'); }
    finally { lock.current = false; if (!ctrl.signal.aborted) setBusy(false); }
  }
  return <div className="membership-card">
    <h3>Share your result</h3>
    <p>{shared ? 'This result is visible in your followers’ feed. You can withdraw it without changing your score or ranking.' : 'Sharing publishes your name, campaign and verified game score to your followers. Nothing is posted automatically.'}</p>
    <button className="btn btn-secondary" disabled={busy || shared === undefined} onClick={() => void toggle()}>{busy ? 'Please wait…' : shared ? 'Withdraw shared result' : 'Share verified score'}</button>
    {error && <p role="alert">{error} {shared === undefined && <button className="text-link" onClick={() => setRetry(n => n + 1)}>Retry sharing status</button>}</p>}
  </div>;
}
