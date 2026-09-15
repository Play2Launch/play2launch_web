// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
const mock = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("../lib/api", () => ({ api: { request: mock.request } }));
vi.mock("../state", () => ({
  useApp: () => ({
    user: { id: "ur1", name: "My player" },
    setAuthOpen: vi.fn(),
  }),
}));
vi.mock("../lib/catalog", () => ({
  getCampaign: async () => ({
    name: "PAPERHOOD",
    slug: "phood",
    stage: "prelaunch",
    ticker: "PHOOD",
  }),
}));
vi.mock("../lib/teams", () => ({
  listTeams: async () => [
    { id: "tm1", name: "A Team", players: 2, initial: "A", color: "#d2fa69" },
  ],
  myMembership: async () => ({ team_id: "tm1" }),
}));
import LiveRankings, { validRankings } from "./LiveRankings";
const data = {
  players: [{ id: "ur1", score: 15000, team_id: "tm1" }],
  teams: [{ id: "tm1", score: 20000 }],
  qualified_players: 2,
  unlock_points: 200,
  as_of: "2026-09-11T12:00:00Z",
};
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  mock.request.mockReset();
});
it("renders real scores, own standing and team tab while retaining data on refresh failure", async () => {
  mock.request.mockResolvedValue(data);
  render(
    <MemoryRouter>
      <LiveRankings />
    </MemoryRouter>,
  );
  await screen.findByText("#1 · 15,000 pts");
  fireEvent.click(screen.getByRole("button", { name: "Teams" }));
  await screen.findByText("#1 · 20,000 pts");
  mock.request.mockRejectedValue(new Error("Network unavailable"));
  fireEvent.click(screen.getByRole("button", { name: "Refresh rankings" }));
  await screen.findByRole("alert");
  expect(screen.getByText("#1 · 20,000 pts")).toBeTruthy();
});
it("pauses polling requests while hidden and refreshes on becoming visible", async () => {
  let state = "visible";
  vi.spyOn(document, "visibilityState", "get").mockImplementation(
    () => state as DocumentVisibilityState,
  );
  mock.request.mockResolvedValue(data);
  render(
    <MemoryRouter>
      <LiveRankings />
    </MemoryRouter>,
  );
  await screen.findByText("#1 · 15,000 pts");
  const count = mock.request.mock.calls.length;
  state = "hidden";
  fireEvent(document, new Event("visibilitychange"));
  expect(mock.request).toHaveBeenCalledTimes(count);
  state = "visible";
  fireEvent(document, new Event("visibilitychange"));
  await waitFor(() => expect(mock.request).toHaveBeenCalledTimes(count + 1));
});
it("rejects invalid score snapshots", () => {
  expect(validRankings(data)).toBe(true);
  expect(validRankings({ ...data, as_of: "invalid" })).toBe(false);
  expect(validRankings({ ...data, players: [{ id: "ur1", score: -1 }] })).toBe(
    false,
  );
});

it("shows public player names and falls back when avatars fail", async () => {
  mock.request.mockResolvedValue({
    ...data,
    players: [
      {
        id: "ur2",
        score: 9000,
        display_name: "Public Captain",
        handle: "public_captain",
        kol_verified: true,
        avatar_url: "https://example.com/avatar.png",
      },
    ],
  });
  const { container } = render(
    <MemoryRouter>
      <LiveRankings />
    </MemoryRouter>,
  );
  await screen.findAllByText("Public Captain");
  expect(screen.getAllByText("@public_captain")).toHaveLength(2);
  expect(screen.getAllByRole("img", {name:"Verified KOL"})).toHaveLength(4);
  const avatar = container.querySelector(
    'img[src="https://example.com/avatar.png"]',
  )!;
  expect(avatar.getAttribute("referrerpolicy")).toBe("no-referrer");
  fireEvent.error(avatar);
  expect(screen.queryByText("ur2")).toBeNull();
  mock.request.mockResolvedValue({...data,players:[{id:"ur2",score:9000,display_name:"Public Captain",kol_verified:false}]});
  fireEvent(window, new Event("focus"));
  fireEvent(document, new Event("visibilitychange"));
  // The next server snapshot removes badges after approval is revoked.
  await waitFor(() => expect(screen.queryAllByRole("img", {name:"Verified KOL"})).toHaveLength(0));
});
