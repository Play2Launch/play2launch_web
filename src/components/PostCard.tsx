import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../state';
import { api } from '../lib/api';
import type { Activity } from './ActivityFeed';
import { TeamPostCard } from './TeamPost';
import { UserAvatar } from './UserAvatar';
import { VerifiedKol } from './VerifiedKol';
import { FollowButton } from './FollowButton';
import { PostShare } from './PostShare';
import { ResultGameLabel } from './ResultGameLabel';
import { ResultWatermark } from './ResultWatermark';
import { Trash2, Flag, MoreHorizontal } from 'lucide-react';

export function PostCard({ item, removed, discover = false, following = false, onFollowChange }: { item: Activity; removed: () => void; discover?: boolean; following?: boolean; onFollowChange?: (value: boolean) => void }) {
  const app = useApp(), own = app.user?.id === item.user_id;
  const [confirm, setConfirm] = useState(false), [report, setReport] = useState(false), [reason, setReason] = useState('spam'), [sent, setSent] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const lock = useRef(false);
  async function act(action: 'delete' | 'report') {
    if (lock.current) return; lock.current = true; setBusy(true); setError('');
    try { await api.authenticated(`/social/posts/${item.id}/${action}`, action === 'report' ? { reason } : {}); if (action === 'delete') removed(); else { setSent(true); setReport(false); } }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not complete action.'); }
    finally { lock.current = false; setBusy(false); }
  }
  return <div className="post-layout">
    <header className="post-author-header"><Link className="post-author" to={`/players/${item.user_id}`}><span className="avatar player-avatar"><UserAvatar name={item.author} src={item.author_avatar_url}/></span><strong>{item.author || 'Player'}</strong></Link>{item.author_kol_verified === true && <VerifiedKol/>}<span className="post-time-separator" aria-hidden="true">·</span><time className="small muted" dateTime={item.at} title={new Date(item.at).toLocaleString()}>{new Date(item.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(new Date(item.at).getFullYear() !== new Date().getFullYear() ? {year:'numeric' as const} : {}) })}</time></header>
    {discover && !own && item.user_id && <div className="post-follow"><FollowButton kind="user" targetId={item.user_id} initialFollowing={following} onChange={onFollowChange}/></div>}
    <p className="post-body">{item.text}</p>
    {item.team&&<TeamPostCard item={item}/>}
    {item.session_id && <div className="post-result post-result-watermarked"><ResultWatermark src={item.cover_image}/><span className="eyebrow">VERIFIED GAME RESULT</span><h2>{item.score?.toLocaleString()} game points</h2><p><ResultGameLabel name={item.name}/></p><p className="small muted">Played {new Date(item.played_at!).toLocaleString()} · Not P2L Points</p><Link className="text-link" to={`/campaign/${encodeURIComponent(item.slug)}`}>View campaign ↗</Link></div>}
    {(own || app.user?.mode === 'live' && !sent) && <details className="post-options"><summary aria-label="Post options" title="Post options"><MoreHorizontal size={18}/></summary><div className="post-options-menu">{own ? <button className="post-action post-action-delete" disabled={busy} onClick={e => {setConfirm(v => !v);e.currentTarget.closest('details')?.removeAttribute('open');}}><Trash2 size={14} aria-hidden="true"/>Delete post</button> : <button className="post-action" disabled={busy} onClick={e => {setReport(v => !v);e.currentTarget.closest('details')?.removeAttribute('open');}}><Flag size={14} aria-hidden="true"/>Report post</button>}</div></details>}
    {confirm && <div className="notice">Delete this public post? Your score and ranking stay unchanged.<div className="following-links"><button className="btn btn-secondary" disabled={busy} onClick={() => void act('delete')}>Confirm delete</button><button className="text-link" disabled={busy} onClick={() => setConfirm(false)}>Cancel</button></div></div>}
    {report && <div className="notice"><label>Report reason <select value={reason} disabled={busy} onChange={e => setReason(e.target.value)}><option value="spam">Spam</option><option value="abuse">Abuse</option><option value="misleading">Misleading</option><option value="other">Other</option></select></label><div className="following-links"><button className="btn btn-secondary" disabled={busy} onClick={() => void act('report')}>Submit report</button><button className="text-link" disabled={busy} onClick={() => setReport(false)}>Cancel</button></div></div>}
    {sent && <p role="status">Report submitted for review.</p>}{error && <p role="alert">{error}</p>}
    <PostShare id={item.id}/>
  </div>;
}
