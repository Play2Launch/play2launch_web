import { expect, it } from "vitest";
import { encodeStart, decodeStart, resolveEntry, shareLinks } from "./entry";
it("uses a short opaque Telegram credential and routes it through resolution", () => {
  const token = "A_".repeat(16);
  const entry = {
    inviteToken: token,
    source: "share",
    target: "teams" as const,
  };
  const start = encodeStart(entry);
  expect(start.length).toBeLessThanOrEqual(64);
  expect(decodeStart(start).inviteToken).toBe(token);
  expect(
    resolveEntry(new URL(`https://p2l.test/?startapp=${start}`), "telegram")
      .destination,
  ).toBe(`/invite/${token}`);
  const links = shareLinks("https://p2l.test", entry, { bot: "p2l_bot" });
  expect(new URL(links.web).pathname).toBe(`/invite/${token}`);
  expect(links.telegram).toContain(start);
});
it("retains invitations through navigation and clears them on explicit direct browsing", () => {
  const token = "a".repeat(32);
  const initial = resolveEntry(
    new URL(
      `https://p2l.test/campaign/test/teams?team=tm1&invite=${token}&src=share`,
    ),
    "web",
  ).context;
  expect(
    resolveEntry(new URL("https://p2l.test/profile"), "web", initial).context
      .inviteToken,
  ).toBe(token);
  expect(
    resolveEntry(
      new URL("https://p2l.test/campaign/test/teams?src=direct"),
      "web",
      initial,
    ).context.inviteToken,
  ).toBeUndefined();
});
