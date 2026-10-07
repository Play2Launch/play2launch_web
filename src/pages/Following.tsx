import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, Radio, ArrowUpRight, SlidersHorizontal, Compass, Layers, Flag } from 'lucide-react';
import { useApp } from '../state';
import { api, liveAuth } from '../lib/api';
import { followingPage, type FollowCounts, type FollowItem, type FollowKind } from '../lib/follow';
import { FollowButton } from '../components/FollowButton';
import { UserAvatar } from '../components/UserAvatar';
import { ActivityFeed } from '../components/ActivityFeed';
import { PostComposer } from '../components/PostComposer';

export default function Following() {
  const app = useApp();
  return <section className="following-page">
    <div className="following-heading"><div><span className="eyebrow">THE COMMUNITY PULSE</span><h1>Feed<span className="feed-live-dot"/></h1><p className="muted">Discover what people believe in.</p></div></div>
    {!liveAuth ? <div className="empty-panel">Feed is available in the live platform.</div> : <Subscriptions key={app.user?.id || 'guest'} />}
  </section>;
}
function Subscriptions() {
  const app = useApp(), signedIn = app.user?.mode === 'live';
  const [revision,setRevision] = useState(0);
  const [kind, setKind] = useState<FollowKind | ''>('');
  const [view,setView] = useState<'discover'|'activity'|'manage'>('discover');
  const filters=<div className="feed-chips" aria-label="Following filters">{([['', 'All', Layers], ['user', 'People', Users], ['campaign', 'Campaigns', Flag]] as const).map(([value, label, Icon]) => <button key={value} className={kind===value?'selected':''} aria-pressed={kind===value} onClick={()=>setKind(value)}><Icon size={14}/>{label}</button>)}</div>;
  return <div className="feed-workspace">
    <div className="feed-main">
    <div className="feed-primary-tabs" aria-label="Feed view"><button className={view==='discover'?'selected':''} aria-pressed={view==='discover'} onClick={()=>setView('discover')}>For you</button><button className={view==='activity'?'selected':''} aria-pressed={view==='activity'} onClick={()=>setView('activity')}>Following</button></div>
    {signedIn && view!=='manage' && <PostComposer entryAvatar={<span className="avatar player-avatar"><UserAvatar name={app.user?.name} src={app.user?.avatarUrl}/></span>} onPosted={() => {setRevision(n=>n+1);setView('discover');setKind('');}} />}
    {view==='manage' && <div className="feed-manage-heading"><h2>Manage following</h2>{filters}</div>}
    {view==='discover' ? <ActivityFeed key={`discover:${kind}:${revision}`} kind={kind} discover filters={filters}/> : !signedIn ? <div className="empty-panel"><Radio size={28}/><h2>Start with people you believe in.</h2><p>Sign in to see updates from the people and campaigns you follow.</p><button className="btn btn-primary" onClick={()=>app.setAuthOpen(true)}>Sign in to follow</button></div> : view==='activity'?<ActivityFeed key={`${kind}:${revision}`} kind={kind} filters={filters}/>:<SubscriptionList key={kind} kind={kind} />}
    </div>
    <aside className="feed-sidebar" aria-label="Community shortcuts">{signedIn && <div className="feed-side-panel"><span className="eyebrow">YOUR CORNER</span><h2>Keep your people close.</h2><button aria-pressed={view==='manage'} onClick={()=>setView('manage')}><SlidersHorizontal size={18}/><span>Manage following</span><ArrowUpRight size={15}/></button></div>}<div className="feed-side-panel feed-explore"><Compass size={24}/><h2>Find your next campaign.</h2><p>Explore games, meet teams and see what the community is building.</p><Link to="/">Explore campaigns <ArrowUpRight size={16}/></Link></div></aside>
  </div>;
}
function SubscriptionList({ kind }: { kind: FollowKind | '' }) {
  const [items, setItems] = useState<FollowItem[]>([]), [next, setNext] = useState('');
  const [counts, setCounts] = useState<FollowCounts>();
  const [busy, setBusy] = useState(false), [loaded, setLoaded] = useState(false), [error, setError] = useState('');
  const lock = useRef(false), controller = useRef<AbortController>();
  async function load(after = '') {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    const ctrl = new AbortController(); controller.current = ctrl;
    if (!after) {
      setCounts(undefined);
      api.authenticated<FollowCounts>('/social/following/counts', undefined, ctrl.signal).then(c => {
        if (!ctrl.signal.aborted && c && Number.isSafeInteger(c.users) && Number.isSafeInteger(c.campaigns) && c.users >= 0 && c.campaigns >= 0) setCounts(c);
      }).catch(() => {});
    }
    try {
      const page = await followingPage(kind, after, ctrl.signal);
      if (ctrl.signal.aborted) return;
      setItems(old => after ? [...old, ...page.items.filter(i => !old.some(o => o.target_type === i.target_type && o.target_id === i.target_id))] : page.items);
      setNext(page.next_cursor); setLoaded(true);
    } catch (e) { if (!ctrl.signal.aborted) setError(e instanceof Error ? e.message : 'Could not load following.'); }
    finally { if (!ctrl.signal.aborted) { setBusy(false); lock.current = false; } }
  }
  useEffect(() => {
    void load();
    return () => { controller.current?.abort(); lock.current = false; };
  }, [kind]);
  function removed(item: FollowItem, following: boolean) {
    if (following) return;
    setItems(old => old.filter(i => i.target_type !== item.target_type || i.target_id !== item.target_id));
    setCounts(c => c ? { ...c, [item.target_type === 'user' ? 'users' : 'campaigns']: Math.max(0, c[item.target_type === 'user' ? 'users' : 'campaigns'] - 1) } : c);
  }
  return <>
    <div className="following-toolbar"><span className="muted">{counts ? `${counts.users} people · ${counts.campaigns} campaigns followed` : 'Your subscriptions'}</span><button className="text-link" disabled={busy} onClick={() => void load()}>Refresh</button></div>
    <p className="small muted">Manage the people and campaigns in your Following feed. Unfollowing does not change your team membership.</p>
    {error && <div className="notice" role="alert">{error} <button className="text-link" onClick={() => void load(loaded ? next : '')} disabled={busy}>Retry</button></div>}
    {busy && <p role="status">Loading following…</p>}
    {loaded && !items.length && !error && <div className="empty-panel"><h2>{next ? 'No visible profiles on this page.' : 'Make this space yours.'}</h2><p>Follow a player from their profile or a campaign from its overview.</p><div className="following-links"><Link className="btn btn-primary" to="/">Explore campaigns</Link><Link className="btn btn-secondary" to="/leaderboard">Find players</Link></div></div>}
    <div className="following-list">{items.map(item => {
      const isUser = item.target_type === 'user';
      const href = isUser ? `/players/${encodeURIComponent(item.target_id)}` : item.slug ? `/campaign/${encodeURIComponent(item.slug)}` : '/';
      return <article className="following-card" key={`${item.target_type}:${item.target_id}`}>
        <Link to={href} className="following-identity"><span className={`avatar ${isUser ? 'player-avatar' : 'following-campaign-avatar'}`}><UserAvatar name={item.name} src={isUser ? item.avatar_url : undefined} /></span><span><span className="eyebrow">{isUser ? 'PLAYER' : 'CAMPAIGN'}</span><strong>{item.name}</strong>{isUser && item.handle && <small className="muted">@{item.handle}</small>}</span></Link>
        <FollowButton kind={item.target_type} targetId={item.target_id} initialFollowing onChange={value => removed(item, value)} />
      </article>;
    })}</div>
    {next && <button className="btn btn-secondary" disabled={busy} onClick={() => void load(next)}>Load more</button>}
  </>;
}
