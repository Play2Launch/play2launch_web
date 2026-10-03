// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PostComposer } from './PostComposer';
import { api } from '../lib/api';
vi.mock('../lib/api',()=>({api:{authenticated:vi.fn()}}));
vi.mock('./CampaignPicker',()=>({CampaignPicker:({choose}:{choose:(v:unknown)=>void})=><button onClick={()=>choose({id:'cp1',name:'Moon'})}>Pick Moon</button>}));
const run={id:'score:gs1',session_id:'gs1',campaign_id:'cp1',name:'Moon',slug:'moon',score:450,game_key:'paper',rules:'v1',played_at:'2026-09-30T10:00:00Z'};
const post={id:'sp'+'a'.repeat(64)};
it('replaces a selected game result with a team attachment and sends only team identifiers',async()=>{
 vi.mocked(api.authenticated).mockResolvedValueOnce({items:[run],next_cursor:''}).mockResolvedValueOnce({items:[{campaign_id:'cp1',slug:'moon',name:'Moon',team_name:'Team One',membership:{team_id:'tm1'}}],next_cursor:''}).mockResolvedValueOnce(post);
 render(<PostComposer sessionId="gs1"/>);fireEvent.click(screen.getByRole('button',{name:'Write a post with this score'}));await screen.findByText('450 game points');
 fireEvent.click(screen.getByRole('button',{name:'Attach a team report'}));fireEvent.click(await screen.findByRole('button',{name:'Team One Moon'}));
 expect(screen.queryByText('450 game points')).toBeNull();fireEvent.change(screen.getByLabelText('Your post'),{target:{value:'Join us!'}});fireEvent.click(screen.getByRole('button',{name:'Publish publicly'}));await screen.findByText(/Your post is public/);
 expect(vi.mocked(api.authenticated).mock.calls[2][1]).toEqual({text:'Join us!',session_id:'',team_id:'tm1',team_campaign:'moon',request_id:expect.any(String)});
});
afterEach(()=>{cleanup();vi.mocked(api.authenticated).mockReset()});
it('previews future attachment types without enabling actions or making requests',()=>{
 render(<PostComposer/>);fireEvent.click(screen.getByRole('button',{name:'Write a post'}));
 expect((screen.getByRole('button',{name:'Attach a game result'}) as HTMLButtonElement).disabled).toBe(false);
 for(const label of ['Trade','Campaign']){
  const button=screen.getByRole('button',{name:`${label} — Coming soon`}) as HTMLButtonElement;
  expect(button.disabled).toBe(true);fireEvent.click(button);
 }
 expect(api.authenticated).not.toHaveBeenCalled();
 expect(screen.queryByText('Your server-accepted rounds, newest first. Trial rounds are not included.')).toBeNull();
});
it('selects a verified round and sends text plus ID, never a client score',async()=>{
 vi.mocked(api.authenticated).mockResolvedValueOnce({items:[run],next_cursor:''}).mockResolvedValueOnce(post);
 const done=vi.fn();render(<PostComposer onPosted={done}/>);
 fireEvent.click(screen.getByRole('button',{name:'Write a post'}));
 fireEvent.change(screen.getByLabelText('Your post'),{target:{value:'That was close!'}});
 fireEvent.click(screen.getByRole('button',{name:'Attach a game result'}));
 fireEvent.click(await screen.findByRole('button',{name:/450 game points/}));
 fireEvent.click(screen.getByRole('button',{name:'Publish publicly'}));
 await screen.findByText(/Your post is public/);
 const body=vi.mocked(api.authenticated).mock.calls[1][1];expect(body).toEqual({text:'That was close!',session_id:'gs1',request_id:expect.any(String)});expect(done).toHaveBeenCalledOnce();
});
it('preselects the current result and reuses the request ID after a failed publication',async()=>{
 vi.mocked(api.authenticated).mockResolvedValueOnce({items:[run],next_cursor:''}).mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce(post);
 render(<PostComposer sessionId="gs1"/>);fireEvent.click(screen.getByRole('button',{name:'Write a post with this score'}));await screen.findByText('450 game points');
 expect(vi.mocked(api.authenticated).mock.calls[0][0]).toBe('/social/results?session=gs1');
 fireEvent.change(screen.getByLabelText('Your post'),{target:{value:'Nice!'}});fireEvent.click(screen.getByRole('button',{name:'Publish publicly'}));await screen.findByRole('alert');
 expect((screen.getByLabelText('Your post') as HTMLTextAreaElement).value).toBe('Nice!');fireEvent.click(screen.getByRole('button',{name:'Publish publicly'}));await screen.findByText(/Your post is public/);
 expect(vi.mocked(api.authenticated).mock.calls[1][1]).toEqual(vi.mocked(api.authenticated).mock.calls[2][1]);
});
it('allows plain text and blocks empty or overlong posts',async()=>{
 vi.mocked(api.authenticated).mockResolvedValue(post);render(<PostComposer/>);fireEvent.click(screen.getByRole('button',{name:'Write a post'}));
 const publish=screen.getByRole('button',{name:'Publish publicly'}) as HTMLButtonElement;expect(publish.disabled).toBe(true);
 fireEvent.change(screen.getByLabelText('Your post'),{target:{value:'好'.repeat(501)}});expect(publish.disabled).toBe(true);
 fireEvent.change(screen.getByLabelText('Your post'),{target:{value:'Hello'}});fireEvent.click(publish);await screen.findByText(/Your post is public/);expect(vi.mocked(api.authenticated).mock.calls[0][1]).toMatchObject({text:'Hello',session_id:''});
});
it('loads the selected campaign from the server',async()=>{
 vi.mocked(api.authenticated).mockResolvedValue({items:[],next_cursor:''});render(<PostComposer/>);fireEvent.click(screen.getByRole('button',{name:'Write a post'}));fireEvent.click(screen.getByRole('button',{name:'Attach a game result'}));await screen.findByText('No accepted rounds in this selection.');
 fireEvent.click(screen.getByRole('button',{name:'Filter by campaign'}));fireEvent.click(screen.getByRole('button',{name:'Pick Moon'}));
 await waitFor(()=>expect(api.authenticated).toHaveBeenCalledWith('/social/results?campaign=cp1',undefined,expect.anything()));
});
