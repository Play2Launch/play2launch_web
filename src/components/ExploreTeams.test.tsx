// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const mock = vi.hoisted(() => ({ listCampaigns: vi.fn() }));
vi.mock("../lib/catalog", () => ({ listCampaigns: mock.listCampaigns }));
import { ExploreTeams } from "./ExploreTeams";

afterEach(() => { cleanup(); mock.listCampaigns.mockReset(); });

it("lets visitors find a campaign and open its teams without signing in", async () => {
  mock.listCampaigns.mockImplementation(async (_after: string, _signal: AbortSignal, query: string) => ({
    items: [{ id: "cp1", slug: "paperhood", name: query ? "PAPERHOOD" : "First campaign", ticker: "P2L", stage: "prelaunch", description: "Play with a team." }],
    next_cursor: "",
  }));
  render(<MemoryRouter><ExploreTeams /></MemoryRouter>);
  expect((await screen.findByRole("link", { name: "View teams" })).getAttribute("href")).toBe("/campaign/paperhood/teams");
  fireEvent.change(screen.getByRole("searchbox", { name: "Search campaigns for teams" }), { target: { value: "paper" } });
  await waitFor(() => expect(mock.listCampaigns).toHaveBeenLastCalledWith("", expect.any(AbortSignal), "paper"));
  expect(await screen.findByText("PAPERHOOD")).toBeTruthy();
});
