// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { CampaignIdentityCard, CampaignNav, type CampaignHeaderData } from "./CampaignHeader";

vi.mock("../state", () => ({ useApp: () => ({ platform: { runtime: "web" } }) }));

const campaign: CampaignHeaderData = {
  id: "phood",
  name: "PAPERHOOD",
  ticker: "PHOOD",
  category: "Trading",
  description: "Play with your team.",
  stage: "live",
  color: "#d2fa69",
  symbol: "PH",
  hero_image: "/paperhood.png",
};

afterEach(cleanup);

it.each([
  ["/campaign/phood", "Overview", undefined],
  ["/campaign/phood/teams", "Teams", undefined],
  ["/campaign/phood/leaderboard", "Leaderboard", undefined],
  ["/leaderboard", "Leaderboard", "leaderboard" as const],
])("keeps the same navigation and identity on %s", (path, selected, activeTab) => {
  render(
    <MemoryRouter initialEntries={[path]}>
      <CampaignNav campaign={campaign} live activeTab={activeTab} />
      <CampaignIdentityCard campaign={campaign} />
    </MemoryRouter>,
  );

  const nav = screen.getByRole("navigation", { name: "Campaign navigation" });
  expect(within(nav).getAllByRole("link")).toHaveLength(3);
  expect(within(nav).getByRole("link", { name: selected }).getAttribute("aria-current")).toBe("page");
  const card = screen.getByRole("region", { name: "Campaign: PAPERHOOD" });
  expect(card.textContent).toContain("Play with your team.");
  expect(nav.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});
