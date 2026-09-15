import { useApp } from "./state";
export function CompetitionRules({ campaignId }: { campaignId: string }) {
  const app = useApp();
  const deadline = app.local.competition.deadlines[campaignId];
  const divisor = app.campaign(campaignId)?.score_per_unlock_point ?? 100;
  const mine = app.local.competition.players.find(
    (p) => p.campaignId === campaignId && p.userId === app.user?.id,
  );
  return (
    <section className="membership-card section">
      <h3>Your campaign progress</h3>
      <p className="accent">
        {Date.now() >= deadline ? "SCORING CLOSED" : "SCORING OPEN"} ·{" "}
        {mine
          ? `Qualified · Accepted best ${mine.best.toLocaleString()} · Team contribution ${mine.teamId ? mine.best.toLocaleString() : "0 (solo)"}`
          : "Not qualified yet — play and save a valid round."}
      </p>
      <p className="small muted">
        Unlock contribution:{" "}
        {Math.floor((mine?.best ?? 0) / divisor).toLocaleString()} points. Every{" "}
        {divisor} game points in your best score gives 1 unlock point, rounded
        down.
      </p>
      <p className="small muted">
        Scoring closes: <strong>{new Date(deadline).toLocaleString()}</strong>
      </p>
      <details className="competition-details">
        <summary>How scoring & teams work</summary>
        <p>
          Save a completed round with at least one trade before the deadline.
          Only your highest accepted score counts toward unlock contribution;
          lower or equal scores add nothing. Participation count is separate.
        </p>
        <p>
          One permanent team choice per campaign. Team score sums members’ best
          scores. Your existing solo best joins your first team.
        </p>
        <p>
          Scoring closes: <strong>{new Date(deadline).toLocaleString()}</strong>
          . Unlocking does not end scoring. Submissions at or after this time
          are practice only.
        </p>
        <small>
          Device-local simulation. No backend, anti-cheat verification or real
          rewards.
        </small>
      </details>
    </section>
  );
}
