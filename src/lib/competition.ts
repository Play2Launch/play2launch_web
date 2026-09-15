import { campaigns, teams } from "../data";
import { teamCatalog, type CaptainTeam } from "./captain";
export type Competitor = {
  userId: string;
  name: string;
  campaignId: string;
  teamId?: string;
  best: number;
};
export type Submission = {
  id: string;
  campaignId: string;
  score: number;
  trades: number;
  created: number;
};
export type Competition = {
  players: Competitor[];
  submitted: string[];
  deadlines: Record<string, number>;
};
export function initialCompetition(now = Date.now()): Competition {
  return {
    players: [],
    submitted: [],
    deadlines: Object.fromEntries(
      campaigns.map((c) => [c.id, now + 7 * 86400000]),
    ),
  };
}
// Deterministic fictional players. Every baseline team total is derived from members.
export const seedPlayers: Competitor[] = campaigns.flatMap((c) =>
  Array.from({ length: c.players }, (_, i) => ({
    userId: `seed_${c.id}_${i}`,
    name: `player.${String(i + 1).padStart(4, "0")}`,
    campaignId: c.id,
    teamId: teams[i % teams.length].id,
    // Allocate a deterministic demo contribution budget across 100 fictional
    // scorers. Preserve the original visual progress without using headcount
    // as the unlock rule. Everyone else remains a zero-score participant.
    best:
      i < 100
        ? (Math.floor((c.demo_unlock_seed_points ?? 0) / 100) +
            (i < (c.demo_unlock_seed_points ?? 0) % 100 ? 1 : 0)) *
          (c.score_per_unlock_point ?? 100)
        : 0,
  })),
);
export function submitScore(
  state: Competition,
  run: Submission,
  user: { id: string; name: string },
  teamId: string | undefined,
  now = Date.now(),
): Competition {
  if (
    state.submitted.includes(run.id) ||
    !campaigns.some((c) => c.id === run.campaignId) ||
    !Number.isFinite(run.score) ||
    run.score < 0 ||
    !Number.isInteger(run.trades) ||
    run.trades < 1 ||
    !Number.isFinite(run.created) ||
    run.created > now ||
    now >= state.deadlines[run.campaignId] ||
    !Number.isFinite(state.deadlines[run.campaignId])
  )
    return state;
  const previous = state.players.find(
    (p) => p.userId === user.id && p.campaignId === run.campaignId,
  );
  const player = {
    userId: user.id,
    name: user.name,
    campaignId: run.campaignId,
    teamId: previous?.teamId || teamId,
    best: Math.max(previous?.best ?? 0, run.score),
  };
  return {
    ...state,
    submitted: [...state.submitted, run.id],
    players: [...state.players.filter((p) => p !== previous), player],
  };
}
export function competitionSnapshot(
  state: Competition,
  campaignId: string,
  custom: CaptainTeam[] = [],
) {
  const players = [
    ...seedPlayers.filter((p) => p.campaignId === campaignId),
    ...state.players.filter((p) => p.campaignId === campaignId),
  ].sort((a, b) => b.best - a.best || a.userId.localeCompare(b.userId));
  const rankedTeams = teamCatalog(custom, campaignId)
    .map((t) => {
      const members = players.filter((p) => p.teamId === t.id);
      return {
        ...t,
        players: members.length,
        score: members.reduce((sum, p) => sum + p.best, 0),
      };
    })
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const divisor = campaigns.find(
    (c) => c.id === campaignId,
  )?.score_per_unlock_point;
  const unlockPoints =
    divisor && divisor > 0
      ? players.reduce((sum, p) => sum + Math.floor(p.best / divisor), 0)
      : 0;
  return {
    players,
    teams: rankedTeams,
    qualified: players.length,
    unlockPoints,
  };
}
