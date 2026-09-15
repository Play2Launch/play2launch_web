export type VerificationStatus =
  "pending" | "approved" | "rejected" | "revoked";
export type KolApplication = {
  displayName: string;
  socialUrl: string;
  introduction: string;
};
export type KolRequest = KolApplication & {
  userId: string;
  status: VerificationStatus;
  reason: string;
  updated: number;
  history: { status: VerificationStatus; reason: string; at: number }[];
};
export const verificationLabels = {
  pending: "Under review",
  approved: "Approved · demo",
  rejected: "Changes requested",
  revoked: "Verification revoked",
};
export function validateApplication(input: KolApplication): string {
  if (
    input.displayName.trim().length < 2 ||
    input.displayName.trim().length > 60
  )
    return "Use a display name between 2 and 60 characters.";
  try {
    const url = new URL(input.socialUrl.trim());
    if (
      url.protocol !== "https:" ||
      !["x.com", "twitter.com", "t.me"].includes(url.hostname) ||
      !/^\/[a-zA-Z0-9_]{1,32}\/?$/.test(url.pathname) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      return "Enter a public HTTPS profile URL on x.com, twitter.com or t.me (no query parameters).";
  } catch {
    return "Enter a valid public social profile URL.";
  }
  if (
    input.introduction.trim().length < 20 ||
    input.introduction.trim().length > 500
  )
    return "Describe your community in 20–500 characters.";
  return "";
}
export function applyForKol(
  previous: KolRequest | undefined,
  userId: string,
  input: KolApplication,
  now = Date.now(),
): KolRequest {
  const error = validateApplication(input);
  if (error) throw new Error(error);
  if (previous && ["pending", "approved"].includes(previous.status))
    throw new Error(
      "This application cannot be resubmitted in its current state.",
    );
  return {
    displayName: input.displayName.trim(),
    socialUrl: input.socialUrl.trim(),
    introduction: input.introduction.trim(),
    userId,
    status: "pending",
    reason: "",
    updated: now,
    history: [
      ...(previous?.history || []),
      { status: "pending", reason: "Application submitted · demo", at: now },
    ],
  };
}
export function reviewKol(
  request: KolRequest,
  status: "approved" | "rejected" | "revoked",
  reason: string,
  now = Date.now(),
): KolRequest {
  if (
    (status === "revoked" && request.status !== "approved") ||
    (status !== "revoked" && request.status !== "pending")
  )
    throw new Error("Invalid review transition.");
  if (
    status !== "approved" &&
    (reason.trim().length < 5 || reason.trim().length > 300)
  )
    throw new Error("Provide a review reason between 5 and 300 characters.");
  const note =
    status === "approved"
      ? "Approved in local review simulation"
      : reason.trim();
  return {
    ...request,
    status,
    reason: note,
    updated: now,
    history: [...request.history, { status, reason: note, at: now }],
  };
}
export function kolPermissions(
  request: KolRequest | undefined,
  userId: string | undefined,
  demoMode: boolean,
) {
  return {
    canCreateTeam: Boolean(
      demoMode &&
      userId &&
      request?.userId === userId &&
      request.status === "approved",
    ),
    canPublishCampaign: false as const,
  };
}
