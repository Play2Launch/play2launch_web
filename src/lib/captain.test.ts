import { expect, it } from "vitest";
import { createCaptainTeam, restoreCaptainTeams, teamCatalog } from "./captain";
import {
  competitionSnapshot,
  initialCompetition,
  submitScore,
} from "./competition";
const args = {
  custom: [],
  campaignId: "phood",
  ownerId: "captain_one",
  eligible: true,
  deadline: 2000,
  name: "Paper pioneers",
  description: "A test crew learning to trade badly together.",
  id: "team_one",
  now: 1000,
};
it("enforces certification, one team per campaign and no-switch rule", () => {
  const team = createCaptainTeam(args);
  expect(() => createCaptainTeam({ ...args, eligible: false })).toThrow(/KOL/);
  expect(() => createCaptainTeam({ ...args, membership: "alice" })).toThrow(
    /no-switch/,
  );
  expect(() =>
    createCaptainTeam({ ...args, custom: [team], id: "team_two" }),
  ).toThrow(/already lead/);
  expect(
    createCaptainTeam({
      ...args,
      custom: [team],
      campaignId: "topfrog",
      id: "team_two",
    }).campaignId,
  ).toBe("topfrog");
  expect(() => createCaptainTeam({ ...args, now: 2000 })).toThrow(/closed/);
});
it("validates names, descriptions, campaign and duplicate ids", () => {
  expect(() => createCaptainTeam({ ...args, name: "Alice Army" })).toThrow(
    /name/,
  );
  expect(() => createCaptainTeam({ ...args, description: "short" })).toThrow();
  expect(() => createCaptainTeam({ ...args, campaignId: "unknown" })).toThrow();
  expect(() => createCaptainTeam({ ...args, id: "alice" })).toThrow();
  expect(restoreCaptainTeams([null, {}])).toEqual([]);
});
it("registers only in its campaign and aggregates accepted recruits without counting creation", () => {
  const team = createCaptainTeam(args);
  expect(teamCatalog([team], "phood")).toHaveLength(5);
  expect(teamCatalog([team], "topfrog")).toHaveLength(4);
  const initial = initialCompetition(1000);
  const before = competitionSnapshot(initial, "phood", [team]);
  expect(before.teams.find((t) => t.id === team.id)?.players).toBe(0);
  const next = submitScore(
    initial,
    {
      id: "round_one",
      campaignId: "phood",
      created: 1001,
      score: 12500,
      trades: 2,
    },
    { id: "recruit_one", name: "Recruit" },
    team.id,
    1002,
  );
  const after = competitionSnapshot(next, "phood", [team]);
  expect(after.qualified).toBe(before.qualified + 1);
  expect(after.teams.find((t) => t.id === team.id)).toMatchObject({
    players: 1,
    score: 12500,
  });
  expect(restoreCaptainTeams([team])[0].ownerId).toBe(args.ownerId);
});
