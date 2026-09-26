// @vitest-environment jsdom
import { afterEach, it, expect, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
const mock = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("../lib/api", () => ({ api: { authenticated: mock.request } }));
import { PlatformPoints } from "./PlatformPoints";
import { PointsProvider } from "./PointsProvider";
import { MemoryRouter } from "react-router-dom";
const view = () =>
  render(
    <MemoryRouter>
      <PointsProvider userId="ur1">
        <PlatformPoints />
      </PointsProvider>
    </MemoryRouter>,
  );
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const page = {
  balance: 60,
  items: [
    {
      id: "1",
      kind: "first_game",
      amount: 50,
      period: "once",
      created_at: "2026-09-25T00:00:00Z",
    },
  ],
  next_cursor: "",
  policy: {
    first: 50,
    daily: 10,
    daily_three: 20,
    weekly_five: 50,
    min_elapsed_ms: 15000,
  },
  tasks: [],
  server_time: "2026-09-25T00:00:00Z",
};
it("shows separate platform points and private history without a claim operation", async () => {
  mock.request.mockResolvedValue(page);
  view();
  await screen.findByText("60");
  expect(screen.getByText(/No guaranteed token/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Points history" }));
  expect(screen.getByText("First qualifying game")).toBeTruthy();
  expect(screen.getByText("+50")).toBeTruthy();
  expect(mock.request).toHaveBeenCalledWith(
    "/points/tasks",
    undefined,
    expect.any(AbortSignal),
  );
});
it("shows errors rather than presenting zero points on failure", async () => {
  mock.request.mockRejectedValue(new Error("Unavailable"));
  view();
  expect((await screen.findByRole("alert")).textContent).toBe("Unavailable");
  expect(screen.queryByText("0")).toBeNull();
});
