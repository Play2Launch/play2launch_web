// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FollowButton } from './FollowButton';
import { api } from '../lib/api';
const mock = vi.hoisted(() => ({ user: null as null | { id: string; mode: string }, signIn: vi.fn() }));
vi.mock('../state', () => ({ useApp: () => ({ user: mock.user, setAuthOpen: mock.signIn }) }));
vi.mock('../lib/api', () => ({ api: { authenticated: vi.fn() } }));
afterEach(() => { cleanup(); mock.user = null; vi.mocked(api.authenticated).mockReset(); mock.signIn.mockReset(); });
it('prompts guests without requesting private follow state', () => {
  render(<FollowButton kind="user" targetId="ur2" />);
  fireEvent.click(screen.getByRole('button', { name: 'Follow' }));
  expect(mock.signIn).toHaveBeenCalledWith(true); expect(api.authenticated).not.toHaveBeenCalled();
});
it('hides self-follow', () => {
  mock.user = { id: 'ur2', mode: 'live' }; render(<FollowButton kind="user" targetId="ur2" />);
  expect(screen.queryByRole('button')).toBeNull(); expect(api.authenticated).not.toHaveBeenCalled();
});
it('loads authoritative status and toggles without a forged actor', async () => {
  mock.user = { id: 'ur1', mode: 'live' };
  vi.mocked(api.authenticated).mockResolvedValueOnce({ following: false, followers_count: 3 }).mockResolvedValueOnce({ following: true, followers_count: 4 });
  render(<FollowButton kind="campaign" targetId="cp1" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Follow' }));
  await screen.findByRole('button', { name: 'Following' });
  expect(screen.getByText('4 followers')).toBeTruthy();
  expect(vi.mocked(api.authenticated).mock.calls[1].slice(0, 2)).toEqual(['/social/campaign/cp1/follow', { following: true }]);
});
it('retains follow state after a failed write and avoids per-card GETs', async () => {
  mock.user = { id: 'ur1', mode: 'live' }; vi.mocked(api.authenticated).mockRejectedValue(new Error('Offline'));
  render(<FollowButton kind="user" targetId="ur2" initialFollowing />);
  expect(api.authenticated).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole('button', { name: 'Following' }));
  await screen.findByRole('alert'); expect(screen.getByRole('button', { name: 'Following' }).getAttribute('aria-pressed')).toBe('true');
});
it('does not show a previous account response after switching identity', async () => {
  mock.user = { id: 'ur1', mode: 'live' }; let resolve!: (value: unknown) => void;
  vi.mocked(api.authenticated).mockReturnValueOnce(new Promise(r => { resolve = r; }));
  const view = render(<FollowButton kind="user" targetId="ur2" />);
  mock.user = null; view.rerender(<FollowButton kind="user" targetId="ur2" />);
  resolve({ following: true, followers_count: 2 });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Follow' })).toBeTruthy());
  expect(screen.queryByText('2 followers')).toBeNull();
});
