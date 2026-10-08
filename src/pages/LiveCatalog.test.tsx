// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
const teamMocks = vi.hoisted(() => ({
  user: null as { id: string } | null,
  myMembership: vi.fn(),
}));
vi.mock("../state", () => ({
  useApp: () => ({
    user: teamMocks.user,
    campaign: () => undefined,
    entry: {},
    local: { memberships: {}, runs: [] },
    standings: () => {
      throw new Error("Live views must not read demo standings");
    },
    getStage: () => {
      throw new Error("Live views must use the server stage");
    },
  }),
}));
vi.mock("../lib/teams", async (original) => ({
  ...(await original<typeof import("../lib/teams")>()),
  myMembership: teamMocks.myMembership,
}));
vi.mock("../lib/api", async (original) => {
  const mod = await original<typeof import("../lib/api")>();
  return { ...mod, api: new mod.ApiClient("https://p2l.test/api/v1") };
});
import LiveCatalog from "./LiveCatalog";
import { getCampaign, listCampaigns } from "../lib/catalog";
const campaign = {
  id: "cp1",
  slug: "new-event",
  name: "Server campaign",
  ticker: "TEST",
  category: "Test",
  description: "From the server only",
  stage: "prelaunch",
  target: 1234,
  unlock_target: 1234,
  score_per_unlock_point: 100,
  color: "#d2fa69",
  symbol: "T",
};
const reply = (data: unknown, status = 200, code = 0) =>
  new Response(JSON.stringify({ code, data }), { status });
let fetcher: ReturnType<typeof vi.fn>;
beforeEach(() => {
  teamMocks.user = null;
  teamMocks.myMembership.mockReset();
  fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
function mount(path = "/") {
  render(
    <MemoryRouter
      initialEntries={[path]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        <Route path="/" element={<LiveCatalog />} />
        <Route path="/campaign/:id" element={<LiveCatalog />} />
      </Routes>
    </MemoryRouter>,
  );
}
it("loads server catalog and arbitrary slug detail without prototype counts", async () => {
  fetcher.mockImplementation(async (url: string) =>
    url.includes("?limit=")
      ? reply({ items: [campaign], next_cursor: "" })
      : reply(campaign),
  );
  mount();
  await screen.findByRole("heading", { name: campaign.name });
  expect(document.querySelector(".catalog-status-note")).toBeNull();
  expect(document.querySelector(".feature-grid")?.nextElementSibling?.className).toBe("platform-vision");
  expect(document.getElementById("campaigns")?.nextElementSibling?.className).toBe("discover-captain");
  expect(screen.queryByText("PAPERHOOD")).toBeNull();
  expect(screen.getByText("/ 1,234 unlock points")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Trending" })).toBeNull();
  expect(screen.queryByRole("button", { name: "New arrivals" })).toBeNull();
  expect(screen.getByRole("link", { name: "Explore campaigns" }).getAttribute("href")).toBe("#campaigns");
  fireEvent.click(screen.getByRole("link", { name: /Explore campaign\b/ }));
  await screen.findByRole("heading", { level: 1, name: campaign.name });
  expect(screen.queryByRole("button", { name: "Share campaign" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Explore launch details" })).toBeNull();
  expect(
    fetcher.mock.calls.some(
      (c) => c[0] === "https://p2l.test/api/v1/campaigns/new-event",
    ),
  ).toBe(true);
  expect(fetcher.mock.calls[0][1].headers.Authorization).toBeUndefined();
});

it("shows server participation and featured-campaign team counts on Discover", async () => {
  fetcher.mockImplementation(async (url: string) => {
    if (url.endsWith("/campaigns/new-event/participation"))
      return reply({ players: 1234, teams: 7, campaign: "new-event" });
    if (url.includes("?limit="))
      return reply({ items: [{ ...campaign, featured: true }], next_cursor: "" });
    if (url.endsWith("/campaigns/new-event/rankings"))
      return reply({ unlock_points: 0 });
    return reply(campaign);
  });
  mount();
  await screen.findByText("1,234");
  expect(screen.getByText("7")).toBeTruthy();
  expect(fetcher.mock.calls.some((call) =>
    call[0] === "https://p2l.test/api/v1/campaigns/new-event/participation"
  )).toBe(true);
});
it("restores the original hero and cards while showing no demo statistics", async () => {
  fetcher.mockResolvedValue(
    reply({
      items: [
        {
          ...campaign,
          slug: "phood",
          name: "PAPERHOOD",
          hero_image: "/images/paperhood.png",
          image_alt: "Paperhood, a folded-paper Robin Hood in a green cloak",
          featured: true,
        },
        { ...campaign, id: "cp2", slug: "topfrog", name: "TOPFROG" },
      ],
      next_cursor: "",
    }),
  );
  mount();
  await screen.findByRole("heading", { name: "PAPERHOOD" });
  expect(
    screen.getByRole("heading", { name: /Early looks good on you/ }),
  ).toBeTruthy();
  expect(
    screen.getByAltText(
      "Paperhood, a folded-paper Robin Hood in a green cloak",
    ),
  ).toBeTruthy();
  expect(document.querySelectorAll(".campaign-card")).toHaveLength(2);
  expect(document.querySelector(".feature-grid .side-feature")).toBeTruthy();
  expect(screen.queryByText("48.5K")).toBeNull();
  expect(screen.queryByText("115")).toBeNull();
  expect(screen.queryByText("Alice Army")).toBeNull();
  fireEvent.change(screen.getByRole("textbox", { name: "Search campaigns" }), {
    target: { value: "TOPFROG" },
  });
  expect(document.querySelectorAll(".campaign-card")).toHaveLength(1);
  fireEvent.change(screen.getByRole("textbox", { name: "Search campaigns" }), {
    target: { value: "" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Launched" }));
  expect(screen.getByText("No projects found")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "All projects" }));
  expect(document.querySelectorAll(".campaign-card")).toHaveLength(2);
});
it("restores the detail layout and disables unconnected actions", async () => {
  fetcher.mockResolvedValue(
    reply({
      ...campaign,
      slug: "phood",
      name: "PAPERHOOD",
      stage: "countdown",
    }),
  );
  mount("/campaign/phood");
  await screen.findByRole("heading", { level: 1, name: "PAPERHOOD" });
  expect(
    document.querySelector(".campaign-layout .campaign-aside .unlock-panel"),
  ).toBeTruthy();
  expect(screen.queryByRole("link", { name: "Practice game" })).toBeNull();
  expect(
    screen.getByRole("link", { name: "Choose your team" }).getAttribute("href"),
  ).toBe("/campaign/phood/teams");
  expect(
    screen.getByRole("link", { name: "Leaderboard" }).getAttribute("href"),
  ).toBe("/campaign/phood/leaderboard");
  expect(screen.queryByText("Requirement reached")).toBeNull();
  expect(screen.queryByText("Alice Army")).toBeNull();
  expect(document.querySelector(".unlock-number strong")?.textContent).toBe(
    "—",
  );
});
it("shows a direct link to the signed-in player's team", async () => {
  teamMocks.user = { id: "ur1" };
  teamMocks.myMembership.mockResolvedValue({ id: "mb1", team_id: "tm1", joined_at: new Date().toISOString() });
  fetcher.mockResolvedValue(reply({ ...campaign, slug: "phood", name: "PAPERHOOD" }));
  mount("/campaign/phood");
  const link = await screen.findByRole("link", { name: "View my team" });
  expect(link.getAttribute("href")).toBe("/campaign/phood/teams?selected=tm1#selected-team");
  expect(teamMocks.myMembership).toHaveBeenCalledWith("phood", expect.any(AbortSignal));
  expect(screen.queryByRole("link", { name: "Choose your team" })).toBeNull();
});
it("shows qualified progress without promoting the published stage", async () => {
  fetcher.mockImplementation(async (url: string) =>
    url.endsWith("/rankings")
      ? reply({ unlock_points: 1500 })
      : reply({ ...campaign, slug: "phood", name: "PAPERHOOD" }),
  );
  mount("/campaign/phood");
  await screen.findByText("Community goal reached");
  expect(document.querySelector(".unlock-number strong")?.textContent).toBe(
    "1,500",
  );
  expect(
    document.querySelector<HTMLElement>(".unlock-panel .progress-track i")
      ?.style.width,
  ).toBe("100%");
  expect(screen.queryByText("Requirement reached")).toBeNull();
});
it("keeps missing progress unknown and lets the user retry", async () => {
  let available = false;
  fetcher.mockImplementation(async (url: string) =>
    url.endsWith("/rankings")
      ? reply(available ? { unlock_points: 0 } : { unlock_points: -1 })
      : reply({ ...campaign, slug: "phood" }),
  );
  mount("/campaign/phood");
  const retry = await screen.findByRole("button", { name: "Retry progress" });
  expect(document.querySelector(".unlock-number strong")?.textContent).toBe(
    "—",
  );
  available = true;
  fireEvent.click(retry);
  await waitFor(() =>
    expect(document.querySelector(".unlock-number strong")?.textContent).toBe(
      "0",
    ),
  );
});
it("shows an empty state without demo fallback", async () => {
  fetcher.mockResolvedValue(reply({ items: [], next_cursor: "" }));
  mount();
  await screen.findByText("No published campaigns yet");
  expect(screen.queryByText("PAPERHOOD")).toBeNull();
});
it("selects configured featured artwork instead of preferring PAPERHOOD", async () => {
  fetcher.mockResolvedValue(
    reply({
      items: [
        { ...campaign, slug: "phood", name: "PAPERHOOD", featured: false },
        {
          ...campaign,
          id: "cp2",
          slug: "other",
          name: "OTHER PROJECT",
          featured: true,
          hero_image: "/images/other.png",
          image_alt: "Other hero",
        },
      ],
      next_cursor: "",
    }),
  );
  mount();
  await screen.findByAltText("Other hero");
  expect(document.querySelector(".genesis-card")?.getAttribute("href")).toBe(
    "/campaign/other",
  );
  expect(document.querySelector(".genesis-card img")?.getAttribute("src")).toBe(
    "/images/other.png",
  );
});
it("retries after a network failure", async () => {
  fetcher
    .mockRejectedValueOnce(new Error("offline"))
    .mockImplementation(async (url: string) =>
      reply(
        url.includes("/rankings")
          ? { teams: [], unlock_points: 0 }
          : url.includes("/teams")
            ? { items: [] }
            : { items: [campaign], next_cursor: "" },
      ),
    );
  mount();
  await screen.findByRole("alert");
  fireEvent.click(screen.getByRole("button", { name: "Retry campaigns" }));
  await screen.findByRole("heading", { name: campaign.name });
  expect(screen.queryByRole("alert")).toBeNull();
});
it("loads another page and deduplicates records", async () => {
  fetcher.mockImplementation(async (url: string) => {
    if (url.includes("/rankings"))
      return reply({ teams: [], unlock_points: 0 });
    if (url.includes("/teams")) return reply({ items: [] });
    return url.includes("&after=")
      ? reply({
          items: [
            campaign,
            { ...campaign, id: "cp2", slug: "second", name: "Second campaign" },
          ],
          next_cursor: "",
        })
      : reply({ items: [campaign], next_cursor: "v1.0.0.cp1" });
  });
  mount();
  fireEvent.click(
    await screen.findByRole("button", { name: "Load more campaigns" }),
  );
  await screen.findByRole("heading", { name: "Second campaign" });
  expect(screen.getAllByRole("heading", { name: campaign.name })).toHaveLength(
    1,
  );
  expect(
    fetcher.mock.calls.some((c) => c[0].includes("&after=v1.0.0.cp1")),
  ).toBe(true);
});
it("does not reveal a missing or unpublished detail", async () => {
  fetcher.mockResolvedValue(reply(null, 404, 10004));
  mount("/campaign/hidden");
  await screen.findByText(
    "This campaign is unavailable or no longer published.",
  );
  expect(screen.queryByRole("link", { name: "Practice game" })).toBeNull();
});
it("aborts pending requests on navigation", async () => {
  let signal: AbortSignal | undefined;
  fetcher.mockImplementation((_url, options) => {
    signal = options.signal;
    return new Promise(() => {});
  });
  mount("/campaign/slow");
  await waitFor(() => expect(signal).toBeTruthy());
  const previous = signal;
  fireEvent.click(screen.getByRole("link", { name: "All campaigns" }));
  expect(previous?.aborted).toBe(true);
});
it("rejects malformed server responses", async () => {
  fetcher.mockResolvedValueOnce(
    reply({ items: [{ ...campaign, color: "url(bad)" }], next_cursor: "" }),
  );
  await expect(listCampaigns()).rejects.toThrow("invalid");
  fetcher.mockResolvedValueOnce(reply({ ...campaign, slug: "wrong" }));
  await expect(getCampaign("expected")).rejects.toThrow("invalid");
});
