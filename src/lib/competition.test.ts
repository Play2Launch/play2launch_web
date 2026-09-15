import { expect, it } from "vitest";
import {
  initialCompetition,
  submitScore,
  competitionSnapshot,
} from "./competition";
const user = { id: "demo_one", name: "Demo" };
const run = {
  id: "r1",
  campaignId: "phood",
  score: 100,
  trades: 1,
  created: 1000,
};
it("converts each campaign best score to unlock points without counting repeat rounds", () => {
  let state = initialCompetition(1000);
  expect(competitionSnapshot(state, "phood").unlockPoints).toBe(8214);
  const other = competitionSnapshot(state, "topfrog").unlockPoints;
  for (const [index, score, contribution] of [
    [0, 15000, 150],
    [1, 12000, 150],
    [2, 15099, 150],
    [3, 15100, 151],
    [4, 18000, 180],
  ]) {
    const submission = { ...run, id: `unlock-${index}`, score };
    state = submitScore(state, submission, user, "alice", 1001);
    expect(competitionSnapshot(state, "phood").unlockPoints).toBe(
      8214 + contribution,
    );
    expect(competitionSnapshot(state, "phood").qualified).toBe(8215);
    expect(competitionSnapshot(state, "topfrog").unlockPoints).toBe(other);
    expect(submitScore(state, submission, user, "alice", 1002)).toBe(state);
  }
});
it("deduplicates players and submissions and takes max not sum", () => {
  const state = initialCompetition(1000);
  const first = submitScore(state, run, user, "alice", 1001);
  expect(submitScore(first, run, user, "alice", 1002)).toBe(first);
  const lower = submitScore(
    first,
    { ...run, id: "r2", score: 50 },
    user,
    "alice",
    1002,
  );
  const higher = submitScore(
    lower,
    { ...run, id: "r3", score: 300 },
    user,
    "alice",
    1003,
  );
  expect(higher.players).toHaveLength(1);
  expect(higher.players[0].best).toBe(300);
  const before = competitionSnapshot(state, "phood");
  const after = competitionSnapshot(higher, "phood");
  expect(after.qualified).toBe(before.qualified + 1);
  expect(after.teams.find((t) => t.id === "alice")!.score).toBe(
    before.teams.find((t) => t.id === "alice")!.score + 300,
  );
});
it("isolates campaign identities and team contributions", () => {
  const first = submitScore(initialCompetition(1000), run, user, "alice", 1001);
  const next = submitScore(
    first,
    { ...run, id: "other", campaignId: "topfrog" },
    user,
    "bob",
    1002,
  );
  expect(next.players.map((p) => p.teamId)).toEqual(["alice", "bob"]);
  expect(
    submitScore(next, { ...run, id: "change" }, user, "bob", 1003).players.find(
      (p) => p.campaignId === "phood",
    )?.teamId,
  ).toBe("alice");
});
it("rejects no-trade, invalid and late rounds including deadline equality", () => {
  const state = initialCompetition(1000);
  for (const bad of [
    { ...run, trades: 0 },
    { ...run, score: NaN },
    { ...run, score: -1 },
  ])
    expect(submitScore(state, bad, user, undefined, 1001)).toBe(state);
  expect(submitScore(state, run, user, undefined, state.deadlines.phood)).toBe(
    state,
  );
  expect(
    submitScore(state, { ...run, score: 0 }, user, undefined, 1001).players,
  ).toHaveLength(1);
});
