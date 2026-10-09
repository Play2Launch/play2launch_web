// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LeaderboardScope } from "./LeaderboardScope";

const mocks = vi.hoisted(() => ({ recentCampaigns: vi.fn(), listCampaigns: vi.fn() }));
vi.mock("../lib/catalog", () => ({ recentCampaigns: mocks.recentCampaigns, listCampaigns: mocks.listCampaigns }));

const recent = [
  { slug: "newest", name: "Newest campaign", cover_image: "https://example.test/newest.png" },
  { slug: "second", name: "Second campaign", symbol: "SC", color: "#99cc44" },
  { slug: "third", name: "Third campaign" },
];
afterEach(() => { cleanup(); mocks.recentCampaigns.mockReset(); mocks.listCampaigns.mockReset(); });

it("keeps P2L Points first and exposes at most three recent campaign tabs", async () => {
  mocks.recentCampaigns.mockResolvedValue({ items: [...recent, { slug: "fourth", name: "Fourth campaign" }], hasMore: true });
  mocks.listCampaigns.mockResolvedValue({ items: [recent[0], { id: "cp5", slug: "older", name: "Older campaign", cover_image: "https://example.test/older.png" }], next_cursor: "" });
  render(<MemoryRouter><LeaderboardScope /></MemoryRouter>);
  const nav = screen.getByRole("navigation", { name: "Leaderboard scope" });
  expect(nav.firstElementChild?.firstElementChild?.textContent).toBe("P2L Points");
  expect((await screen.findByRole("link", { name: "Newest campaign" })).getAttribute("href")).toBe("/campaign/newest/leaderboard");
  expect(screen.getByRole("link", { name: "Third campaign" })).toBeTruthy();
  expect(screen.queryByText("Fourth campaign")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Other campaigns" }));
  const older = await screen.findByRole("link", { name: "Older campaign" });
  expect(older.getAttribute("href")).toBe("/campaign/older/leaderboard");
  expect(older.querySelector("img")?.getAttribute("src")).toBe("https://example.test/older.png");
  expect(screen.getAllByText("Newest campaign")).toHaveLength(1);
});

it("marks the current campaign tab, or Other campaigns for an older campaign", async () => {
  mocks.recentCampaigns.mockResolvedValue({ items: recent, hasMore: true });
  const { rerender } = render(<MemoryRouter><LeaderboardScope campaign={{ slug: "second", name: "Second campaign" }} /></MemoryRouter>);
  expect((await screen.findByText("Second campaign")).closest("[aria-current]")?.getAttribute("aria-current")).toBe("page");
  rerender(<MemoryRouter><LeaderboardScope campaign={{ slug: "older", name: "Older campaign" }} /></MemoryRouter>);
  expect(screen.getByRole("button", { name: "Other campaigns" }).className).toContain("is-current");
});

it("keeps Other campaigns hidden when there are no extra desktop tabs, while mobile can choose a campaign", async () => {
  mocks.recentCampaigns.mockResolvedValue({ items: recent.slice(0, 2), hasMore: false });
  mocks.listCampaigns.mockResolvedValue({ items: recent.slice(0, 2), next_cursor: "" });
  render(<MemoryRouter><LeaderboardScope campaign={{ slug: "newest", name: "Newest campaign" }} /></MemoryRouter>);
  expect(await screen.findByText("Second campaign")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Other campaigns" })).toBeNull();
  const mobilePicker = screen.getByRole("button", { name: "Campaign scores" });
  expect(mobilePicker.getAttribute("aria-current")).toBe("page");
  fireEvent.click(mobilePicker);
  const selected = await screen.findByRole("link", { name: "Newest campaign", current: "page" });
  expect(selected.getAttribute("href")).toBe("/campaign/newest/leaderboard");
  expect(selected.querySelector("img")?.getAttribute("src")).toBe("https://example.test/newest.png");
  expect(selected.querySelector(".leaderboard-campaign-option-check")).toBeTruthy();
  fireEvent.error(selected.querySelector("img") as HTMLImageElement);
  expect(selected.querySelector("img")).toBeNull();
  expect(selected.querySelector(".leaderboard-campaign-option-fallback")?.textContent).toBe("N");
  expect(screen.getAllByRole("link", { name: "Second campaign" })).toHaveLength(2);
  expect(screen.getAllByRole("link", { name: "Second campaign" }).find((link) => link.classList.contains("leaderboard-campaign-option"))?.querySelector(".leaderboard-campaign-option-fallback")?.textContent).toBe("SC");
});
