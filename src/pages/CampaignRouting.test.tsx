// @vitest-environment jsdom
import { afterEach, beforeEach, it, expect, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
const mock = vi.hoisted(() => ({
  list: vi.fn(),
  get: vi.fn(),
  request: vi.fn(),
  teams: vi.fn(),
  member: vi.fn(),
}));
vi.mock("../lib/api", () => ({ api: { request: mock.request } }));
vi.mock("../lib/catalog", () => ({
  getCampaign: mock.get,
  listCampaigns: mock.list,
}));
vi.mock("../lib/teams", () => ({
  listTeams: mock.teams,
  myMembership: mock.member,
}));
vi.mock("../state", () => ({
  useApp: () => ({ user: { id: "ur1", name: "Player" } }),
}));
vi.mock("../components/CampaignPicker", () => ({
  CampaignPicker: () => <div>Campaign selection</div>,
}));
import LiveRankings from "./LiveRankings";
import LiveLaunch from "./LiveLaunch";
const campaign = {
  name: "New event",
  slug: "new-event",
  stage: "prelaunch",
  ticker: "NEW",
  target: 10000,
  unlock_target: 10000,
};
const snapshot = {
  players: [],
  teams: [],
  qualified_players: 0,
  unlock_points: 42,
  as_of: "2026-09-26T00:00:00Z",
};
const gone = Object.assign(new Error("resource not found"), { status: 404 });
beforeEach(() => {
  mock.list.mockResolvedValue({ items: [campaign], next_cursor: "" });
  mock.get.mockResolvedValue(campaign);
  mock.request.mockResolvedValue(snapshot);
  mock.teams.mockResolvedValue([]);
  mock.member.mockResolvedValue(null);
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
function view(path = "/leaderboard") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/leaderboard" element={<LiveRankings />} />
        <Route path="/campaign/:id/leaderboard" element={<LiveRankings />} />
        <Route path="/campaign/:id/launch" element={<LiveLaunch />} />
      </Routes>
    </MemoryRouter>,
  );
}
it("selects the first published campaign, never the historical default", async () => {
  view();
  await waitFor(() => expect(mock.request).toHaveBeenCalled());
  expect(mock.request.mock.calls[0][0]).toBe("/campaigns/new-event/rankings");
  expect(mock.get).not.toHaveBeenCalled();
  expect(mock.teams.mock.calls[0][0]).toBe("new-event");
});
it("shows an empty state without any dependent API calls", async () => {
  mock.list.mockResolvedValue({ items: [], next_cursor: "" });
  view();
  await screen.findByText("No published campaigns yet.");
  expect(mock.request).not.toHaveBeenCalled();
  expect(mock.teams).not.toHaveBeenCalled();
  expect(mock.member).not.toHaveBeenCalled();
});
it("stops at the campaign lookup for an unavailable explicit slug", async () => {
  mock.get.mockRejectedValue(gone);
  view("/campaign/retired/leaderboard");
  await screen.findByRole("alert");
  expect(mock.get.mock.calls[0][0]).toBe("retired");
  expect(mock.list).not.toHaveBeenCalled();
  expect(mock.request).not.toHaveBeenCalled();
  expect(mock.member).not.toHaveBeenCalled();
  expect(mock.teams).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Switch campaign" }));
  expect(screen.getByText("Campaign selection")).toBeTruthy();
});
it("unmounts the board and stops focus refresh after a ranking 404", async () => {
  mock.request.mockRejectedValue(gone);
  view();
  await screen.findByRole("alert");
  const count = mock.request.mock.calls.length;
  fireEvent.focus(window);
  fireEvent(document, new Event("visibilitychange"));
  expect(mock.request).toHaveBeenCalledTimes(count);
  expect(screen.queryByRole("button", { name: "Refresh rankings" })).toBeNull();
});
it("renders live launch data for an arbitrary new slug without demo claims", async () => {
  view("/campaign/new-event/launch");
  await screen.findByText("42 / 10,000 unlock points");
  expect(screen.getByRole("heading", { name: "New event" })).toBeTruthy();
  expect(screen.queryByText(/sample/i)).toBeNull();
  expect(
    screen.getByRole("link", { name: "View campaign" }).getAttribute("href"),
  ).toBe("/campaign/new-event");
});
it("does not query rankings for a removed launch campaign", async () => {
  mock.get.mockRejectedValue(gone);
  view("/campaign/retired/launch");
  await screen.findByRole("alert");
  expect(mock.request).not.toHaveBeenCalled();
});
