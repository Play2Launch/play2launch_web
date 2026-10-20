// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { PublicCampaign } from "../lib/catalog";
const mock=vi.hoisted(()=>({request:vi.fn()}));
vi.mock('../lib/api',()=>({api:{request:mock.request}}));
vi.mock('../state',()=>({useApp:()=>({user:{id:'me'}})}));
vi.mock('../components/CampaignHeader',()=>({CampaignNav:()=>null,CampaignIdentityCard:()=>null}));
vi.mock('../components/LeaderboardScope',()=>({LeaderboardScope:()=>null}));
import IDORankings from './IDORankings';
afterEach(()=>{cleanup();vi.clearAllMocks();});
it('switches all three independent metrics without team rankings',async()=>{
 mock.request.mockImplementation(async(url:string)=>({metric:{key:url.split('/').at(-1)},players:[{id:'me',display_name:'Tester',score:url.endsWith('total_score')?4250:2}],as_of:new Date().toISOString()}));
 render(<MemoryRouter><IDORankings campaign={{slug:'combo',name:'Combo'} as PublicCampaign}/></MemoryRouter>);
 await screen.findByText('#1 · 4,250 pts');
 fireEvent.click(screen.getByRole('button',{name:'Winning combo'}));
 await screen.findByText('#1 · ×2');
 expect(mock.request.mock.lastCall?.[0]).toContain('/winning_combo');
 fireEvent.click(screen.getByRole('button',{name:'Losing combo'}));
 await screen.findByRole('heading',{name:'Longest losing combo'});
 expect(mock.request.mock.lastCall?.[0]).toContain('/losing_combo');
 expect(screen.queryByRole('button',{name:'Teams'})).toBeNull();
});
