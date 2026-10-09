// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const mocks = vi.hoisted(() => ({ request: vi.fn(), authenticated: vi.fn(), user: { id: "ur1", name: "My player" } as { id: string; name: string } | undefined }));
vi.mock("../lib/api", () => ({ api: { request: mocks.request, authenticated: mocks.authenticated } }));
vi.mock("../lib/catalog", () => ({
  recentCampaigns: async () => ({ items: [{ slug: "phood", name: "PAPERHOOD" }], hasMore: true }),
  listCampaigns: async () => ({ items: [{ id: "cp2", slug: "older", name: "Older campaign" }], next_cursor: "" }),
}));
vi.mock("../state", () => ({ useApp: () => ({ user: mocks.user, setAuthOpen: vi.fn() }) }));
import PointsLeaderboard, { validPointsLeaderboard } from "./PointsLeaderboard";

const snapshot = {
  players: [{ id: "ur2", rank: 1, points: 500, display_name: "Top player" }],
  mine: { id: "ur1", rank: 204, points: 12, display_name: "My player" },
  as_of: "2026-10-07T12:00:00Z",
};
afterEach(() => { cleanup(); mocks.request.mockReset(); mocks.authenticated.mockReset(); mocks.user = { id: "ur1", name: "My player" }; });
function view() {
  return render(<MemoryRouter initialEntries={["/leaderboard"]}><Routes>
    <Route path="/leaderboard" element={<PointsLeaderboard />} />
    <Route path="/campaign/:id/leaderboard" element={<h1>Campaign scores page</h1>} />
  </Routes></MemoryRouter>);
}
it("shows global points, an outside-top-100 own rank, and campaign navigation", async () => {
  mocks.authenticated.mockResolvedValue(snapshot);
  view();
  expect(await screen.findByText("#204 · 12 P2L Points")).toBeTruthy();
  expect(screen.getByRole("heading", { name: "P2L Points leaderboard" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Top player" }).getAttribute("href")).toBe("/players/ur2");
  expect(mocks.authenticated.mock.calls[0][0]).toBe("/points/leaderboard/me");
  fireEvent.click(screen.getByRole("button", { name: /Other campaigns/ }));
  fireEvent.click(await screen.findByRole("link", { name: "Older campaign" }));
  expect(screen.getByRole("heading", { name: "Campaign scores page" })).toBeTruthy();
});
it("uses the public endpoint for guests", async () => {
  mocks.user = undefined;
  mocks.request.mockResolvedValue({ players: snapshot.players, as_of: snapshot.as_of });
  view();
  expect(await screen.findByRole("link", { name: "Top player" })).toBeTruthy();
  expect(mocks.request.mock.calls[0][0]).toBe("/points/leaderboard");
  expect(mocks.authenticated).not.toHaveBeenCalled();
});
it("rejects malformed or negative balances", () => {
  expect(validPointsLeaderboard(snapshot)).toBe(true);
  expect(validPointsLeaderboard({ ...snapshot, players: [{ ...snapshot.players[0], points: -1 }] })).toBe(false);
  expect(validPointsLeaderboard({ ...snapshot, as_of: "invalid" })).toBe(false);
});
