// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {CampaignPicker} from './CampaignPicker';
import {api} from '../lib/api';
afterEach(()=>{cleanup();vi.restoreAllMocks();});
it('lets guests search and select closed campaigns for rankings',async()=>{
 HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
 const campaign={id:'cp1',slug:'test',name:'Closed campaign',ticker:'TEST',stage:'live',color:'#d2fa69',symbol:'T',category:'Game',description:'',target:100};
 const request=vi.spyOn(api,'request').mockResolvedValue({items:[campaign],next_cursor:''});
 const auth=vi.spyOn(api,'authenticated');
 const choose=vi.fn();render(<CampaignPicker purpose="leaderboard" choose={choose} close={()=>{}}/>);
 await screen.findByText('Closed campaign');
 expect(screen.queryByRole('button',{name:'Open to team creation'})).toBeNull();
 fireEvent.change(screen.getByRole('searchbox'),{target:{value:'test.*'}});
 await waitFor(()=>expect(request.mock.calls.some(([url])=>url.includes('q=test.*'))).toBe(true));
 await screen.findByText('Closed campaign');
 fireEvent.click(screen.getByRole('button',{name:'View leaderboard'}));
 expect(choose).toHaveBeenCalledWith(campaign);expect(auth).not.toHaveBeenCalled();
});
it('searches on the server, resets pagination on filters and selects a result',async()=>{
 HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
 const campaign={id:'cp1',slug:'test',name:'Search result',ticker:'TEST',stage:'prelaunch',color:'#d2fa69',symbol:'T',availability:{join_open:true}};
 const request=vi.spyOn(api,'authenticated').mockResolvedValue({items:[campaign],next_cursor:''});
 const choose=vi.fn();render(<CampaignPicker choose={choose} close={()=>{}}/>);
 await screen.findByText('Search result');
 fireEvent.click(screen.getByRole('button',{name:'Open to team creation'}));
 expect(screen.queryByText('Loading campaigns…')).toBeNull();
 fireEvent.change(screen.getByRole('searchbox'),{target:{value:'beyond page 1'}});
 await waitFor(()=>expect(request.mock.calls.some(([url])=>url.includes('q=beyond+page+1'))).toBe(true));
 await screen.findByText('Search result');
 fireEvent.click(screen.getByRole('button',{name:'Select'}));expect(choose).toHaveBeenCalledWith(campaign);
 fireEvent.click(screen.getByRole('button',{name:'All campaigns'}));
 await waitFor(()=>expect(request.mock.calls.some(([url])=>url.includes('mode=all'))).toBe(true));
});
