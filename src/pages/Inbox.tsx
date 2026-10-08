import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Mail, ShieldCheck } from 'lucide-react';
import { api, liveAuth } from '../lib/api';
import { useApp } from '../state';

type Message = { id: string; sender_type: 'system'; title: string; body: string; created_at: string; read_at?: string };
type InboxData = { items: Message[]; unread_count: number };

export function InboxLink() {
  const { user } = useApp();
  const location = useLocation();
  const [count, setCount] = useState(0);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const onChange = () => setRefresh(value => value + 1);
    window.addEventListener('p2l-inbox-changed', onChange);
    return () => window.removeEventListener('p2l-inbox-changed', onChange);
  }, []);
  useEffect(() => {
    if (!liveAuth || user?.mode !== 'live') { setCount(0); return; }
    const controller = new AbortController();
    api.authenticated<InboxData>('/messages', undefined, controller.signal)
      .then(data => { if (!controller.signal.aborted) setCount(data.unread_count); })
      .catch(() => { if (!controller.signal.aborted) setCount(0); });
    return () => controller.abort();
  }, [user?.id, user?.mode, location.pathname, refresh]);
  if (!liveAuth || user?.mode !== 'live') return null;
  return <Link className="inbox-link" to="/messages" aria-label={`Messages${count ? `, ${count} unread` : ''}`} title="Messages">
    <Mail size={20} aria-hidden="true" />{count > 0 && <span className="inbox-count">{count > 99 ? '99+' : count}</span>}
  </Link>;
}

export default function InboxPage() {
  const { user } = useApp();
  const [data, setData] = useState<InboxData | null>(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!liveAuth || user?.mode !== 'live') return;
    const controller = new AbortController();
    api.authenticated<InboxData>('/messages', undefined, controller.signal)
      .then(value => { if (!controller.signal.aborted) { setData(value); setError(''); } })
      .catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Could not load messages.'); });
    return () => controller.abort();
  }, [user?.id, user?.mode, retry]);
  async function markRead(id: string) {
    setBusyId(id);
    try {
      await api.authenticated(`/messages/${encodeURIComponent(id)}/read`, {});
      setData(current => current ? { items: current.items.map(item => item.id === id ? { ...item, read_at: new Date().toISOString() } : item), unread_count: Math.max(0, current.unread_count - 1) } : current);
      window.dispatchEvent(new Event('p2l-inbox-changed'));
      setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not mark message as read.'); }
    finally { setBusyId(''); }
  }
  if (!liveAuth || user?.mode !== 'live') return <div className="inbox-page"><h1>Messages</h1><p>Sign in to view your messages.</p></div>;
  return <div className="inbox-page">
    <div className="inbox-heading"><div><p className="eyebrow">YOUR INBOX</p><h1>Messages</h1><p>Important updates from P2L appear here.</p></div>{data && <span className="inbox-unread">{data.unread_count} unread</span>}</div>
    {error && <div role="alert" className="inline-note">{error} <button className="btn btn-secondary" onClick={() => setRetry(value => value + 1)}>Retry</button></div>}
    {!data && !error && <p>Loading messages…</p>}
    {data?.items.length === 0 && <div className="inbox-empty"><Mail size={28} aria-hidden="true" /><h2>No messages yet</h2><p>KOL review results and other important system updates will appear here.</p></div>}
    <div className="inbox-list">{data?.items.map(item => <article className={`inbox-item ${item.read_at ? '' : 'unread'}`} key={item.id}>
      <div className="inbox-system-icon" aria-hidden="true"><ShieldCheck size={22}/></div>
      <div className="inbox-message"><div className="inbox-message-meta"><span className="inbox-system-name">P2L System <ShieldCheck size={14} aria-hidden="true" /></span><time dateTime={item.created_at}>{new Date(item.created_at).toLocaleString()}</time></div>
        <h2>{item.title}{!item.read_at && <span className="inbox-new">New</span>}</h2><p>{item.body}</p>
        {!item.read_at && <button type="button" className="btn btn-secondary" disabled={busyId === item.id} onClick={() => void markRead(item.id)}>{busyId === item.id ? 'Saving…' : 'Mark as read'}</button>}
      </div>
    </article>)}</div>
  </div>;
}
