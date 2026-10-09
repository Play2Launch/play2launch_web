import { expect, it, vi } from "vitest";
import { recentCampaigns } from "./catalog";
import { api } from "./api";

vi.mock("./api", () => ({ api: { request: vi.fn() } }));

const campaign = {
  id: "cp1", slug: "phood", name: "PAPERHOOD", ticker: "PHOOD",
  category: "Game", description: "Play", stage: "prelaunch",
  target: 100, color: "#d2fa69", symbol: "P",
};

it("accepts only a confirmed recent-order response for leaderboard tabs", async () => {
  vi.mocked(api.request).mockResolvedValueOnce({ items: [campaign], next_cursor: "", order: "recent", has_more: false });
  await expect(recentCampaigns()).resolves.toEqual({ items: [campaign], hasMore: false });
  expect(vi.mocked(api.request).mock.calls[0][0]).toBe("/campaigns?limit=3&order=recent");
  vi.mocked(api.request).mockResolvedValueOnce({ items: [campaign], next_cursor: "" });
  await expect(recentCampaigns()).rejects.toThrow("recent campaign response was invalid");
  vi.mocked(api.request).mockResolvedValueOnce({ items: [campaign], next_cursor: "", order: "recent" });
  await expect(recentCampaigns()).resolves.toEqual({ items: [campaign], hasMore: false });
});
