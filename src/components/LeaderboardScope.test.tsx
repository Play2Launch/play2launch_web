// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LeaderboardScope } from "./LeaderboardScope";

const mocks = vi.hoisted(() => ({ recentCampaigns: vi.fn(), listCampaigns: vi.fn() }));
vi.mock("../lib/catalog", () => ({ recentCampaigns: mocks.recentCampaigns, listCampaigns: mocks.listCampaigns }));

const recent = [
  { slug: "newest", name: "Newest campaign" },
  { slug: "second", name: "Second campaign" },
  { slug: "third", name: "Third campaign" },
];
afterEach(() => { cleanup(); mocks.recentCampaigns.mockReset(); mocks.listCampaigns.mockReset(); });

it("keeps P2L Points first and exposes at most three recent campaign tabs", async () => {
  mocks.recentCampaigns.mockResolvedValue({ items: [...recent, { slug: "fourth", name: "Fourth campaign" }], hasMore: true });
  mocks.listCampaigns.mockResolvedValue({ items: [recent[0], { id: "cp5", slug: "older", name: "Older campaign" }], next_cursor: "" });
  render(<MemoryRouter><LeaderboardScope /></MemoryRouter>);
  const nav = screen.getByRole("navigation", { name: "Leaderboard scope" });
  expect(nav.firstElementChild?.firstElementChild?.textContent).toBe("P2L Points");
  expect((await screen.findByRole("link", { name: "Newest campaign" })).getAttribute("href")).toBe("/campaign/newest/leaderboard");
  expect(screen.getByRole("link", { name: "Third campaign" })).toBeTruthy();
  expect(screen.queryByText("Fourth campaign")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Other campaigns" }));
  expect((await screen.findByRole("link", { name: "Older campaign" })).getAttribute("href")).toBe("/campaign/older/leaderboard");
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
  expect((await screen.findByRole("link", { name: "Newest campaign", current: "page" })).getAttribute("href")).toBe("/campaign/newest/leaderboard");
  expect(screen.getAllByRole("link", { name: "Second campaign" })).toHaveLength(2);
});
