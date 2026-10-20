// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, it, expect, vi } from 'vitest';
const mock = vi.hoisted(() => ({ user: { id: 'ur1', mode: 'live', nicknameSet: false } as { id: string; mode: string; nicknameSet: boolean } | null, update: vi.fn(), request: vi.fn() }));
vi.mock('../state', () => ({ useApp: () => ({ user: mock.user, updatePublicName: mock.update }) }));
vi.mock('../lib/api', () => ({ api: { authenticated: mock.request }, ApiError: class extends Error {} }));
import { NicknameGate } from './NicknameGate';
const profile = { id: 'ur1', nickname: 'Player #ur1', avatar_url: 'https://example.com/avatar.png', handle: 'bee', has_nickname: false };
beforeEach(() => {
  mock.user = { id: 'ur1', mode: 'live', nicknameSet: false };
  mock.request.mockReset(); mock.update.mockReset();
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
afterEach(cleanup);
function Page() { const location = useLocation(); return <p>Current page: {location.pathname}{location.search}</p>; }
function mount() { return render(<MemoryRouter initialEntries={['/campaign/phood?invite=abc']}><NicknameGate><Page /></NicknameGate></MemoryRouter>); }
it('keeps the current page and opens a non-dismissible modal', () => {
  mount();
  expect(screen.getByText('Current page: /campaign/phood?invite=abc')).toBeTruthy();
  const dialog = screen.getByRole('dialog');
  expect(dialog.hasAttribute('open')).toBe(true);
  expect(screen.queryByRole('button', { name: /close|cancel/i })).toBeNull();
  const cancel = new Event('cancel', { cancelable: true });
  fireEvent(dialog, cancel); expect(cancel.defaultPrevented).toBe(true);
  fireEvent.click(dialog); expect(dialog.hasAttribute('open')).toBe(true);
  expect(document.body.style.overflow).toBe('hidden');
});
it('validates before saving and preserves the existing avatar and handle', async () => {
  mock.request.mockResolvedValueOnce(profile).mockResolvedValueOnce({ ...profile, nickname: 'Captain Bee', has_nickname: true });
  mount();
  const input = screen.getByLabelText('Your nickname');
  fireEvent.change(input, { target: { value: 'a@b.com' } });
  fireEvent.submit(input.closest('form')!);
  expect(mock.request).not.toHaveBeenCalled();
  expect(screen.getByRole('alert').textContent).toContain('2–60');
  fireEvent.change(input, { target: { value: ' Captain Bee ' } });
  fireEvent.submit(input.closest('form')!);
  await waitFor(() => expect(mock.update).toHaveBeenCalledWith('ur1', 'Captain Bee', 'bee', profile.avatar_url, true));
  expect(mock.request.mock.calls[1][1]).toEqual({ nickname: 'Captain Bee', avatar_url: profile.avatar_url });
});
it('keeps the modal on failure and allows retry without double submission', async () => {
  let reject!: (reason: unknown) => void;
  mock.request.mockReturnValueOnce(new Promise((_, fail) => { reject = fail; }));
  mount(); const input = screen.getByLabelText('Your nickname');
  fireEvent.change(input, { target: { value: 'Bee' } });
  fireEvent.submit(input.closest('form')!); fireEvent.submit(input.closest('form')!);
  expect(mock.request).toHaveBeenCalledTimes(1);
  reject(new Error('offline'));
  await screen.findByRole('alert');
  expect(screen.getByRole('dialog').hasAttribute('open')).toBe(true);
  expect((screen.getByRole('button', { name: 'Save and continue' }) as HTMLButtonElement).disabled).toBe(false);
  expect(mock.update).not.toHaveBeenCalled();
});
it('ignores a response after account change and removes the modal after completion', async () => {
  let resolve!: (value: unknown) => void;
  mock.request.mockReturnValueOnce(new Promise(done => { resolve = done; }));
  const view = mount();
  fireEvent.change(screen.getByLabelText('Your nickname'), { target: { value: 'Bee' } });
  fireEvent.submit(screen.getByLabelText('Your nickname').closest('form')!);
  mock.user = { id: 'ur2', mode: 'live', nicknameSet: true };
  view.rerender(<MemoryRouter><NicknameGate><Page /></NicknameGate></MemoryRouter>);
  resolve(profile);
  await waitFor(() => expect(mock.request.mock.calls[0][2].aborted).toBe(true));
  expect(mock.update).not.toHaveBeenCalled(); expect(screen.queryByRole('dialog')).toBeNull();
  expect(document.body.style.overflow).not.toBe('hidden');
});
it('allows saved nicknames and guests through', () => {
  for (const user of [{ id: 'ur1', mode: 'live', nicknameSet: true }, null]) {
    mock.user = user; mount(); expect(screen.queryByRole('dialog')).toBeNull(); cleanup();
  }
});
