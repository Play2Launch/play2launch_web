// @vitest-environment jsdom
import {afterEach,expect,it,vi} from "vitest";
import {cleanup,render,screen,fireEvent,waitFor,act} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {campaigns} from "../data";
const request=vi.hoisted(()=>vi.fn(()=>new Promise(()=>{})));
vi.mock("../lib/api",()=>({api:{request},liveAuth:true}));
vi.mock("../state",()=>({useApp:()=>({user:{id:"ur1"},entry:{},campaign:()=>undefined})}));
vi.mock("../components/CampaignArtwork",()=>({CampaignArtwork:()=>null}));
vi.mock("../components/TeamInvite",()=>({TeamInvite:()=>null}));
import {TeamPage} from "./Campaign";
afterEach(()=>{cleanup();request.mockReset();request.mockImplementation(()=>new Promise(()=>{}));});
const campaign={...campaigns[0],id:"brand-new",name:"New campaign"};
const team={id:"tm1",owner_id:"ur1",name:"One",handle:"one",initial:"O",color:"#aabbcc",description:"Team one",players:1,score:0,referrals:0};
function view(teams:typeof team[],member?:string){return render(<MemoryRouter><TeamPage live={{campaign,teams,member,closed:false,busy:false,join:vi.fn()}}/></MemoryRouter>)}
it("binds the header to the member total and clears it while switching teams",async()=>{
 let resolveFirst!:(v:unknown)=>void;
 let resolveSecond!:(v:unknown)=>void;
 request.mockImplementationOnce(()=>new Promise(resolve=>{resolveFirst=resolve;}));
 request.mockImplementationOnce(()=>new Promise(resolve=>{resolveSecond=resolve;}));
 view([team,{...team,id:'tm2',name:'Two'}]);
 const total=()=>screen.getByText('Campaign team score').previousElementSibling?.textContent;
 expect(total()).toBe('—');
 await act(async()=>resolveFirst({items:[],total:0,team_score:18418,next_cursor:''}));
 await waitFor(()=>expect(total()).toBe('18,418'));
 expect(request).toHaveBeenCalledTimes(1);
 fireEvent.click(screen.getByRole('button',{name:/Two/}));
 expect(total()).toBe('—');
 await act(async()=>resolveSecond({items:[],total:0,team_score:0,next_cursor:''}));
 await waitFor(()=>expect(total()).toBe('0'));
 expect(request).toHaveBeenCalledTimes(2);
});
it("keeps a campaign-specific creation entry when there are no teams",()=>{
 view([]);
 expect(screen.getByRole("link",{name:"Create my team in New campaign"}).getAttribute("href")).toBe("/captain?campaign=brand-new");
 expect(screen.getByText("No teams available yet")).toBeTruthy();
});
it("labels the captain entry as management for the actual owner",()=>{
 view([{...team,handle:"@tm1"}],"tm1");
 expect(screen.queryByText(/@tm1/)).toBeNull();
 expect(screen.getByRole("link",{name:"Manage my team in New campaign"}).getAttribute("href")).toBe("/captain?campaign=brand-new");
 expect(screen.queryByRole("link",{name:/Create my team/})).toBeNull();
});
it("does not mistake ordinary membership for captain ownership",()=>{
 view([{...team,owner_id:"ur2"}],"tm1");
 expect(screen.getByRole("link",{name:"Create my team in New campaign"})).toBeTruthy();
});
it("allows Community members to join a regular team and shows activity separately",()=>{
 const community={...team,id:"tmcommunity",name:"P2L Community",owner_id:"",team_type:"system_community"};
 render(<MemoryRouter><TeamPage live={{campaign,teams:[community,{...team,owner_id:"ur2"}],member:community.id,closed:false,busy:false,join:vi.fn()}}/></MemoryRouter>);
 expect(screen.getByRole("region",{name:"P2L Community activity"})).toBeTruthy();
 expect((screen.getByRole("button",{name:/Join One/}) as HTMLButtonElement).disabled).toBe(false);
 expect(screen.queryByText(/Team locked/)).toBeNull();
});
