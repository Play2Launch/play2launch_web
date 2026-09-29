import { api } from "./api";
export type ServerTeam = {
	team_type?: string;
	activity?: {active_today:number;rounds_today:number;as_of:string};
  join_mode?: "public" | "invite_only";
  invites_paused?: boolean;
  version?: number;
  referrals?: number;
  status?: "active" | "paused";
  owner_id?: string;
  id: string;
  name: string;
  handle: string;
  initial: string;
  color: string;
  description: string;
  players: number;
};
export type Membership = { id: string; team_id: string; joined_at: string };
export type MyTeam = {
  role?: "captain" | "member";
  activity_status?: "active" | "upcoming" | "ended";
  scoring_ends_at?: string;
  campaign_id: string;
  slug: string;
  name: string;
  team_name: string;
  membership: Membership;
};
function validTeam(t: ServerTeam) {
  return (
    t &&
    /^tm[0-9a-z]{1,13}$/.test(t.id) &&
    [t.name, t.handle, t.initial, t.description].every(
      (v) => typeof v === "string",
    ) &&
    /^#[0-9a-fA-F]{6}$/.test(t.color) &&
    Number.isSafeInteger(t.players) &&
    t.players >= 0
  );
}
function validMembership(m: Membership) {
  return (
    m &&
    /^mb[0-9a-z]{1,13}$/.test(m.id) &&
    /^tm[0-9a-z]{1,13}$/.test(m.team_id) &&
    Number.isFinite(Date.parse(m.joined_at))
  );
}
const invalid = () => new Error("Invalid team response. Please retry.");
export async function listTeams(slug: string, signal?: AbortSignal) {
  const d = await api.request<{ items: ServerTeam[] }>(
    `/campaigns/${encodeURIComponent(slug)}/teams`,
    undefined,
    { signal },
  );
  if (!d || !Array.isArray(d.items) || !d.items.every(validTeam))
    throw invalid();
  return d.items;
}
export async function myMembership(slug: string, signal?: AbortSignal) {
  const d = await api.authenticated<{ membership: Membership | null }>(
    `/campaigns/${encodeURIComponent(slug)}/membership`,
    undefined,
    signal,
  );
  if (!d || (d.membership !== null && !validMembership(d.membership)))
    throw invalid();
  return d.membership;
}
export async function joinTeam(
  slug: string,
  team: string,
  signal?: AbortSignal,
  referrerId?: string,
  inviteToken?: string,
) {
  const d = await api.authenticated<Membership>(
    `/campaigns/${encodeURIComponent(slug)}/teams/${encodeURIComponent(team)}/join`,
    inviteToken
      ? { invite_token: inviteToken }
      : referrerId
        ? { referrer_id: referrerId }
        : {},
    signal,
  );
  if (!validMembership(d) || d.team_id !== team) throw invalid();
  return d;
}
export type MembershipFilters = {
  q: string;
  status: "active" | "ended" | "all";
  role: "all" | "captain";
};
export async function memberships(
  after: string,
  signal?: AbortSignal,
  filters?: MembershipFilters,
) {
  const params = new URLSearchParams(filters || {});
  if (after) params.set("after", after);
  const d = await api.authenticated<{ items: MyTeam[]; next_cursor: string }>(
    `/user/memberships${params.size ? `?${params}` : ""}`,
    undefined,
    signal,
  );
  if (
    !d ||
    !Array.isArray(d.items) ||
    !d.items.every(
      (m) =>
        m &&
        /^cp[0-9a-z]{1,13}$/.test(m.campaign_id) &&
        /^[a-z0-9][a-z0-9-]{0,63}$/.test(m.slug) &&
        typeof m.name === "string" &&
        typeof m.team_name === "string" &&
        validMembership(m.membership),
    ) ||
    typeof d.next_cursor !== "string" ||
    (d.next_cursor !== "" && !/^[A-Za-z0-9_-]{1,1024}$/.test(d.next_cursor))
  )
    throw invalid();
  return d;
}
