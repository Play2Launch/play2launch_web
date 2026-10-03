import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Flag, ArrowUpRight, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';
import type { FollowKind } from '../lib/follow';
import { PostCard } from './PostCard';
import { CampaignActivity, type CampaignEvent } from './CampaignActivity';
import { useApp } from '../state';
import type { TeamAttachment, TeamEntryAction } from './TeamPost';

export type Activity = { event?: CampaignEvent; scoring_ends_at?: string; author_kol_verified?: boolean; author_avatar_url?: string; team?: TeamAttachment; team_action?: TeamEntryAction; type?: 'score' | 'post' | 'campaign'; text?: string; session_id?: string; played_at?: string; user_id?: string; author?: string; score?: number; game_key?: string; rules?: string; id: string; campaign_id: string; name: string; slug: string; milestone: number; points: number; target: number; score_per_point: number; reason: 'participation' | 'goal_adjusted'; at: string };
type FeedPage = { items: Activity[]; next_cursor: string };
function valid(page: FeedPage): boolean {
  return !!page && typeof page.next_cursor === 'string' && Array.isArray(page.items) && page.items.every(i => {
    if (!i || typeof i.id !== 'string' || !Number.isFinite(Date.parse(i.at))) return false;
    if (i.type === 'campaign') return ['started','ending_24h','ending_1h','scoring_ended'].includes(i.event || '') && i.id === `${i.campaign_id}:lifecycle:${i.event}` && /^cp[0-9a-z]{1,32}$/.test(i.campaign_id) && typeof i.name === 'string' && /^[a-z0-9][a-z0-9-]{0,63}$/.test(i.slug) && Number.isFinite(Date.parse(i.scoring_ends_at || ''));
    const author = /^ur[0-9a-z]{1,32}$/.test(i.user_id || '') && typeof i.author === 'string';
    const result = /^cp[0-9a-z]{1,32}$/.test(i.campaign_id) && typeof i.name === 'string' && typeof i.slug === 'string' && /^[a-z0-9][a-z0-9-]{0,63}$/.test(i.slug) && Number.isSafeInteger(i.score) && i.score! >= 0;
    if (i.team && (!result || i.session_id || !/^tm[0-9a-z]{1,13}$/.test(i.team.id) || typeof i.team.name !== 'string' || !/^[A-Za-z0-9_-]{32}$/.test(i.team.invite_token) || !Number.isFinite(Date.parse(i.team.as_of)) || ![i.team.players,i.team.score,i.team.rank,i.team.contribution,i.team.member_rank].every(n=>Number.isSafeInteger(n)&&n>=0))) return false;
    if (i.type === 'post') return /^sp[0-9a-f]{64}$/.test(i.id) && author && typeof i.text === 'string' && Array.from(i.text).length <= 500 && (!i.session_id || result && /^gs[0-9a-z]{1,13}$/.test(i.session_id) && Number.isFinite(Date.parse(i.played_at || '')));
    if (i.type === 'score') return author && result;
    return /^cp[0-9a-z]{1,32}$/.test(i.campaign_id) && typeof i.name === 'string' && /^[a-z0-9][a-z0-9-]{0,63}$/.test(i.slug) && [25, 50, 75, 100].includes(i.milestone) && Number.isSafeInteger(i.points) && i.points >= 0 && Number.isSafeInteger(i.target) && i.target > 0 && ['participation', 'goal_adjusted'].includes(i.reason);
  });
}
export function ActivityFeed({ kind, authorId, discover = false, filters, postId }: { kind: FollowKind | ''; authorId?: string; discover?: boolean; filters?: ReactNode; postId?: string }) {
  const app=useApp(), viewer=app.user?.mode==='live'?app.user.id:'';
  const [items, setItems] = useState<Activity[]>([]), [next, setNext] = useState('');
  const [busy, setBusy] = useState(false), [loaded, setLoaded] = useState(false), [error, setError] = useState('');
  const request = useRef<AbortController>(), lock = useRef(false), retryAfter = useRef('');
  const followCache = useRef<{ viewer: string; entries: Map<string, { value: boolean; at: number }> }>({ viewer, entries: new Map() });
  const [followStates, setFollowStates] = useState<Record<string, boolean>>({});
  function updateFollowing(author: string, value: boolean) {
    if (followCache.current.viewer !== viewer) return;
    followCache.current.entries.set(author, { value, at: Date.now() });
    setFollowStates(old => ({ ...old, [author]: value }));
  }
  async function load(after = '') {
    if (lock.current) return;
    lock.current = true; retryAfter.current = after; setBusy(true); setError('');
    const ctrl = new AbortController(); request.current = ctrl;
    const query = new URLSearchParams(); if (kind) query.set('kind', kind); if (after) query.set('after', after);
    try {
      const path = authorId ? `/players/${encodeURIComponent(authorId)}/posts${after ? '?after=' + encodeURIComponent(after) : ''}` : `/social/${discover ? 'discover' : 'feed'}${query.size ? '?' + query : ''}`;
      const page = postId ? { items: [await api.request<Activity>(`/social/posts/${encodeURIComponent(postId)}`, undefined, { signal: ctrl.signal })], next_cursor: '' } : authorId || discover
        ? await api.request<FeedPage>(path, undefined, { signal: ctrl.signal })
        : await api.authenticated<FeedPage>(path, undefined, ctrl.signal);
      if (!valid(page)) throw new Error('Could not read activity updates. Please retry.');
      if (discover && viewer) {
        if (followCache.current.viewer !== viewer) followCache.current = { viewer, entries: new Map() };
        const cache = followCache.current.entries;
        const authors = [...new Set(page.items.filter(i => i.type === 'post' && i.user_id !== viewer).map(i => i.user_id!))];
        const missing = authors.filter(id => !cache.has(id) || Date.now() - cache.get(id)!.at >= 30_000);
        if (missing.length) {
          // Snapshot entries to avoid replacing a successful toggle during this read.
          const before = new Map(missing.map(id => [id, cache.get(id)]));
          const states = await api.authenticated<Record<string, boolean>>('/social/follow-states', { user_ids: missing }, ctrl.signal);
          if (!states || missing.some(id => typeof states[id] !== 'boolean')) throw new Error('Could not read follow states. Please retry.');
          if (ctrl.signal.aborted) return;
          for (const id of missing) if (cache.get(id) === before.get(id)) cache.set(id, { value: states[id], at: Date.now() });
        }
        if (ctrl.signal.aborted) return;
        setFollowStates(Object.fromEntries([...cache].map(([id, state]) => [id, state.value])));
      }
      const teamPosts=page.items.filter(i=>i.team);
      if(teamPosts.length){
        const actions=viewer?await api.authenticated<Record<string,TeamEntryAction>>('/social/team-entries',{post_ids:teamPosts.map(i=>i.id)},ctrl.signal):{};
        for(const item of teamPosts) item.team_action=viewer?(['join','own','none','expired','closed'].includes(actions?.[item.id])?actions[item.id]:'none'):'guest';
      }
      if (ctrl.signal.aborted) return;
      setItems(old => after ? [...old, ...page.items.filter(i => !old.some(o => o.id === i.id))] : page.items);
      setNext(page.next_cursor); setLoaded(true);
    } catch (e) { if (!ctrl.signal.aborted) setError(e instanceof Error ? e.message : 'Could not load activity.'); }
    finally { if (!ctrl.signal.aborted) { lock.current = false; setBusy(false); } }
  }
  useEffect(() => { setItems([]);setNext('');setLoaded(false);void load(); return () => { request.current?.abort(); lock.current = false; }; }, [kind, authorId, viewer, discover, postId]);
  return <section aria-label="Following activity">
    <div className={`following-toolbar${filters ? ' feed-filter-toolbar' : ''}`}>{filters || <span className="muted">{authorId ? 'Public posts' : discover ? 'Discover public posts, game results and campaign updates' : 'Latest updates from people and campaigns you follow'}</span>}<button className="feed-refresh" aria-label="Refresh activity" title="Refresh activity" disabled={busy} onClick={() => void load()}><RefreshCw size={16}/></button></div>
    {error && <div className="notice" role="alert">{postId && <p>This post may be unavailable, or could not be loaded.</p>}{error} <button className="text-link" disabled={busy} onClick={() => void load(retryAfter.current)}>Retry activity</button></div>}
    {busy && <p role="status">Loading activity…</p>}
    {loaded && !items.length && !error && <div className="empty-panel"><Flag size={28} /><h2>No updates yet.</h2><p>{discover ? 'Discover campaigns and players while the community gets started.' : 'Follow players to see results they choose to share, or campaigns to see unlock milestones.'}</p><Link className="btn btn-secondary" to="/">Explore campaigns</Link>{discover && <Link className="text-link" to="/leaderboard">Find players →</Link>}</div>}
    <div className="activity-list activity-timeline">{items.map(item => <article className={`activity-card${item.type === 'post' ? ' activity-post' : ''}`} key={item.id}>
      {item.type === 'post' ? <PostCard item={item} discover={discover} following={!!viewer && followStates[item.user_id!] === true} onFollowChange={value => updateFollowing(item.user_id!, value)} removed={() => setItems(old => old.filter(p => p.id !== item.id))} /> : item.type === 'score' ? <>
        <header><span className="eyebrow">VERIFIED GAME RESULT</span><time className="small muted" dateTime={item.at}>{new Date(item.at).toLocaleString()}</time></header>
        <Link className="activity-campaign" to={`/players/${item.user_id}`}>{item.author}</Link>
        <h2>{item.score?.toLocaleString()} game points</h2>
        <p>{item.name} · {item.game_key} · {item.rules}</p>
        <p className="small muted">Shared by the player. Server-accepted result, not P2L Points.</p>
        <Link className="text-link" to={`/campaign/${encodeURIComponent(item.slug)}`}>View campaign <ArrowUpRight size={16} /></Link>
      </> : item.type === 'campaign' ? <CampaignActivity item={item}/> : <>
      <header><span className="eyebrow"><Flag size={15} /> CAMPAIGN UPDATE</span><time className="small muted" dateTime={item.at}>{new Date(item.at).toLocaleString()}</time></header>
      <Link className="activity-campaign" to={`/campaign/${encodeURIComponent(item.slug)}`}>{item.name}</Link>
      <h2>{item.milestone === 100 ? 'Community goal reached.' : `${item.milestone}% of the unlock goal reached.`}</h2>
      {item.reason === 'goal_adjusted' && <p className="activity-adjusted">After an update to the campaign target or points conversion rule.</p>}
      <div className="progress-track" role="progressbar" aria-label={`${item.name} progress when posted`} aria-valuenow={Math.min(100, Math.floor(item.points / item.target * 100))} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${Math.min(100, item.points / item.target * 100)}%` }} /></div>
      <p><strong className="accent">{item.points.toLocaleString()}</strong> / {item.target.toLocaleString()} unlock points <span className="small muted">· Snapshot when posted</span></p>
      {item.milestone === 100 && <p className="small muted">The contribution goal is met. This does not mean the asset has launched or is available to trade.</p>}
      <Link className="text-link" to={`/campaign/${encodeURIComponent(item.slug)}`}>View campaign <ArrowUpRight size={16} /></Link>
      </>}
    </article>)}</div>
    {next && <button className="btn btn-secondary" disabled={busy} onClick={() => void load(next)}>Load more activity</button>}
  </section>;
}
