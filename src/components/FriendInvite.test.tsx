// @vitest-environment jsdom
import {afterEach,expect,it} from 'vitest';
import {cleanup,render,screen} from '@testing-library/react';
import {FriendInvite} from './FriendInvite';
afterEach(cleanup);
it('offers a personal link without requiring or encoding a team',()=>{
 render(<FriendInvite userId="ur123"/>);
 const url=new URL((screen.getByLabelText('Friend invitation') as HTMLInputElement).value);
 expect(url.searchParams.get('ref')).toBe('ur123');
 expect(url.searchParams.has('team')).toBe(false);
 expect(url.searchParams.has('invite')).toBe(false);
 expect(url.pathname).toBe('/');
 expect(screen.getByText(/does not join or change/)).toBeTruthy();
});
