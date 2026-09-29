// @vitest-environment jsdom
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
const mocks = vi.hoisted(() => ({
  authenticated: vi.fn(),
  request: vi.fn(),
  user: { id: "ur1" } as { id: string } | null,
  member: {team_id:"tm1"} as {team_id:string}|null,
}));
vi.mock("../lib/api", () => ({ api: mocks }));
vi.mock("../state", () => ({
  useApp: () => ({ user: mocks.user, setAuthOpen: vi.fn() }),
}));
vi.mock("../lib/catalog", () => ({
  getCampaign: async () => ({ id: "cp1", slug: "phood", name: "PAPERHOOD", game_key:"paperhood", rules_version:"paperhood-v1" }),
}));
vi.mock("../lib/teams", () => ({
  myMembership: async () => mocks.member,
  listTeams: async () => [{ id: "tm1", name: "Alice" }],
}));
vi.mock("./Game", () => ({
  GamePage: ({ live }: any) => (
    <button onClick={() => live.finish([{ buy_tick: 0, sell_tick: 10 }])}>
      Finish test round
    </button>
  ),
}));
import { LiveGame, LiveScore } from "./LiveGame";
const session = {
  id: "gs1",
  slug: "phood",
  seed: 1,
  rules: "paperhood-v1",
  status: "playing",
  score: 0,
  team_id: "tm1",
};
function mount() {
  render(
    <MemoryRouter initialEntries={["/campaign/phood/compete"]}>
      <Routes>
        <Route path="/campaign/:id/compete" element={<LiveGame />} />
        <Route
          path="/campaign/:id/session/:sessionId"
          element={<LiveScore />}
        />
      </Routes>
    </MemoryRouter>,
  );
}
beforeEach(() => {
  mocks.user = { id: "ur1" };
  mocks.member = {team_id:"tm1"};
  mocks.authenticated.mockReset();
});
afterEach(cleanup);
it("lets a signed-in nonmember start without choosing a team",async()=>{
 mocks.member=null;
 mocks.authenticated.mockResolvedValue({...session,team_id:"tmcommunity"});
 mount();
 fireEvent.click(await screen.findByRole("button",{name:"Start ranked round"}));
 await screen.findByRole("button",{name:"Finish test round"});
 expect(mocks.authenticated.mock.calls[0][0]).toBe("/campaigns/phood/sessions");
});
it("accepts a Community result with personal points but no team score",async()=>{
 mocks.authenticated.mockImplementation(async(path:string)=>path.endsWith('/summary')?{session_id:'gs1',community:true,personal_best:123,previous_best:0,round_improvement:123,team_contribution:0,team_total:0,as_of:new Date().toISOString()}:{...session,status:'accepted',score:123});
 render(<MemoryRouter initialEntries={['/campaign/phood/session/gs1']}><Routes><Route path="/campaign/:id/session/:sessionId" element={<LiveScore/>}/></Routes></MemoryRouter>);
 await screen.findByText(/P2L Community · This round counts/);
 expect(screen.queryByRole('alert')).toBeNull();
 expect(screen.getByText('Current team total (game points)').closest('article')?.hidden).toBe(true);
});
it("submits operations only and opens the accepted server result", async () => {
  mocks.authenticated.mockImplementation(async (path: string) =>
    path.endsWith("/summary")
      ? {
          session_id: "gs1",
          personal_best: 123,
          previous_best: 100,
          round_improvement: 23,
          team_contribution: 123,
          team_total: 500,
          unlock_contribution: 1,
          round_unlock_improvement: 0,
          score_per_unlock_point: 100,
          as_of: new Date().toISOString(),
        }
      : path.endsWith("/sessions")
        ? session
        : { ...session, status: "accepted", score: 123 },
  );
  mount();
  fireEvent.click(
    await screen.findByRole("button", { name: "Start ranked round" }),
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "Finish test round" }),
  );
  await screen.findByText("Score accepted");
  expect(
    mocks.authenticated.mock.calls.find((c) => c[0].endsWith("/submit"))?.[1],
  ).toEqual({ trades: [{ buy_tick: 0, sell_tick: 10 }] });
  await screen.findByText("123 points");
  await screen.findByText("+23");
  await screen.findByText("1 unlock points");
  expect(screen.getByText("500")).toBeTruthy();
});
it("does not create a session for a guest", () => {
  mocks.user = null;
  mount();
  expect(screen.getByRole("button", { name: "Sign in" })).toBeTruthy();
  expect(mocks.authenticated).not.toHaveBeenCalled();
});
it("keeps failed operations available for explicit retry", async () => {
  mocks.authenticated.mockImplementation(async (path: string) => {
    if (path.endsWith("/sessions")) return session;
    throw new Error("Network unavailable");
  });
  mount();
  fireEvent.click(
    await screen.findByRole("button", { name: "Start ranked round" }),
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "Finish test round" }),
  );
  await screen.findByRole("button", { name: "Retry submission" });
  expect(screen.queryByText("Score accepted")).toBeNull();
});
