import { campaigns, teams } from "../data";
import { validId } from "./entry";
export type Team = (typeof teams)[number];
export type CaptainTeam = Team & {
  campaignId: string;
  ownerId: string;
  description: string;
  created: number;
};
export function teamCatalog(custom: CaptainTeam[], campaignId: string): Team[] {
  return [...teams, ...custom.filter((t) => t.campaignId === campaignId)];
}
export function createCaptainTeam(args: {
  custom: CaptainTeam[];
  campaignId: string;
  ownerId: string;
  eligible: boolean;
  membership?: string;
  deadline: number;
  name: string;
  description: string;
  id: string;
  now?: number;
}): CaptainTeam {
  const now = args.now ?? Date.now();
  if (!args.eligible || !validId(args.ownerId))
    throw new Error("Approved demo KOL verification is required.");
  if (!campaigns.some((c) => c.id === args.campaignId))
    throw new Error("Choose an available campaign.");
  if (
    args.custom.some(
      (t) => t.campaignId === args.campaignId && t.ownerId === args.ownerId,
    )
  )
    throw new Error("You already lead a team in this campaign.");
  if (args.membership)
    throw new Error(
      "You already joined a team here. Team creation cannot bypass the no-switch rule.",
    );
  if (!Number.isFinite(args.deadline) || now >= args.deadline)
    throw new Error("Team creation is closed for this campaign.");
  const name = args.name.trim();
  const description = args.description.trim();
  if (name.length < 3 || name.length > 32)
    throw new Error("Team name must be 3–32 characters.");
  if (description.length < 20 || description.length > 300)
    throw new Error("Team introduction must be 20–300 characters.");
  if (
    teamCatalog(args.custom, args.campaignId).some(
      (t) => t.name.toLowerCase() === name.toLowerCase(),
    )
  )
    throw new Error("This team name is already used in the campaign.");
  if (
    !validId(args.id) ||
    teams.some((t) => t.id === args.id) ||
    args.custom.some((t) => t.id === args.id)
  )
    throw new Error("Invalid or duplicate team ID.");
  return {
    id: args.id,
    campaignId: args.campaignId,
    ownerId: args.ownerId,
    name,
    description,
    created: now,
    initial: [...name][0].toUpperCase(),
    handle: "Captain-led · local demo",
    color: "#8ed9ff",
    players: 0,
    score: 0,
    referrals: 0,
    change: 0,
  };
}
export function restoreCaptainTeams(value: unknown): CaptainTeam[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (t) =>
        t &&
        validId(t.id) &&
        validId(t.ownerId) &&
        campaigns.some((c) => c.id === t.campaignId) &&
        typeof t.name === "string" &&
        t.name.length <= 32 &&
        typeof t.description === "string" &&
        t.description.length <= 300 &&
        typeof t.initial === "string" &&
        typeof t.handle === "string" &&
        /^#[a-fA-F0-9]{6}$/.test(t.color) &&
        Number.isFinite(t.created),
    )
    .filter((t, i, all) => all.findIndex((other) => other.id === t.id) === i);
}
