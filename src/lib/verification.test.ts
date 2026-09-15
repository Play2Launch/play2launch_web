import { expect, it } from "vitest";
import {
  applyForKol,
  reviewKol,
  kolPermissions,
  validateApplication,
} from "./verification";
const input = {
  displayName: "Demo captain",
  socialUrl: "https://x.com/demo_captain",
  introduction: "A local test community that enjoys multiplayer games.",
};
it("requires pending review and keeps publishing permissions separate", () => {
  const request = applyForKol(undefined, "one", input, 100);
  expect(kolPermissions(request, "one", true).canCreateTeam).toBe(false);
  expect(() => applyForKol(request, "one", input)).toThrow();
  const approved = reviewKol(request, "approved", "", 200);
  expect(kolPermissions(approved, "one", true)).toEqual({
    canCreateTeam: true,
    canPublishCampaign: false,
  });
  expect(kolPermissions(approved, "two", true).canCreateTeam).toBe(false);
  expect(kolPermissions(approved, "one", false).canCreateTeam).toBe(false);
  expect(kolPermissions(approved, undefined, true).canCreateTeam).toBe(false);
});
it("records rejection and revocation reasons and supports reapplication", () => {
  const pending = applyForKol(undefined, "one", input, 100);
  expect(() => reviewKol(pending, "rejected", "")).toThrow();
  expect(() => reviewKol(pending, "revoked", "Test reason")).toThrow();
  const rejected = reviewKol(
    pending,
    "rejected",
    "Please clarify your community",
    200,
  );
  const resubmitted = applyForKol(rejected, "one", input, 300);
  const approved = reviewKol(resubmitted, "approved", "", 400);
  const revoked = reviewKol(
    approved,
    "revoked",
    "Account ownership needs rechecking",
    500,
  );
  expect(kolPermissions(revoked, "one", true).canCreateTeam).toBe(false);
  expect(revoked.history.map((h) => h.status)).toEqual([
    "pending",
    "rejected",
    "pending",
    "approved",
    "revoked",
  ]);
  expect(() => reviewKol(revoked, "approved", "")).toThrow();
});
it("validates public profile inputs without attempting account verification", () => {
  for (const socialUrl of [
    "javascript:alert(1)",
    "https://x.com.evil.test/test",
    "http://x.com/test",
    "https://x.com/test?secret=abc",
    "https://user:password@x.com/test",
  ])
    expect(validateApplication({ ...input, socialUrl })).not.toBe("");
  expect(validateApplication({ ...input, introduction: "short" })).not.toBe("");
  expect(validateApplication(input)).toBe("");
});
