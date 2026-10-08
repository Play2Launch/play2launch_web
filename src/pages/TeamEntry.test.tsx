// @vitest-environment jsdom
import {afterEach,expect,it,vi} from "vitest";
import {cleanup,render,screen,fireEvent,waitFor,act,within} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {campaigns} from "../data";
const request=vi.hoisted(()=>vi.fn((_path?:string)=>new Promise(()=>{})));
vi.mock("../lib/api",()=>({api:{request},liveAuth:true}));
vi.mock("../state",()=>({useApp:()=>({user:{id:"ur1"},entry:{},campaign:()=>undefined})}));
vi.mock("../components/CampaignArtwork",()=>({CampaignArtwork:()=>null}));
vi.mock("../components/TeamInvite",()=>({TeamInvite:()=>null}));
import {TeamPage} from "./Campaign";
Object.defineProperty(window,"scrollTo",{value:vi.fn(),configurable:true});
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
it("keeps invitation details below the shared campaign header",()=>{
 render(<MemoryRouter><TeamPage live={{campaign,teams:[team],closed:false,busy:false,join:vi.fn()}} invitationNotice={<div role="status">Team invitation</div>}/></MemoryRouter>);
 const nav=screen.getByRole("navigation",{name:"Campaign navigation"});
 const card=screen.getByRole("region",{name:"Campaign: New campaign"});
 const invitation=screen.getByText("Team invitation");
 expect(nav.compareDocumentPosition(card)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
 expect(card.compareDocumentPosition(invitation)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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
it("puts my team first, paginates the directory, and returns from detail without losing the search",()=>{
 const many=Array.from({length:18},(_,i)=>({...team,id:`tm${i+1}`,owner_id:"ur1",name:`Team ${String(i+1).padStart(2,"0")}`,players:i+1}));
 const {container}=view(many,"tm17");
 const names=()=>Array.from(container.querySelectorAll(".team-directory-item .team-name strong"),el=>el.textContent||"");
 expect(names()).toHaveLength(8);
 expect(names()[0]).toContain("Team 17");
 expect(container.querySelectorAll(".team-directory-item.is-mine")).toHaveLength(1);
 expect(container.querySelector(".team-directory-item.is-mine .team-membership-label")?.textContent).toBe("YOUR TEAM");
 expect(screen.getByText("Page 1 of 3")).toBeTruthy();
 fireEvent.click(screen.getByRole("button",{name:"Next"}));
 expect(screen.getByText("Page 2 of 3")).toBeTruthy();
 fireEvent.click(screen.getByRole("button",{name:"Next"}));
 expect(screen.getByText("Page 3 of 3")).toBeTruthy();
 expect(names()).toHaveLength(2);
 expect((screen.getByRole("button",{name:"Next"}) as HTMLButtonElement).disabled).toBe(true);
 fireEvent.change(screen.getByRole("searchbox",{name:"Search teams"}),{target:{value:"Team 05"}});
 expect(screen.queryByText("Page 3 of 3")).toBeNull();
 expect(names()).toHaveLength(1);
 fireEvent.click(screen.getByRole("button",{name:/Team 05/}));
 expect(container.querySelector(".team-page-layout.is-detail-open .team-detail h2")?.textContent).toBe("Team 05");
 fireEvent.click(screen.getByRole("button",{name:"← All teams"}));
 expect(container.querySelector(".team-page-layout.is-detail-open")).toBeNull();
 expect((screen.getByRole("searchbox",{name:"Search teams"}) as HTMLInputElement).value).toBe("Team 05");
});
it("shows the selected team's public captain profile",async()=>{
 request.mockImplementation((path?:string)=>path?.startsWith("/players/")
  ?Promise.resolve({id:"ur2",display_name:"Captain Beta",handle:"captain_beta",avatar_url:""})
  :new Promise(()=>{}));
 view([{...team,owner_id:"ur2"}]);
 const captain=await screen.findByRole("link",{name:/Team captain Captain Beta/});
 expect(captain.getAttribute("href")).toBe("/players/ur2");
});
it("opens a selected-team link directly in detail mode",()=>{
 const {container}=render(<MemoryRouter initialEntries={["/?selected=tm2"]}><TeamPage live={{campaign,teams:[team,{...team,id:"tm2",name:"Invited team"}],closed:false,busy:false,join:vi.fn()}}/></MemoryRouter>);
 expect(container.querySelector(".team-page-layout.is-detail-open .team-detail h2")?.textContent).toBe("Invited team");
});
it("allows Community members to join a regular team and shows activity separately",()=>{
 const community={...team,id:"tmcommunity",name:"P2L Community",owner_id:"",team_type:"system_community"};
 render(<MemoryRouter><TeamPage live={{campaign,teams:[community,{...team,owner_id:"ur2"}],member:community.id,closed:false,busy:false,join:vi.fn()}}/></MemoryRouter>);
 expect(screen.getByRole("region",{name:"P2L Community activity"})).toBeTruthy();
 expect((screen.getByRole("button",{name:/Join One/}) as HTMLButtonElement).disabled).toBe(false);
 expect(screen.queryByText(/Team locked/)).toBeNull();
});
it("shows my team's daily activity instead of Community data when I belong to a captain team",async()=>{
 const community={...team,id:"tmcommunity",name:"P2L Community",owner_id:"",team_type:"system_community",players:139};
 request.mockImplementation((path?:string)=>path?.endsWith('/teams/tm1/activity')
  ?Promise.resolve({active_today:3,rounds_today:7,as_of:new Date().toISOString()})
  :new Promise(()=>{}));
 render(<MemoryRouter><TeamPage live={{campaign,teams:[community,{...team,players:22}],member:"tm1",closed:false,busy:false,join:vi.fn()}}/></MemoryRouter>);
 const card=screen.getByRole('region',{name:'My team activity'});
 expect(within(card).getByRole('heading',{name:'One'})).toBeTruthy();
 expect(within(card).getByText('22')).toBeTruthy();
 expect(within(card).queryByText('139')).toBeNull();
 await waitFor(()=>expect(within(card).getByText('7')).toBeTruthy());
 expect(within(card).getByText('3')).toBeTruthy();
 expect(request).toHaveBeenCalledWith('/campaigns/brand-new/teams/tm1/activity',undefined,expect.objectContaining({signal:expect.any(AbortSignal)}));
});
