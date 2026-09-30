// @vitest-environment jsdom
import {afterEach,expect,it} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {UserAvatar} from './UserAvatar';
afterEach(cleanup);
it('renders the saved avatar, falls back on error and accepts a replacement',()=>{
 const view=render(<UserAvatar name="Bee" src="https://example.com/one.png"/>);
 const img=view.container.querySelector('img')!;
 expect(img.src).toBe('https://example.com/one.png');
 fireEvent.error(img);expect(screen.getByText('B')).toBeTruthy();
 view.rerender(<UserAvatar name="Bee" src="https://example.com/two.png"/>);
 expect(view.container.querySelector('img')?.src).toBe('https://example.com/two.png');
 view.rerender(<UserAvatar name="Bee" src=""/>);
 expect(view.container.querySelector('img')).toBeNull();expect(screen.getByText('B')).toBeTruthy();
});
it('does not render unsafe or credential-bearing URLs',()=>{
 for(const src of ['javascript:alert(1)','http://example.com/a','https://user:pass@example.com/a']){
  const view=render(<UserAvatar name="Bee" src={src}/>);expect(view.container.querySelector('img')).toBeNull();view.unmount();
 }
});
