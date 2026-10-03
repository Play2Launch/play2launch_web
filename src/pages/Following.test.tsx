// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Following from './Following';
import { api } from '../lib/api';
const mock = vi.hoisted(() => ({ user: { id: 'ur1', mode: 'live' } as null | { id: string; mode: string }, signIn: vi.fn() }));
vi.mock('../state', () => ({ useApp: () => ({ user: mock.user, setAuthOpen: mock.signIn }) }));
vi.mock('../lib/api', () => ({ liveAuth: true, api: { authenticated: vi.fn(), request: vi.fn(async()=>({items:[],next_cursor:''})) } }));
const person = { user_id: 'ur1', target_type: 'user', target_id: 'ur2', name: 'Paper Captain', handle: 'captain' };
const campaign = { user_id: 'ur1', target_type: 'campaign', target_id: 'cp1', name: 'Moon Run', slug: 'moon-run' };
function mount() { const view=render(<MemoryRouter><Following /></MemoryRouter>); if(mock.user)fireEvent.click(screen.getByRole('button',{name:'Manage following'})); return view; }
afterEach(() => { cleanup(); mock.user = { id: 'ur1', mode: 'live' }; vi.mocked(api.authenticated).mockReset(); mock.signIn.mockReset(); });
it('keeps guest state private and My teams reachable', () => {
  mock.user = null; mount(); expect(api.authenticated).not.toHaveBeenCalled();
  expect(screen.getByRole('link', { name: /My teams/ }).getAttribute('href')).toBe('/teams');
  expect(api.request).toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Following' }));
  fireEvent.click(screen.getByRole('button', { name: 'Sign in to follow' })); expect(mock.signIn).toHaveBeenCalledWith(true);
});
it('shows hydrated cards, filters, and removes unfollowed cards without card GETs', async () => {
  vi.mocked(api.authenticated).mockImplementation(async (path, body) => {
    if (path.endsWith('/counts')) return { users: 1, campaigns: 1 };
    if (body) return { following: false, followers_count: 0 };
    return { items: path.includes('kind=campaign') ? [campaign] : [person, campaign], next_cursor: '' };
  });
  mount(); await screen.findByText('Paper Captain');
  expect(screen.getByRole('link', { name: /Moon Run/ }).getAttribute('href')).toBe('/campaign/moon-run');
  expect(vi.mocked(api.authenticated).mock.calls.filter(([path])=>path!=='/social/feed')).toHaveLength(2);
  fireEvent.click(screen.getAllByRole('button', { name: 'Following' })[1]);
  await waitFor(() => expect(screen.queryByText('Paper Captain')).toBeNull());
  fireEvent.click(screen.getByRole('button', { name: 'Campaigns' }));
  await screen.findByText('Moon Run');
  expect(vi.mocked(api.authenticated).mock.calls.some(([path]) => path === '/social/following?kind=campaign')).toBe(true);
});
it('retains list when load-more fails and retries the same cursor', async () => {
  let attempts = 0;
  vi.mocked(api.authenticated).mockImplementation(async path => {
    if (path.endsWith('/counts')) return { users: 1, campaigns: 1 };
    if (path.includes('after=')) { if (++attempts === 1) throw new Error('Offline'); return { items: [campaign], next_cursor: '' }; }
    return { items: [person], next_cursor: 'ur1:user:ur2' };
  });
  mount(); fireEvent.click(await screen.findByRole('button', { name: 'Load more' }));
  await screen.findByRole('alert'); expect(screen.getByText('Paper Captain')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Retry' })); await screen.findByText('Moon Run'); expect(attempts).toBe(2);
});
it('does not fall back to demo content for an empty list', async () => {
  vi.mocked(api.authenticated).mockImplementation(async path => path.endsWith('/counts') ? { users: 0, campaigns: 0 } : { items: [], next_cursor: '' });
  mount(); await screen.findByText('Make this space yours.'); expect(screen.getByRole('link', { name: 'Find players' })).toBeTruthy();
});
