// @vitest-environment jsdom
import {afterEach,expect,it} from 'vitest';
import {cleanup,render,screen} from '@testing-library/react';
import {TeamInvite} from './TeamInvite';
afterEach(cleanup);
it('records the sharing user, keeps the target team and removes attribution for guests',()=>{
 const view=render(<TeamInvite slug="phood" team="tm1" name="A team" referrer="urmemberb"/>);
 const url=()=>new URL((screen.getByRole('textbox',{name:'Web team invitation'}) as HTMLInputElement).value);
 expect(url().searchParams.get('ref')).toBe('urmemberb');expect(url().searchParams.get('team')).toBe('tm1');
 view.rerender(<TeamInvite slug="phood" team="tm1" name="A team"/>);
 expect(url().searchParams.has('ref')).toBe(false);expect(url().searchParams.get('team')).toBe('tm1');
});
