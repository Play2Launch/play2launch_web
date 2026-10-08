// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const request = vi.hoisted(() => vi.fn());
vi.mock('../lib/api', () => ({ liveAuth: true, api: { authenticated: request } }));
vi.mock('../state', () => ({ useApp: () => ({ user: { id: 'ur1', mode: 'live' } }) }));
import InboxPage from './Inbox';

afterEach(() => { cleanup(); request.mockReset(); });

it('shows a verified system sender and marks a message read', async () => {
  request.mockImplementation((path: string) => path === '/messages'
    ? Promise.resolve({ items: [{ id: 'ke1', sender_type: 'system', title: 'KOL 认证已通过', body: '恭喜你成为 P2L 认证 KOL！', created_at: '2026-10-07T00:00:00Z' }], unread_count: 1 })
    : Promise.resolve('read'));
  render(<InboxPage />);
  expect(await screen.findByText('P2L System')).toBeTruthy();
  expect(screen.getByText('KOL 认证已通过')).toBeTruthy();
  expect(screen.getByText('1 unread')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Mark as read' }));
  await waitFor(() => expect(request).toHaveBeenCalledWith('/messages/ke1/read', {}));
  await screen.findByText('0 unread');
});
