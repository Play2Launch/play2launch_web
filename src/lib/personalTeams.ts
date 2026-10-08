import { api } from "./api";

export type PersonalTeam = {
  slug: string;
  team_id: string;
  team_name: string;
  campaign_name: string;
  initial: string;
  color: string;
  players: number;
  join_deadline_at: string;
  viewer_team_id?: string;
};

const validTeam = (team: PersonalTeam) =>
  team && /^[a-z0-9][a-z0-9-]{0,63}$/.test(team.slug) &&
  /^tm[0-9a-z]{1,13}$/.test(team.team_id) &&
  typeof team.team_name === "string" && typeof team.campaign_name === "string" &&
  typeof team.initial === "string" && /^#[0-9a-fA-F]{6}$/.test(team.color) &&
  Number.isSafeInteger(team.players) && team.players >= 0 &&
  Number.isFinite(Date.parse(team.join_deadline_at)) &&
  (team.viewer_team_id === undefined || /^tm[0-9a-z]{1,13}$/.test(team.viewer_team_id));

export async function personalTeams(referrer: string, signedIn: boolean, signal?: AbortSignal) {
  const path = `/referrals/${encodeURIComponent(referrer)}/teams${signedIn ? "/me" : ""}`;
  const page = signedIn
    ? await api.authenticated<{items: PersonalTeam[]}>(path, undefined, signal)
    : await api.request<{items: PersonalTeam[]}>(path, undefined, {signal});
  if (!page || !Array.isArray(page.items) || !page.items.every(validTeam)) throw new Error("Invalid invitation teams response.");
  return page.items;
}

export async function autoJoinPersonalTeams(referrer: string, visitID: string) {
  const result = await api.authenticated<{eligible:boolean;joined:number;skipped:number}>(
    `/referrals/${encodeURIComponent(referrer)}/teams/auto-join`, {visit_id:visitID});
  if (!result || typeof result.eligible !== "boolean" || !Number.isSafeInteger(result.joined) || !Number.isSafeInteger(result.skipped)) throw new Error("Invalid auto-join response.");
  return result;
}

export async function joinPersonalTeam(referrer: string, team: PersonalTeam, visitID: string) {
  const result = await api.authenticated<{id:string;team_id:string;joined_at:string}>(
    `/referrals/${encodeURIComponent(referrer)}/teams/${encodeURIComponent(team.slug)}/${encodeURIComponent(team.team_id)}/join`,
    {visit_id:visitID});
  if (!result || result.team_id !== team.team_id || typeof result.id !== "string") throw new Error("Invalid team join response.");
  return result;
}
