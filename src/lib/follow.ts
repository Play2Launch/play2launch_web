import { api } from './api';
export type FollowKind = 'user' | 'campaign';
export type FollowState = { following: boolean; followers_count: number; source?: string };
export type FollowItem = { user_id: string; target_type: FollowKind; target_id: string; name: string; handle?: string; avatar_url?: string; slug?: string };
export type FollowPage = { items: FollowItem[]; next_cursor: string };
export type FollowCounts = { users: number; campaigns: number };
export function followPath(kind: FollowKind, id: string) {
  return `/social/${kind}/${encodeURIComponent(id)}/follow`;
}
export function validFollowState(value: unknown): value is FollowState {
  const v = value as FollowState | null;
  return !!v && typeof v.following === 'boolean' && Number.isSafeInteger(v.followers_count) && v.followers_count >= 0;
}
export async function followingPage(kind: FollowKind | '', after: string, signal: AbortSignal) {
  const query = new URLSearchParams();
  if (kind) query.set('kind', kind);
  if (after) query.set('after', after);
  const page = await api.authenticated<FollowPage>(`/social/following${query.size ? '?' + query : ''}`, undefined, signal);
  if (!page || !Array.isArray(page.items) || typeof page.next_cursor !== 'string' || !page.items.every(i =>
    i && ['user', 'campaign'].includes(i.target_type) && typeof i.target_id === 'string' && typeof i.name === 'string' &&
    (i.target_type === 'user' ? /^ur[0-9a-z]{1,32}$/.test(i.target_id) : /^cp[0-9a-z]{1,32}$/.test(i.target_id))
  )) throw new Error('Could not read your following list. Please retry.');
  return page;
}
