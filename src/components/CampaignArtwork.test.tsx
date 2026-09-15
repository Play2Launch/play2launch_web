// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CampaignArtwork, safeImageSource } from "./CampaignArtwork";
import { campaigns } from "../data";
afterEach(cleanup);
it("uses configured images for any slug and falls back after failure", () => {
  const c = {
    ...campaigns[0],
    id: "different",
    hero_image: "/images/custom.png",
    cover_image: "/images/cover.png",
    image_alt: "Custom artwork",
  };
  const view = render(<CampaignArtwork campaign={c} variant="hero" />);
  expect(screen.getByRole("img").getAttribute("src")).toBe(
    "/images/custom.png",
  );
  fireEvent.error(screen.getByRole("img"));
  expect(screen.getByRole("img").getAttribute("src")).toBeNull();
  view.rerender(
    <CampaignArtwork
      campaign={{ ...c, hero_image: "/images/replacement.png" }}
      variant="hero"
    />,
  );
  expect(screen.getByRole("img").getAttribute("src")).toBe(
    "/images/replacement.png",
  );
  view.rerender(<CampaignArtwork campaign={c} variant="cover" />);
  expect(screen.getByRole("img").getAttribute("src")).toBe("/images/cover.png");
});
it("rejects unsafe sources and renders the same missing image placeholder", () => {
  for (const url of [
    "javascript:alert(1)",
    "data:image/svg+xml,bad",
    "//remote.test/x",
    "/\\remote.test/x",
    "https://user:pass@remote.test/x",
    "http://remote.test/x",
  ])
    expect(safeImageSource(url)).toBeUndefined();
  expect(safeImageSource("/images/test.png")).toBe("/images/test.png");
  expect(safeImageSource("https://cdn.example.test/a.png")).toBe(
    "https://cdn.example.test/a.png",
  );
  render(
    <CampaignArtwork
      campaign={{ ...campaigns[0], hero_image: "", cover_image: "" }}
      variant="hero"
    />,
  );
  expect(screen.getByRole("img").getAttribute("src")).toBeNull();
});
