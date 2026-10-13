// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { PrivacyPage, TermsPage } from "./Legal";

afterEach(cleanup);

it("shows the service terms with an accessible privacy link and support address", () => {
  render(<MemoryRouter><TermsPage /></MemoryRouter>);
  expect(screen.getByRole("heading", { name: "Terms of Service" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Privacy Policy" }).getAttribute("href")).toBe("/privacy");
  expect(screen.getAllByRole("link", { name: "support@play2launch.com" }).length).toBeGreaterThan(0);
});

it("shows the privacy policy and its account-deletion contact", () => {
  render(<MemoryRouter><PrivacyPage /></MemoryRouter>);
  expect(screen.getByRole("heading", { name: "Privacy Policy" })).toBeTruthy();
  expect(screen.getByText(/To request access, correction or deletion/)).toBeTruthy();
  expect(screen.getByRole("link", { name: "Terms of Service" }).getAttribute("href")).toBe("/terms");
});
