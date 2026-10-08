import { describe, expect, it } from "vitest";
import { analyticsPagePath } from "./firebaseAnalytics";

describe("analyticsPagePath", () => {
  it("removes invitation and user identifiers", () => {
    expect(analyticsPagePath("/invite/private-token")).toBe("/invite/:token");
    expect(analyticsPagePath("/ref/user-123")).toBe("/ref/:userId");
    expect(analyticsPagePath("/players/user-123")).toBe("/players/:userId");
    expect(analyticsPagePath("/posts/post-123")).toBe("/posts/:postId");
  });

  it("removes session and result identifiers", () => {
    expect(analyticsPagePath("/campaign/phood/session/secret-session")).toBe("/campaign/:id/session/:sessionId");
    expect(analyticsPagePath("/campaign/phood/result/run-123")).toBe("/campaign/:id/result/:runId");
    expect(analyticsPagePath("/entry/telegram/private-target")).toBe("/entry/:channel/:to");
  });

  it("keeps ordinary navigation paths", () => {
    expect(analyticsPagePath("/")).toBe("/");
    expect(analyticsPagePath("/teams")).toBe("/teams");
    expect(analyticsPagePath("/campaign/phood/teams")).toBe("/campaign/:id/teams");
    expect(analyticsPagePath("/unknown/private-value")).toBe("/other");
  });
});
