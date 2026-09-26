// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
vi.mock('./PointsProvider',()=>({pointLabels:{daily_game:'Daily play'},usePoints:()=>({page:{balance:1250,items:[{id:'one',kind:'daily_game',amount:10}]},gain:0,error:'',busy:false,refresh:vi.fn()})}));
import { HeaderPoints } from './HeaderPoints';
afterEach(cleanup);
it('shows a balance, task/history links and closes on Escape or outside click',()=>{
 render(<MemoryRouter><HeaderPoints/></MemoryRouter>);
 const summary=screen.getByLabelText('P2L Points: 1,250');
 fireEvent.click(summary);
 const details=summary.closest('details')!;
 expect(details.open).toBe(true);
 expect(screen.getByRole('link',{name:'Earn points →'}).getAttribute('href')).toBe('/tasks');
 expect(screen.getByRole('link',{name:'View history →'}).getAttribute('href')).toBe('/profile#p2l-points');
 fireEvent.keyDown(document,{key:'Escape'});expect(details.open).toBe(false);
 fireEvent.click(summary);fireEvent.pointerDown(document.body);expect(details.open).toBe(false);
});
