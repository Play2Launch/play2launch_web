import { useEffect, useRef, useState } from 'react';
import { Check, UserPlus } from 'lucide-react';
import { useApp } from '../state';
import { api } from '../lib/api';
import { followPath, validFollowState, type FollowKind, type FollowState } from '../lib/follow';

type Props = { kind: FollowKind; targetId: string; initialFollowing?: boolean; onChange?: (following: boolean) => void };
export function FollowButton(props: Props) {
  const app = useApp();
  if (props.kind === 'user' && app.user?.id === props.targetId) return null;
  return <Control key={`${app.user?.id || 'guest'}:${props.kind}:${props.targetId}`} {...props} />;
}
function Control({ kind, targetId, initialFollowing, onChange }: Props) {
  const app = useApp();
  const signedIn = app.user?.mode === 'live';
  const [state, setState] = useState<FollowState | undefined>(initialFollowing === undefined ? undefined : { following: initialFollowing, followers_count: 0 });
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [retry, setRetry] = useState(0);
  const pending = useRef(false), active = useRef(true);
  const request = useRef<AbortController>();
  useEffect(() => { active.current = true; return () => { active.current = false; request.current?.abort(); }; }, []);
  useEffect(() => {
    if (initialFollowing !== undefined) setState({ following: initialFollowing, followers_count: 0 });
  }, [initialFollowing]);
  useEffect(() => {
    if (!signedIn || initialFollowing !== undefined) return;
    const ctrl = new AbortController(); setBusy(true); setError('');
    api.authenticated<FollowState>(followPath(kind, targetId), undefined, ctrl.signal).then(value => {
      if (!validFollowState(value)) throw new Error('Could not read follow status.');
      if (!ctrl.signal.aborted) setState(value);
    }).catch(e => { if (!ctrl.signal.aborted) setError(e instanceof Error ? e.message : 'Could not read follow status.'); })
      .finally(() => { if (!ctrl.signal.aborted) setBusy(false); });
    return () => ctrl.abort();
  }, [signedIn, kind, targetId, retry, initialFollowing]);
  async function toggle() {
    if (!signedIn) { app.setAuthOpen(true); return; }
    if (pending.current || !state) return;
    pending.current = true; setBusy(true); setError('');
    const ctrl = new AbortController(); request.current = ctrl;
    try {
      const value = await api.authenticated<FollowState>(followPath(kind, targetId), { following: !state.following }, ctrl.signal);
      if (!validFollowState(value)) throw new Error('Could not update follow status.');
      if (active.current && !ctrl.signal.aborted) { setState(value); onChange?.(value.following); }
    } catch (e) { if (active.current && !ctrl.signal.aborted) setError(e instanceof Error ? e.message : 'Could not update follow status.'); }
    finally { pending.current = false; if (active.current) setBusy(false); }
  }
  return <div className="follow-control">
    <button className={`btn ${state?.following ? 'btn-secondary' : 'btn-primary'}`} disabled={busy || (signedIn && !state)} aria-pressed={!!state?.following} onClick={() => void toggle()}>
      {state?.following ? <Check size={16} aria-hidden="true" /> : <UserPlus size={16} aria-hidden="true" />}
      {busy ? 'Please wait…' : state?.following ? 'Following' : 'Follow'}
    </button>
    {state && initialFollowing === undefined && <span className="small muted">{state.followers_count.toLocaleString()} followers</span>}
    {error && <div className="small" role="alert">{error} {!state && <button className="text-link" onClick={() => setRetry(r => r + 1)}>Retry follow status</button>}</div>}
  </div>;
}
