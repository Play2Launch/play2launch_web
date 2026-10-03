// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { api, type SignedIn } from '../lib/api';
import { followingPage } from '../lib/follow';
import { ActivityFeed } from './ActivityFeed';
import { FollowButton } from './FollowButton';
import { PostComposer } from './PostComposer';

const transport = vi.hoisted(() => vi.fn());
vi.mock('../lib/api', async importOriginal => {
  const real = await importOriginal<typeof import('../lib/api')>();
  return { ...real, api: new real.ApiClient('https://social-api.test/api/v1', transport) };
});
vi.mock('../state', () => ({ useApp: () => ({ user: { id: 'ur1', mode: 'live' }, setAuthOpen: vi.fn() }) }));
const reply = (data: unknown) => new Response(JSON.stringify({ code: 0, data }), { status: 200 });
afterEach(() => { cleanup(); api.logout(); transport.mockReset(); });

for (const kind of ['account', 'telegram'] as const) {
  function login() {
    const credential: SignedIn['credential'] = kind === 'account' ? { kind, accountId: 'ac1', token: 'test-token' } : { kind, token: 'test-init-data' };
    api.remember({ kind: 'authenticated', user: { id: 'ur1', name: 'Player', mode: 'live' }, credential });
  }
  function verifyHeaders() {
    expect(transport.mock.calls.length).toBeGreaterThan(0);
    for (const [, init] of transport.mock.calls) expect(new Headers(init.headers).get('Authorization')).toBe(kind === 'account' ? 'bearer test-token' : 'tma test-init-data');
  }
  it(`${kind}: feed and subscriptions send credentials through the real client`, async () => {
    login(); transport.mockImplementation(async () => reply({ items: [], next_cursor: '' }));
    render(<MemoryRouter><ActivityFeed kind="" /></MemoryRouter>);
    await screen.findByText('No updates yet.');
    await followingPage('', '', new AbortController().signal);
    expect(transport.mock.calls.map(c => c[0])).toEqual(['https://social-api.test/api/v1/social/feed', 'https://social-api.test/api/v1/social/following']);
    verifyHeaders();
  });
  it(`${kind}: follow and publish writes send credentials through the real client`, async () => {
    login(); transport.mockImplementation(async (url: string, init: RequestInit) => {
      if (url.endsWith('/follow')) return reply({ following: init.method === 'POST', followers_count: 1 });
      return reply({ id: 'sp' + 'a'.repeat(64) });
    });
    render(<><FollowButton kind="user" targetId="ur2" /><PostComposer /></>);
    await screen.findByText('1 followers');
    fireEvent.click(screen.getByRole('button', { name: 'Follow' }));
    await screen.findByRole('button', { name: 'Following' });
    fireEvent.click(screen.getByRole('button', { name: 'Write a post' }));
    fireEvent.change(screen.getByLabelText('Your post'), { target: { value: 'My game today' } });
    fireEvent.click(screen.getByRole('button', { name: 'Publish publicly' }));
    await screen.findByText(/Your post is public/);
    expect(transport.mock.calls.filter(([, init]) => init.method === 'POST')).toHaveLength(2);
    verifyHeaders();
  });
}
it('public player posts remain anonymous, even with an active credential', async () => {
  api.remember({ kind: 'authenticated', user: { id: 'ur1', name: 'Player', mode: 'live' }, credential: { kind: 'account', accountId: 'ac1', token: 'test-token' } });
  transport.mockImplementation(async () => reply({ items: [], next_cursor: '' }));
  render(<MemoryRouter><ActivityFeed kind="user" authorId="ur2" /></MemoryRouter>);
  await screen.findByText('No updates yet.');
  expect(transport.mock.calls[0][0]).toBe('https://social-api.test/api/v1/players/ur2/posts');
  expect(new Headers(transport.mock.calls[0][1].headers).has('Authorization')).toBe(false);
});
it('For you reads public discovery without sending credentials', async () => {
  api.remember({ kind: 'authenticated', user: { id: 'ur1', name: 'Player', mode: 'live' }, credential: { kind: 'account', accountId: 'ac1', token: 'test-token' } });
  transport.mockImplementation(async () => reply({ items: [], next_cursor: '' }));
  render(<MemoryRouter><ActivityFeed kind="" discover /></MemoryRouter>);
  await screen.findByText('No updates yet.');
  expect(transport.mock.calls[0][0]).toBe('https://social-api.test/api/v1/social/discover');
  expect(new Headers(transport.mock.calls[0][1].headers).has('Authorization')).toBe(false);
});
it('a direct post link is fetched publicly without credentials',async()=>{
 const id='sp'+'a'.repeat(64);
 transport.mockImplementation(async()=>reply({id,type:'post',user_id:'ur1',author:'Player',text:'Public detail',at:'2026-10-01T10:00:00Z'}));
 render(<MemoryRouter><ActivityFeed kind="user" postId={id}/></MemoryRouter>);
 await screen.findByText('Public detail');
 expect(transport.mock.calls[0][0]).toBe('https://social-api.test/api/v1/social/posts/'+id);
 expect(new Headers(transport.mock.calls[0][1].headers).has('Authorization')).toBe(false);
});
