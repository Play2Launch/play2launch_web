// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PostShare } from './PostShare';
const id='sp'+'a'.repeat(64);
const originalClipboard=Object.getOwnPropertyDescriptor(navigator,'clipboard');
afterEach(()=>{cleanup();vi.restoreAllMocks();if(originalClipboard)Object.defineProperty(navigator,'clipboard',originalClipboard);else Reflect.deleteProperty(navigator,'clipboard')});
it('shares only a canonical public permalink through encoded external intents',()=>{
 render(<MemoryRouter><PostShare id={id}/></MemoryRouter>);
 expect(screen.getByRole('link',{name:/View post/}).getAttribute('href')).toBe('/posts/'+id);
 fireEvent.click(screen.getByRole('button',{name:'Share'}));
 for(const name of ['Telegram ↗','X ↗']) {
  const link=screen.getByRole('link',{name});const url=new URL(link.getAttribute('href')!);
  expect(url.searchParams.get('url')).toBe(window.location.origin+'/posts/'+id);
  expect(link.getAttribute('rel')).toContain('noopener');
 }
});
it('copies the link, or offers a selectable link when clipboard access is denied',async()=>{
 const writeText=vi.fn().mockRejectedValueOnce(new Error('Denied')).mockResolvedValueOnce(undefined);
 Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText}});
 render(<MemoryRouter><PostShare id={id}/></MemoryRouter>);
 fireEvent.click(screen.getByRole('button',{name:'Share'}));
 fireEvent.click(screen.getByRole('button',{name:'Copy link'}));
 expect((await screen.findByLabelText('Post link') as HTMLInputElement).value).toBe(window.location.origin+'/posts/'+id);
 fireEvent.click(screen.getByRole('button',{name:'Copy link'}));
 await screen.findByText('Link copied.');expect(writeText).toHaveBeenCalledWith(window.location.origin+'/posts/'+id);
});
