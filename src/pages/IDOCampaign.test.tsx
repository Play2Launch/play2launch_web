// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { Campaign } from "../data";
const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  authenticated: vi.fn(),
  user: null as null | { id: string },
}));
vi.mock("../lib/api", () => ({
  api: { request: mocks.request, authenticated: mocks.authenticated },
}));
vi.mock("../state", () => ({
  useApp: () => ({ user: mocks.user, setAuthOpen: vi.fn() }),
}));
vi.mock("../lib/walletLoader", () => ({
  useWalletModule: () => null,
  loadWallet: vi.fn(),
}));
import IDOCampaign from "./IDOCampaign";
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mocks.user = null;
});
const campaign = {
  id: "combo",
  name: "Market Combo",
  ticker: "PHOOD",
  campaign_type: "play_to_ido",
  stage: "prelaunch",
  color: "#d2fa69",
  symbol: "M",
  description: "Play the beat.",
  category: "Arcade",
} as Campaign;
it("preserves campaign navigation and omits teams and shared unlock scores", async () => {
  mocks.request.mockResolvedValue({ configured: false });
  render(
    <MemoryRouter>
      <IDOCampaign campaign={campaign} />
    </MemoryRouter>,
  );
  expect(
    await screen.findByText(/Subscription details are coming soon/),
  ).toBeTruthy();
  expect(screen.queryByRole("link", { name: "Teams" })).toBeNull();
  expect(screen.getByRole("link", { name: "Overview" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Play Market Combo" })).toBeTruthy();
  expect(screen.getByText(/20,000 points/)).toBeTruthy();
  expect(mocks.authenticated).not.toHaveBeenCalled();
});
it("a valid zero-score game unlocks eligibility without requiring positive points", async () => {
  mocks.user = { id: "ur1" };
  mocks.request.mockResolvedValue({ configured: false });
  mocks.authenticated.mockResolvedValue({
    eligible: true,
    highest_score: 0,
    user_id: "hash",
  });
  render(
    <MemoryRouter>
      <IDOCampaign campaign={campaign} />
    </MemoryRouter>,
  );
  expect(await screen.findByText("Unlocked")).toBeTruthy();
  expect(screen.getByText("0")).toBeTruthy();
});
