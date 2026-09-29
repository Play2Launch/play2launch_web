// @vitest-environment jsdom
import {afterEach,expect,it,vi} from "vitest";
import {cleanup,render,screen} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {campaigns} from "../data";
vi.mock("../state",()=>({useApp:()=>({user:{id:"ur1"},entry:{},campaign:()=>undefined})}));
vi.mock("../components/CampaignArtwork",()=>({CampaignArtwork:()=>null}));
vi.mock("../components/TeamInvite",()=>({TeamInvite:()=>null}));
import {TeamPage} from "./Campaign";
afterEach(cleanup);
const campaign={...campaigns[0],id:"brand-new",name:"New campaign"};
const team={id:"tm1",owner_id:"ur1",name:"One",handle:"one",initial:"O",color:"#aabbcc",description:"Team one",players:1,score:0,referrals:0};
function view(teams:typeof team[],member?:string){return render(<MemoryRouter><TeamPage live={{campaign,teams,member,closed:false,busy:false,join:vi.fn()}}/></MemoryRouter>)}
it("keeps a campaign-specific creation entry when there are no teams",()=>{
 view([]);
 expect(screen.getByRole("link",{name:"Create my team in New campaign"}).getAttribute("href")).toBe("/captain?campaign=brand-new");
 expect(screen.getByText("No teams available yet")).toBeTruthy();
});
it("labels the captain entry as management for the actual owner",()=>{
 view([team],"tm1");
 expect(screen.getByRole("link",{name:"Manage my team in New campaign"}).getAttribute("href")).toBe("/captain?campaign=brand-new");
 expect(screen.queryByRole("link",{name:/Create my team/})).toBeNull();
});
it("does not mistake ordinary membership for captain ownership",()=>{
 view([{...team,owner_id:"ur2"}],"tm1");
 expect(screen.getByRole("link",{name:"Create my team in New campaign"})).toBeTruthy();
});
