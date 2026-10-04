// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {api} from '../lib/api';
import {ReferralRecords} from './ReferralRecords';
vi.mock('../lib/api',()=>({api:{authenticated:vi.fn()}}));
afterEach(()=>{cleanup();vi.resetAllMocks()});
it('loads private invitation records on demand, showing pending and credited rewards',async()=>{
 vi.mocked(api.authenticated).mockResolvedValue({reward:50,next_cursor:'',items:[{id:'ur1',name:'Alice',joined_at:1700000000000,status:'pending',amount:0},{id:'ur2',name:'Bob',joined_at:1700000000000,status:'credited',amount:50}]});
 render(<MemoryRouter><ReferralRecords/></MemoryRouter>);
 expect(api.authenticated).not.toHaveBeenCalled();fireEvent.click(screen.getByText('My invitations'));
 await screen.findByText('Alice');expect(screen.getByText('Waiting for first qualifying game')).toBeTruthy();expect(screen.getByText('+50 P2L Points credited')).toBeTruthy();
 expect(api.authenticated).toHaveBeenCalledWith('/points/referrals');
});
it('shows an error and permits retry',async()=>{
 vi.mocked(api.authenticated).mockRejectedValue(new Error('Network error'));
 render(<ReferralRecords/>);fireEvent.click(screen.getByText('My invitations'));
 expect((await screen.findByRole('alert')).textContent).toBe('Network error');
});
