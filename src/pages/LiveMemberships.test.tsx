// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
const mocks = vi.hoisted(() => ({ memberships: vi.fn() }));
vi.mock("../state", () => ({ useApp: () => ({ user: { id: "ur1" } }) }));
vi.mock("../lib/teams", () => ({ memberships: mocks.memberships }));
vi.mock("./Campaign", () => ({ TeamPage: () => null }));
import { LiveMemberships } from "./LiveTeams";
const item = {
  campaign_id: "cp1",
  slug: "event",
  name: "Event",
  team_name: "My squad",
  membership: { id: "mb1", team_id: "tm1", joined_at: "2026-01-01T00:00:00Z" },
  role: "captain",
  activity_status: "active",
  scoring_ends_at: "2027-01-01T00:00:00Z",
};
beforeEach(() =>
  mocks.memberships.mockResolvedValue({ items: [item], next_cursor: "" }),
);
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
function view() {
  render(
    <MemoryRouter>
      <LiveMemberships />
    </MemoryRouter>,
  );
}
it("shows all memberships without the hidden filter form and links captains to management", async () => {
  view();
  const link = await screen.findByRole("link", { name: "Manage my team" });
  expect(link.getAttribute("href")).toBe("/captain?campaign=event");
  expect(mocks.memberships.mock.calls[0][2]).toEqual({
    q: "",
    status: "all",
    role: "all",
  });
  expect(screen.queryByRole("searchbox")).toBeNull();
  expect(screen.queryByRole("combobox", { name: "Campaign status" })).toBeNull();
});
it("continues to load more memberships without the filter form", async () => {
  mocks.memberships.mockResolvedValueOnce({
    items: [item],
    next_cursor: "cursor",
  });
  view();
  fireEvent.click(
    await screen.findByRole("button", { name: "Load more teams" }),
  );
  await waitFor(() =>
    expect(mocks.memberships.mock.calls.at(-1)?.[0]).toBe("cursor"),
  );
  expect(mocks.memberships.mock.calls.at(-1)?.[2]).toEqual({ q: "", status: "all", role: "all" });
});
it("shows a clear empty state when the player has no teams", async () => {
  mocks.memberships.mockResolvedValue({ items: [], next_cursor: "" });
  view();
  expect(await screen.findByText("You haven't joined a team yet.")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Show all my teams" })).toBeNull();
  expect(screen.getByRole("link", { name: "Explore campaigns" }).getAttribute("href")).toBe("/");
});
