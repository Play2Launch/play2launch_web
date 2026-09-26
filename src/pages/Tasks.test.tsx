// @vitest-environment jsdom
import { afterEach, it, expect, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
const mock = vi.hoisted(() => ({
  user: { id: "ur1" } as { id: string } | null,
  auth: vi.fn(),
}));
vi.mock("../state", () => ({
  useApp: () => ({ user: mock.user, setAuthOpen: mock.auth }),
}));
vi.mock("../lib/api", () => ({ liveAuth: true }));
vi.mock("../components/PointsProvider", () => ({
  pointLabels: { daily_three: "Three games in a day" },
  usePoints: () => ({
    busy: false,
    error: "",
    refresh: vi.fn(),
    page: {
      balance: 60,
      server_time: "2026-09-26T12:00:00Z",
      policy: { min_elapsed_ms: 15000 },
      tasks: [
        {
          kind: "daily_three",
          group: "daily",
          reward: 20,
          progress: 1,
          target: 3,
          status: "in_progress",
          resets_at: "2026-09-27T00:00:00Z",
        },
      ],
    },
  }),
}));
import Tasks from "./Tasks";
afterEach(() => {
  cleanup();
  mock.user = { id: "ur1" };
});
it("shows progress, UTC reset and automatic reward conditions with a play entry", () => {
  render(
    <MemoryRouter>
      <Tasks />
    </MemoryRouter>,
  );
  expect(screen.getByText("1 / 3 games")).toBeTruthy();
  expect(screen.getByRole("progressbar").getAttribute("value")).toBe("1");
  expect(screen.getByText(/Resets in/).textContent).toContain("UTC");
  expect(
    screen
      .getByRole("link", { name: "Find a campaign →" })
      .getAttribute("href"),
  ).toBe("/");
  expect(screen.queryByRole("button", { name: /claim/i })).toBeNull();
});
it("asks guests to sign in rather than exposing task progress", () => {
  mock.user = null;
  render(
    <MemoryRouter>
      <Tasks />
    </MemoryRouter>,
  );
  expect(screen.getByRole("button", { name: "Sign in" })).toBeTruthy();
  expect(screen.queryByRole("progressbar")).toBeNull();
});
