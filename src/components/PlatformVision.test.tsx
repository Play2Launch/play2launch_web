// @vitest-environment jsdom
import { expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { PlatformVision } from "./PlatformVision";

it("presents the five stages as an ordered vision, not available feature links", () => {
  render(<PlatformVision />);
  const vision = screen.getByRole("region", { name: "OUR VISION" });
  expect(within(vision).getAllByRole("listitem").map((item) => item.textContent?.slice(2))).toEqual([
    "See what people believe in", "Participate", "Validate it", "Launch it", "Trade it",
  ]);
  expect(within(vision).queryAllByRole("link")).toHaveLength(0);
  expect(within(vision).queryAllByRole("button")).toHaveLength(0);
});
