import { useEffect, useRef, useState, type ReactNode, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { UserRound, ArrowRight } from 'lucide-react';
import { useApp } from '../state';
import { api, ApiError } from '../lib/api';

type Profile = { id: string; nickname: string; avatar_url: string; handle?: string; has_nickname?: boolean };
const validName = (name: string) => Array.from(name).length >= 2 && Array.from(name).length <= 60 && !name.includes('@') && !/[\p{Cc}]/u.test(name);

function RequiredNickname({ userId }: { userId: string }) {
  const app = useApp();
  const dialog = useRef<HTMLDialogElement>(null);
  const request = useRef<AbortController>();
  const pending = useRef(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const element = dialog.current!;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      request.current?.abort();
      element.close();
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  async function save(event: FormEvent) {
    event.preventDefault();
    if (pending.current) return;
    const nickname = name.trim();
    if (!validName(nickname)) {
      setError('Use 2–60 characters, without an email address or control characters.');
      return;
    }
    pending.current = true;
    setBusy(true);
    setError('');
    const controller = new AbortController();
    request.current = controller;
    try {
      // Preserve existing profile fields, including third-party avatars.
      let profile = await api.authenticated<Profile>('/user/profile', undefined, controller.signal);
      if (controller.signal.aborted) return;
      if (profile.id !== userId || typeof profile.avatar_url !== 'string') throw new Error('Invalid profile');
      if (!profile.has_nickname) profile = await api.authenticated<Profile>('/user/profile', { nickname, avatar_url: profile.avatar_url }, controller.signal);
      if (controller.signal.aborted) return;
      if (profile.id !== userId || typeof profile.nickname !== 'string' || !validName(profile.nickname.trim()) || profile.has_nickname === false) throw new Error('Invalid profile');
      app.updatePublicName(userId, profile.nickname, profile.handle ?? '', profile.avatar_url, true);
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof ApiError ? e.message : 'Could not save your nickname. Please try again.');
    } finally {
      if (!controller.signal.aborted) { pending.current = false; setBusy(false); }
    }
  }
  return createPortal(<dialog ref={dialog} className="nickname-dialog" aria-labelledby="nickname-title" aria-describedby="nickname-description" onCancel={event => event.preventDefault()}>
    <div className="nickname-emblem"><UserRound size={28} aria-hidden="true" /></div>
    <span className="eyebrow">WELCOME TO P2L</span>
    <h2 id="nickname-title">What should we call you?</h2>
    <p id="nickname-description">Choose a nickname to continue. This is how you’ll appear in games and on leaderboards.</p>
    <form onSubmit={save} aria-busy={busy}>
      <label htmlFor="required-nickname">Your nickname</label>
      <input id="required-nickname" autoFocus autoComplete="nickname" placeholder="Enter your nickname" value={name} onChange={event => { setName(event.target.value); setError(''); }} disabled={busy} aria-describedby={error ? 'nickname-error nickname-hint' : 'nickname-hint'} aria-invalid={!!error} />
      <small id="nickname-hint">2–60 characters. You can change it later in your profile.</small>
      {error && <p id="nickname-error" role="alert">{error}</p>}
      <button className="btn btn-primary" disabled={busy || !name.trim()} type="submit">{busy ? 'Saving…' : 'Save and continue'}{!busy && <ArrowRight size={18} aria-hidden="true" />}</button>
    </form>
    <p className="nickname-required-note">Set your nickname to unlock the page.</p>
  </dialog>, document.body);
}

export function NicknameGate({ children }: { children: ReactNode }) {
  const { user } = useApp();
  return <>{children}{user?.mode === 'live' && user.nicknameSet === false && <RequiredNickname key={user.id} userId={user.id} />}</>;
}
