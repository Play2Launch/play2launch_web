// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const mocks = vi.hoisted(() => ({
  request: vi.fn(), listCampaigns: vi.fn(), getCampaign: vi.fn(),
  myMembership: vi.fn(), joinTeam: vi.fn(), listTeams: vi.fn(), auth: vi.fn(), remember: vi.fn(),
  personalTeams: vi.fn(), autoJoinPersonalTeams: vi.fn(), joinPersonalTeam: vi.fn(),
}));
let user: { id: string; mode?: "live"; signupInviteToken?: string } | null = null;
vi.mock("../lib/api", () => ({ api: { request: mocks.request } }));
vi.mock("../lib/catalog", () => ({ listCampaigns: mocks.listCampaigns, getCampaign: mocks.getCampaign }));
vi.mock("../lib/teams", () => ({ myMembership: mocks.myMembership, joinTeam: mocks.joinTeam, listTeams: mocks.listTeams }));
vi.mock("../lib/personalTeams", () => ({ personalTeams: mocks.personalTeams, autoJoinPersonalTeams: mocks.autoJoinPersonalTeams, joinPersonalTeam: mocks.joinPersonalTeam }));
vi.mock("../state", () => ({ useApp: () => ({ user, setAuthOpen: mocks.auth, rememberTeamInvitation: mocks.remember }) }));
vi.mock("../components/CampaignArtwork", async (importOriginal) => ({ ...(await importOriginal<typeof import("../components/CampaignArtwork")>()), CampaignArtwork: () => <span>Campaign art</span> }));
import InviteLanding, { PersonalInviteLanding } from "./InviteLanding";

const campaign = { id: "cp1", slug: "phood", name: "PAPERHOOD", featured: true, availability: { join_open: true } };
const preview = { slug: "phood", team_id: "tm1", referrer_id: "urcaptain", inviter_name: "Captain Mira", team_name: "Paper Crew", campaign_name: "PAPERHOOD" };
const publicTeam = {slug:"phood",team_id:"tm1",team_name:"Paper Crew",campaign_name:"PAPERHOOD",initial:"P",color:"#aacc88",players:12,join_deadline_at:"2027-10-07T00:00:00Z"};
function mount(path: string) {
  const page = () => <MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/ref/:userId" element={<PersonalInviteLanding />} />
    <Route path="/invite/:token" element={<InviteLanding />} />
  </Routes></MemoryRouter>;
  const view = render(page());
  return () => view.rerender(page());
}
beforeEach(() => {
  user = null;
  sessionStorage.clear();
  vi.clearAllMocks();
  mocks.listCampaigns.mockResolvedValue({ items: [campaign], next_cursor: "" });
  mocks.getCampaign.mockResolvedValue(campaign);
  mocks.listTeams.mockResolvedValue([{id:"tm1",name:"Paper Crew",initial:"P",color:"#aacc88",players:12}]);
  mocks.myMembership.mockResolvedValue(null);
  mocks.joinTeam.mockResolvedValue({ id: "mb1", team_id: "tm1", joined_at: new Date().toISOString() });
  mocks.personalTeams.mockResolvedValue([]);
  mocks.autoJoinPersonalTeams.mockResolvedValue({eligible:false,joined:0,skipped:0});
  mocks.joinPersonalTeam.mockResolvedValue({id:"mb1",team_id:"tm1",joined_at:new Date().toISOString()});
});
afterEach(cleanup);

it("shows a named personal invitation with account and featured trial choices", async () => {
  mocks.request.mockResolvedValue({ id: "urfriend", name: "Aster Dawn" });
  mount("/ref/urfriend");
  expect(await screen.findByRole("heading", { name: /Aster Dawn invited you/ })).toBeTruthy();
  const create = await screen.findByRole("button", { name: /Create an account/ });
  await waitFor(() => expect(create.hasAttribute("disabled")).toBe(false));
  expect(screen.getByRole("button", { name: /Try PAPERHOOD/ })).toBeTruthy();
  expect(screen.queryByText("FEATURED CAMPAIGN")).toBeNull();
  fireEvent.click(create);
  expect(mocks.auth).toHaveBeenCalledWith(true);
});

it("shows joinable teams as cards and auto-joins a newly registered personal invitee", async () => {
  mocks.request.mockResolvedValue({ id: "urfriend", name: "Aster Dawn" });
  mocks.personalTeams.mockResolvedValue([publicTeam]);
  mocks.autoJoinPersonalTeams.mockResolvedValue({eligible:true,joined:1,skipped:0});
  const rerender = mount("/ref/urfriend");
  expect(await screen.findByRole("heading", {name:"Paper Crew"})).toBeTruthy();
  expect(screen.queryByRole("link", {name:/View team details/})).toBeNull();
  expect(await screen.findByRole("button", {name:/Create an account & join 1 team/})).toBeTruthy();
  expect(screen.queryByText(/Open teams from|One team per campaign/)).toBeNull();
  expect(screen.getByText(/Join by/)).toBeTruthy();
  expect(document.querySelector(".invitation-team-watermark")).toBeNull();
  user = {id:"urnew",mode:"live"};
  rerender();
  await waitFor(() => expect(mocks.autoJoinPersonalTeams).toHaveBeenCalledWith("urfriend", expect.stringMatching(/^[a-f0-9]{32}$/)));
  expect(await screen.findByText("Joined 1 team.")).toBeTruthy();
});

it("uses the campaign card image as a subdued background for a personal invitation team", async () => {
  mocks.request.mockResolvedValue({ id: "urfriend", name: "Aster Dawn" });
  mocks.personalTeams.mockResolvedValue([publicTeam]);
  mocks.getCampaign.mockResolvedValue({ ...campaign, cover_image: "/images/campaign-card.png" });
  mount("/ref/urfriend");
  await screen.findByRole("heading", { name: "Paper Crew" });
  await waitFor(() => expect(document.querySelector<HTMLImageElement>(".invitation-team-watermark")?.getAttribute("src")).toBe("/images/campaign-card.png"));
  expect(mocks.getCampaign).toHaveBeenCalledWith("phood", expect.any(AbortSignal));
});

it("lets an existing player explicitly join an open team without automatic membership", async () => {
  user = {id:"urold",mode:"live"};
  mocks.request.mockResolvedValue({id:"urfriend",name:"Aster Dawn"});
  mocks.personalTeams.mockResolvedValue([publicTeam]);
  mount("/ref/urfriend");
  const join = await screen.findByRole("button", {name:"Join this team"});
  await waitFor(() => expect(join.hasAttribute("disabled")).toBe(false));
  fireEvent.click(join);
  await waitFor(() => expect(mocks.joinPersonalTeam).toHaveBeenCalledWith("urfriend", publicTeam, expect.stringMatching(/^[a-f0-9]{32}$/)));
  expect(mocks.autoJoinPersonalTeams).toHaveBeenCalled();
});

it("keeps a team invitation on its own page and joins only after the guest opts in and authenticates", async () => {
  mocks.request.mockResolvedValue(preview);
  const rerender = mount("/invite/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
  expect(await screen.findByRole("heading", { name: /Captain Mira invited you to join Paper Crew/ })).toBeTruthy();
  expect(screen.queryByRole("link", {name:/View team details/})).toBeNull();
  expect(await screen.findByRole("heading", { name: "Paper Crew" })).toBeTruthy();
  expect(screen.getByText(/12 players/)).toBeTruthy();
  expect(mocks.remember).toHaveBeenCalledWith("phood", "tm1", "urcaptain", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
  expect(mocks.joinTeam).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: /Create an account & join team/ }));
  expect(mocks.auth).toHaveBeenCalledWith(true);
  user = { id: "urnew" };
  rerender();
  await waitFor(() => expect(mocks.joinTeam).toHaveBeenCalledWith("phood", "tm1", undefined, undefined, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"));
  expect(await screen.findByText(/You’re on Paper Crew/)).toBeTruthy();
});

it("shows a non-navigating campaign summary and subdued artwork on the invited team", async () => {
  mocks.request.mockResolvedValue(preview);
  mocks.getCampaign.mockResolvedValue({
    ...campaign, stage: "prelaunch", ticker: "$PHOOD", category: "Runner · Survival",
    description: "Buy high. Sell low.", cover_image: "/images/paperhood-card.png",
  });
  mount("/invite/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
  const summary = await screen.findByLabelText("PAPERHOOD campaign information");
  expect(summary.tagName).toBe("ASIDE");
  expect(summary.textContent).toContain("PRE-LAUNCH");
  expect(summary.textContent).toContain("$PHOOD");
  expect(summary.textContent).not.toContain("$$PHOOD");
  expect(summary.textContent).toContain("Runner · Survival");
  expect(summary.textContent).not.toContain("Paper Crew");
  expect(screen.queryByRole("link", { name: /PAPERHOOD campaign information/ })).toBeNull();
  await waitFor(() => expect(document.querySelector<HTMLImageElement>(".invitation-team-watermark")?.getAttribute("src")).toBe("/images/paperhood-card.png"));
});

it("never transfers an existing member automatically", async () => {
  mocks.request.mockResolvedValue(preview);
  mocks.myMembership.mockResolvedValue({ id: "mbother", team_id: "tmother", joined_at: new Date().toISOString() });
  mocks.joinTeam.mockRejectedValue(new Error("You already belong to another team in this campaign. No team was changed."));
  const rerender = mount("/invite/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
  await screen.findByRole("heading", { name: /Captain Mira invited/ });
  fireEvent.click(screen.getByRole("button", { name: /Create an account & join team/ }));
  user = { id: "urexisting" };
  rerender();
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "You already belong to another team in this campaign. No team was changed.");
  expect(mocks.joinTeam).toHaveBeenCalledWith("phood", "tm1", undefined, undefined, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
});

it("auto-joins a newly created TMA account only for its original invitation token", async () => {
  mocks.request.mockResolvedValue(preview);
  const rerender = mount("/invite/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
  await screen.findByRole("heading", { name: /Captain Mira invited/ });
  user = { id: "urnew", signupInviteToken: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" };
  rerender();
  expect(mocks.joinTeam).not.toHaveBeenCalled();
  user = { id: "urnew", signupInviteToken: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" };
  rerender();
  await waitFor(() => expect(mocks.joinTeam).toHaveBeenCalledWith("phood", "tm1", undefined, undefined, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"));
});

it("allows an invited member to move from P2L Community while preserving the token", async () => {
  mocks.request.mockResolvedValue(preview);
  mocks.myMembership.mockResolvedValue({ id: "mbcommunity", team_id: "tmcommunity", joined_at: new Date().toISOString() });
  user = { id: "urmember" };
  mount("/invite/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
  await screen.findByRole("heading", { name: /Captain Mira invited/ });
  fireEvent.click(screen.getByRole("button", { name: /Join Paper Crew/ }));
  await waitFor(() => expect(mocks.joinTeam).toHaveBeenCalledWith("phood", "tm1", undefined, undefined, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"));
});

it("does not offer registration or joining for a revoked team link", async () => {
  mocks.request.mockRejectedValue(new Error("revoked"));
  mount("/invite/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
  expect(await screen.findByRole("heading", { name: "This link can’t be used." })).toBeTruthy();
  expect(screen.queryByRole("button", { name: /join team/i })).toBeNull();
  expect(mocks.joinTeam).not.toHaveBeenCalled();
});
