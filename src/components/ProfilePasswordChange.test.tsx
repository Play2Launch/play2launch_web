// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {ProfilePasswordChange} from './ProfilePasswordChange';
import {api} from '../lib/api';

vi.mock('../lib/api',()=>({api:{requestReset:vi.fn(),resetPassword:vi.fn()}}));
afterEach(()=>{cleanup();vi.mocked(api.requestReset).mockReset();vi.mocked(api.resetPassword).mockReset();});

it('starts closed, sends a code to the signed-in email, and updates the password',async()=>{
  vi.mocked(api.requestReset).mockResolvedValue('');
  vi.mocked(api.resetPassword).mockResolvedValue('');
  const changed=vi.fn(async()=>{});
  render(<ProfilePasswordChange email="player@example.test" onChanged={changed}/>);
  expect(screen.queryByText('player@example.test')).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:/Change password/}));
  expect(screen.getByText('player@example.test')).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Send code'}));
  await waitFor(()=>expect(api.requestReset).toHaveBeenCalledWith('player@example.test',expect.any(AbortSignal)));
  fireEvent.change(await screen.findByLabelText('Verification code'),{target:{value:'abc123'}});
  fireEvent.change(screen.getByLabelText('New password'),{target:{value:'new-password123'}});
  fireEvent.change(screen.getByLabelText('Confirm new password'),{target:{value:'new-password123'}});
  fireEvent.click(screen.getByRole('button',{name:'Update password'}));
  await waitFor(()=>expect(api.resetPassword).toHaveBeenCalledWith('player@example.test','ABC123','new-password123',expect.any(AbortSignal)));
  await waitFor(()=>expect(changed).toHaveBeenCalledOnce());
});

it('does not submit mismatched passwords',async()=>{
  vi.mocked(api.requestReset).mockResolvedValue('');
  render(<ProfilePasswordChange email="player@example.test" onChanged={vi.fn(async()=>{})}/>);
  fireEvent.click(screen.getByRole('button',{name:/Change password/}));
  fireEvent.click(screen.getByRole('button',{name:'Send code'}));
  fireEvent.change(await screen.findByLabelText('Verification code'),{target:{value:'ABC123'}});
  fireEvent.change(screen.getByLabelText('New password'),{target:{value:'new-password123'}});
  fireEvent.change(screen.getByLabelText('Confirm new password'),{target:{value:'different123'}});
  fireEvent.click(screen.getByRole('button',{name:'Update password'}));
  expect((await screen.findByRole('alert')).textContent).toContain('The passwords do not match.');
  expect(api.resetPassword).not.toHaveBeenCalled();
});
