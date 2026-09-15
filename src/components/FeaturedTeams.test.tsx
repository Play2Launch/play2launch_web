// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { api } from "../lib/api";
import { FeaturedTeams } from "./FeaturedTeams";
vi.mock("../lib/teams", () => ({
  listTeams: async () =>
    [1, 2, 3, 4].map((i) => ({
      id: `tm${i}`,
      name: `Team ${i}`,
      initial: "T",
      color: "#aabbcc",
      players: i,
    })),
}));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it("shows only the featured campaign's first three teams and retains them on errors", async () => {
  const request = vi
    .spyOn(api, "request")
    .mockResolvedValue({
      teams: [1, 2, 3, 4].map((i) => ({ id: `tm${i}`, score: 5000 - i })),
    });
  render(
    <MemoryRouter>
      <FeaturedTeams slug="other" name="OTHER" />
    </MemoryRouter>,
  );
  await screen.findByText("Team 1");
  expect(screen.getByText("TOP TEAMS / OTHER")).toBeTruthy();
  expect(screen.queryByText("Team 4")).toBeNull();
  expect(screen.getByText("View full leaderboard").getAttribute("href")).toBe(
    "/campaign/other/leaderboard",
  );
  expect(request.mock.calls[0][0]).toBe("/campaigns/other/rankings");
  request.mockRejectedValue(new Error("offline"));
  fireEvent(window, new Event("focus"));
  await screen.findByRole("alert");
  expect(screen.getByText("Team 1")).toBeTruthy();
});
it("shows an honest empty state", async () => {
  vi.spyOn(api, "request").mockResolvedValue({ teams: [] });
  render(
    <MemoryRouter>
      <FeaturedTeams slug="empty" name="EMPTY" />
    </MemoryRouter>,
  );
  await screen.findByText("No scores yet");
  expect(screen.queryByText("Rankings coming soon")).toBeNull();
});
