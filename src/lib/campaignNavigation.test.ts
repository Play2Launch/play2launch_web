import { expect, it } from "vitest";
import { campaignBackPath } from "./campaignNavigation";
it("returns to the actual campaign from subpages and Discover from global pages", () => {
  for (const path of [
    "/",
    "/profile",
    "/tasks",
    "/leaderboard",
    "/teams",
    "/campaign/new-event",
    "/campaign/new-event/",
  ])
    expect(campaignBackPath(path)).toBe("/");
  for (const path of [
    "/campaign/phoodv2/play",
    "/campaign/new-event/teams",
    "/campaign/new-event/session/gs1",
  ])
    expect(campaignBackPath(path)).toBe(
      path.startsWith("/campaign/phoodv2")
        ? "/campaign/phoodv2"
        : "/campaign/new-event",
    );
});
