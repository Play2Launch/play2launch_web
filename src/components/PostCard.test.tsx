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
