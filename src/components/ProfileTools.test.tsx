// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  user: { id: "ur1" } as { id: string } | undefined,
}));
vi.mock("../lib/api", () => ({
  liveAuth: true,
  api: { authenticated: mocks.request },
}));
vi.mock("../state", () => ({
  useApp: () => ({ user: mocks.user, kolRequest: { status: "approved" } }),
}));
import { ProfileTools } from "./ProfileTools";
it.each([
  [null, "Become a KOL", "/verification"],
  [{ status: "pending" }, "View application", "/verification"],
  [{ status: "draft" }, "Continue application", "/verification"],
  [{ status: "rejected" }, "Update application", "/verification"],
  [{ status: "revoked" }, "Update application", "/verification"],
  [{ status: "approved" }, "Captain Studio", "/captain"],
] as const)("shows the compact home entry for %j", async (result, label, path) => {
  mocks.request.mockResolvedValue(result);
  render(<MemoryRouter><ProfileTools compact /></MemoryRouter>);
  const link = await screen.findByRole("link", { name: new RegExp(label) });
  expect(link.getAttribute("href")).toBe(path);
  expect(screen.getAllByRole("link")).toHaveLength(1);
});
it("offers guests a compact application entry without requesting private status", () => {
  mocks.user = undefined;
  render(<MemoryRouter><ProfileTools compact /></MemoryRouter>);
  expect(screen.getByRole("link", { name: /Become a KOL/ }).getAttribute("href")).toBe("/verification");
  expect(mocks.request).not.toHaveBeenCalled();
});
afterEach(() => {
  cleanup();
  mocks.request.mockReset();
  mocks.user = { id: "ur1" };
});
it.each([
  null,
  { status: "pending" },
  { status: "rejected" },
  { status: "revoked" },
  { status: "draft" },
])("hides studio unless server approves: %j", async (result) => {
  mocks.request.mockResolvedValue(result);
  render(
    <MemoryRouter>
      <ProfileTools />
    </MemoryRouter>,
  );
  await waitFor(() =>
    expect(screen.queryByText("Checking verification…")).toBeNull(),
  );
  expect(screen.queryByRole("link", { name: /Captain studio/ })).toBeNull();
  expect(screen.getByRole("link", { name: /KOL verification/ })).toBeTruthy();
});
it("shows studio only after approval, removes it after revocation and account change", async () => {
  mocks.request.mockResolvedValue({ status: "approved" });
  const view = render(
    <MemoryRouter>
      <ProfileTools />
    </MemoryRouter>,
  );
  await screen.findByRole("link", { name: /Captain studio/ });
  mocks.request.mockResolvedValue({ status: "revoked" });
  fireEvent(window, new Event("focus"));
  await screen.findByText("Verification revoked");
  expect(screen.queryByRole("link", { name: /Captain studio/ })).toBeNull();
  mocks.user = undefined;
  view.rerender(
    <MemoryRouter>
      <ProfileTools />
    </MemoryRouter>,
  );
  expect(screen.getByText("Sign in to start verification")).toBeTruthy();
});
it("fails closed and allows retry", async () => {
  mocks.request.mockRejectedValue(new Error("offline"));
  render(
    <MemoryRouter>
      <ProfileTools />
    </MemoryRouter>,
  );
  await screen.findByRole("alert");
  expect(screen.queryByRole("link", { name: /Captain studio/ })).toBeNull();
  mocks.request.mockResolvedValue({ status: "approved" });
  fireEvent.click(
    screen.getByRole("button", { name: "Retry verification status" }),
  );
  await screen.findByRole("link", { name: /Captain studio/ });
});

it("navigates on the first click while focus revalidation is pending", async () => {
  mocks.request.mockResolvedValueOnce({ status: "approved" });
  render(<MemoryRouter initialEntries={["/profile"]}><Routes>
    <Route path="/profile" element={<ProfileTools />} />
    <Route path="/captain" element={<h1>Create your campaign team</h1>} />
  </Routes></MemoryRouter>);
  const link = await screen.findByRole("link", { name: /Captain studio/ });
  mocks.request.mockImplementationOnce(() => new Promise(() => {}));
  fireEvent.pointerDown(link);
  fireEvent(window, new Event("focus"));
  expect(screen.getByRole("link", { name: /Captain studio/ })).toBe(link);
  expect(link.isConnected).toBe(true);
  fireEvent.click(link);
  await screen.findByRole("heading", { name: "Create your campaign team" });
});
