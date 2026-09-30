// @vitest-environment jsdom
import {afterEach,it,expect,vi} from 'vitest';
import {cleanup,render,screen,fireEvent} from '@testing-library/react';
const mock=vi.hoisted(()=>({request:vi.fn(),update:vi.fn()}));
vi.mock('../lib/api',async(importOriginal)=>({...await importOriginal<typeof import('../lib/api')>(),api:{authenticated:mock.request}}));
vi.mock('../state',()=>({useApp:()=>({updatePublicName:mock.update})}));
import {PublicProfileEditor} from './PublicProfileEditor';
afterEach(()=>{cleanup();vi.clearAllMocks();});
it('synchronizes the server avatar on load, save and removal',async()=>{
 mock.request.mockResolvedValueOnce({id:'ur1',nickname:'Bee',avatar_url:'https://example.com/old.png'})
 .mockResolvedValueOnce({id:'ur1',nickname:'Bee',avatar_url:'https://example.com/new.png'})
 .mockResolvedValueOnce({id:'ur1',nickname:'Bee',avatar_url:''});
 render(<PublicProfileEditor userId="ur1"/>);
 const avatar=await screen.findByPlaceholderText('https://… (optional)');
 expect(mock.update).toHaveBeenLastCalledWith('ur1','Bee','','https://example.com/old.png');
 fireEvent.change(avatar,{target:{value:'https://example.com/new.png'}});
 fireEvent.click(screen.getByRole('button',{name:'Save public profile'}));
 await screen.findByText(/Public profile saved/);
 expect(mock.update).toHaveBeenLastCalledWith('ur1','Bee','','https://example.com/new.png');
 fireEvent.change(avatar,{target:{value:''}});
 fireEvent.click(screen.getByRole('button',{name:'Save public profile'}));
 await screen.findByText(/Public profile saved/);
 expect(mock.update).toHaveBeenLastCalledWith('ur1','Bee','','');
});
it('loads and saves only public fields',async()=>{
 mock.request.mockResolvedValueOnce({id:'ur1',nickname:'Player #ur1',avatar_url:''}).mockResolvedValueOnce({id:'ur1',nickname:'Captain Bee',avatar_url:''});
 render(<PublicProfileEditor userId="ur1"/>);
 const name=await screen.findByLabelText('Display name');
 fireEvent.change(name,{target:{value:'Captain Bee'}});
 fireEvent.click(screen.getByRole('button',{name:'Save public profile'}));
 await screen.findByText(/Public profile saved/);
 expect(mock.request).toHaveBeenLastCalledWith('/user/profile',{nickname:'Captain Bee',avatar_url:''});
 expect(mock.update).toHaveBeenLastCalledWith('ur1','Captain Bee','','');
});
it('saves a lowercase username separately from the display name',async()=>{
 mock.request.mockResolvedValueOnce({id:'ur1',nickname:'Bee',avatar_url:'',handle:'',handle_changes_remaining:1}).mockResolvedValueOnce({id:'ur1',nickname:'Bee',avatar_url:'',handle:'captain_bee',handle_changes_remaining:1});
 render(<PublicProfileEditor userId="ur1"/>);
 fireEvent.change(await screen.findByLabelText('Unique username'),{target:{value:'Captain_Bee'}});
 fireEvent.click(screen.getByRole('button',{name:'Save public profile'}));
 await screen.findByText(/Public profile saved/);
 expect(mock.request).toHaveBeenLastCalledWith('/user/profile',{nickname:'Bee',avatar_url:'',handle:'captain_bee'});
 expect(mock.update).toHaveBeenLastCalledWith('ur1','Bee','captain_bee','');
});
it('locks username after one rename but keeps display name editable',async()=>{
 mock.request.mockResolvedValueOnce({id:'ur1',nickname:'Bee',avatar_url:'',handle:'captain_bee',handle_changes_remaining:0});
 render(<PublicProfileEditor userId="ur1"/>);
 expect((await screen.findByLabelText('Unique username') as HTMLInputElement).disabled).toBe(true);
 expect((screen.getByLabelText('Display name') as HTMLInputElement).disabled).toBe(false);
});
it('requires the styled confirmation before renaming and supports cancellation',async()=>{
 mock.request.mockResolvedValueOnce({id:'ur1',nickname:'Bee',avatar_url:'',handle:'old_bee',handle_changes_remaining:1}).mockResolvedValueOnce({id:'ur1',nickname:'Bee',avatar_url:'',handle:'new_bee',handle_changes_remaining:0});
 render(<PublicProfileEditor userId="ur1"/>);
 fireEvent.change(await screen.findByLabelText('Unique username'),{target:{value:'new_bee'}});
 fireEvent.click(screen.getByRole('button',{name:'Save public profile'}));
 expect(screen.getByRole('dialog',{name:'Change your username?'})).toBeTruthy();
 expect(screen.getByText('@old_bee')).toBeTruthy();
 expect(screen.getByText('@new_bee')).toBeTruthy();
 expect(mock.request).toHaveBeenCalledTimes(1);
 fireEvent.click(screen.getByRole('button',{name:'Keep editing'}));
 expect(screen.queryByRole('dialog')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Save public profile'}));
 fireEvent.keyDown(document,{key:'Escape'});
 expect(screen.queryByRole('dialog')).toBeNull();
 expect(mock.request).toHaveBeenCalledTimes(1);
 fireEvent.click(screen.getByRole('button',{name:'Save public profile'}));
 fireEvent.click(screen.getByRole('button',{name:'Confirm username change'}));
 await screen.findByText(/Public profile saved/);
 expect(mock.request).toHaveBeenLastCalledWith('/user/profile',{nickname:'Bee',avatar_url:'',handle:'new_bee'});
 expect(screen.queryByRole('dialog')).toBeNull();
});
