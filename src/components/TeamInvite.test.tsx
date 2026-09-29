// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { TeamInvite } from "./TeamInvite";
import { api } from "../lib/api";
vi.mock("../lib/api", () => ({ api: { authenticated: vi.fn() } }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it("uses server-issued member credentials and hides guest invitations", async () => {
  const token = "a".repeat(32);
  vi.mocked(api.authenticated).mockResolvedValue({ token });
  const view = render(
    <TeamInvite slug="phood" team="tm1" name="A team" referrer="urmemberb" />,
  );
  const input = await screen.findByRole("textbox", {
    name: "Web team invitation",
  });
  expect(new URL((input as HTMLInputElement).value).pathname).toBe(
    `/invite/${token}`,
  );
  view.rerender(<TeamInvite slug="phood" team="tm1" name="A team" />);
  expect(screen.queryByRole("textbox")).toBeNull();
});
it("never falls back to unprotected links on permission failure", async () => {
  vi.mocked(api.authenticated).mockRejectedValue(new Error("Not a member"));
  render(<TeamInvite slug="phood" team="tm1" name="A team" referrer="ur1" />);
  await screen.findByText("Not a member");
  expect(screen.queryByRole("textbox")).toBeNull();
});
