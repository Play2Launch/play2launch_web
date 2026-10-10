// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PostCard } from './PostCard';
import type { Activity } from './ActivityFeed';
import { api } from '../lib/api';
const state=vi.hoisted(()=>({user:{id:'ur1',mode:'live'}}));
vi.mock('../state',()=>({useApp:()=>state}));
vi.mock('../lib/api',()=>({api:{authenticated:vi.fn()}}));
const item={id:'sp'+'a'.repeat(64),type:'post',user_id:'ur1',author:'Player',text:'<img src=x onerror=alert(1)>',at:'2026-09-30T10:00:00Z'} as Activity;
afterEach(()=>{cleanup();vi.mocked(api.authenticated).mockReset();state.user.id='ur1'});
it('uses campaign artwork as a decorative watermark and removes broken images',()=>{
 const result={...item,session_id:'gs1',name:'PAPERHOOD',slug:'phood',score:18418,played_at:item.at,cover_image:'/images/paperhood.png'};
 const {container,rerender}=render(<MemoryRouter><PostCard item={result} removed={vi.fn()}/></MemoryRouter>);
 const image=container.querySelector<HTMLImageElement>('.result-watermark')!;
 expect(image.getAttribute('src')).toBe('/images/paperhood.png');
 expect(image.alt).toBe('');
 expect(image.getAttribute('aria-hidden')).toBe('true');
 fireEvent.error(image);
 expect(container.querySelector('.result-watermark')).toBeNull();
 expect(screen.getByText('18,418 game points')).toBeTruthy();
 rerender(<MemoryRouter><PostCard item={{...result,cover_image:'javascript:alert(1)'}} removed={vi.fn()}/></MemoryRouter>);
 expect(container.querySelector('.result-watermark')).toBeNull();
 rerender(<MemoryRouter><PostCard item={{...result,cover_image:undefined}} removed={vi.fn()}/></MemoryRouter>);
 expect(container.querySelector('.result-watermark')).toBeNull();
});
it('shows a compact game icon and name without technical identifiers',()=>{
 const {container}=render(<MemoryRouter><PostCard item={{...item,session_id:'gs1',name:'PAPERHOOD',slug:'phood',score:18418,game_key:'gx123',rules:'paper-run-practice-v5',played_at:item.at}} removed={vi.fn()}/></MemoryRouter>);
 expect(screen.getByText('PAPERHOOD')).toBeTruthy();
 expect(container.querySelector('.result-game-icon svg')).toBeTruthy();
 expect(screen.queryByText(/gx123|paper-run-practice-v5/)).toBeNull();
});
it('shows KOL certification only when confirmed by the server',()=>{
 const {rerender}=render(<MemoryRouter><PostCard item={{...item,author_kol_verified:true}} removed={vi.fn()}/></MemoryRouter>);
 expect(screen.getByRole('img',{name:'Verified KOL'})).toBeTruthy();
 rerender(<MemoryRouter><PostCard item={{...item,author_kol_verified:false}} removed={vi.fn()}/></MemoryRouter>);
 expect(screen.queryByRole('img',{name:'Verified KOL'})).toBeNull();
});
it('shows the public avatar beside the author and falls back when it fails',()=>{
 const {container}=render(<MemoryRouter><PostCard item={{...item,author_avatar_url:'https://example.com/avatar.png'}} removed={vi.fn()}/></MemoryRouter>);
 const author=screen.getByRole('link',{name:'Player'});
 expect(author.getAttribute('href')).toBe('/players/ur1');
 const img=author.querySelector('img')!;
 expect(img.getAttribute('src')).toBe('https://example.com/avatar.png');
 fireEvent.error(img);
 expect(container.querySelector('img')).toBeNull();
 expect(author.querySelector('.player-avatar')?.textContent).toBe('P');
 fireEvent.click(screen.getByLabelText('Post options'));
 expect(screen.getByRole('button',{name:'Delete post'}).className).toContain('post-action-delete');
});
it('renders text literally and confirms deletion',async()=>{
 vi.mocked(api.authenticated).mockResolvedValue('ok');const removed=vi.fn();const {container}=render(<MemoryRouter><PostCard item={item} removed={removed}/></MemoryRouter>);
 expect(screen.getByText(item.text!)).toBeTruthy();expect(container.querySelector('img')).toBeNull();
 fireEvent.click(screen.getByLabelText('Post options'));
 fireEvent.click(screen.getByRole('button',{name:'Delete post'}));expect(api.authenticated).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Confirm delete'}));
 await vi.waitFor(()=>expect(removed).toHaveBeenCalledOnce());expect(api.authenticated).toHaveBeenCalledWith(`/social/posts/${item.id}/delete`,{});
});
it('offers report instead of delete on another player’s post',async()=>{
 state.user.id='ur2';vi.mocked(api.authenticated).mockResolvedValue('ok');render(<MemoryRouter><PostCard item={item} removed={vi.fn()}/></MemoryRouter>);
 fireEvent.click(screen.getByLabelText('Post options'));
 expect(screen.queryByRole('button',{name:'Delete post'})).toBeNull();fireEvent.click(screen.getByRole('button',{name:'Report post'}));fireEvent.click(screen.getByRole('button',{name:'Submit report'}));await screen.findByText('Report submitted for review.');expect(api.authenticated).toHaveBeenCalledWith(`/social/posts/${item.id}/report`,{reason:'spam'});
});
it('likes and unlikes a post without counting duplicate clicks',async()=>{
 vi.mocked(api.authenticated).mockResolvedValueOnce({liked:true,count:3}).mockResolvedValueOnce({liked:false,count:2});
 render(<MemoryRouter><PostCard item={{...item,like_count:2}} removed={vi.fn()}/></MemoryRouter>);
 const like=screen.getByRole('button',{name:'Like post'});
 expect(like.textContent).toContain('2');fireEvent.click(like);fireEvent.click(like);
 await screen.findByRole('button',{name:'Unlike post'});
 expect(api.authenticated).toHaveBeenCalledTimes(1);
 expect(screen.getByRole('button',{name:'Unlike post'}).textContent).toContain('3');
 fireEvent.click(screen.getByRole('button',{name:'Unlike post'}));
 await screen.findByRole('button',{name:'Like post'});
 expect(screen.getByRole('button',{name:'Like post'}).textContent).toContain('2');
 expect(api.authenticated).toHaveBeenNthCalledWith(1,`/social/posts/${item.id}/like`,{liked:true});
 expect(api.authenticated).toHaveBeenNthCalledWith(2,`/social/posts/${item.id}/like`,{liked:false});
});
