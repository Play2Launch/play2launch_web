import { useState } from "react";
import { shareLinks } from "../lib/entry";

export function TeamInvite({
  slug,
  team,
  name,
  referrer,
}: {
  slug: string;
  team: string;
  name: string;
  referrer?: string;
}) {
  const [notice, setNotice] = useState("");
  const links = shareLinks(
    window.location.origin,
    {
      campaignId: slug,
      teamId: team,
      referrerId: referrer,
      source: "share",
      target: "teams",
    },
    {
      bot: import.meta.env.VITE_TELEGRAM_BOT_USERNAME,
      app: import.meta.env.VITE_TELEGRAM_APP_NAME,
    },
  );
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice("Invite link copied.");
    } catch {
      setNotice("Select and copy the link manually.");
    }
  }
  return (
    <section className="team-invite-card" aria-label="Team invitation">
      <h3>Invite players to {name}</h3>
      <p>
        Players confirm joining after signing in. Only successful first-time
        joins count; invitations add no unlock points.
      </p>
      <label className="team-invite-field">
        Web invitation
        <input
          aria-label="Web team invitation"
          readOnly
          value={links.web}
          onFocus={(e) => e.target.select()}
        />
      </label>
      <button type="button"
        className="btn btn-secondary"
        onClick={() => void copy(links.web)}
      >
        Copy web invitation
      </button>
      {links.telegram ? (
        <>
          <label className="team-invite-field">
            Telegram Mini App invitation
            <input
              aria-label="Mini App team invitation"
              readOnly
              value={links.telegram}
              onFocus={(e) => e.target.select()}
            />
          </label>
          <button type="button"
            className="btn btn-secondary"
            onClick={() => void copy(links.telegram!)}
          >
            Copy Mini App invitation
          </button>
        </>
      ) : (
        <p className="small muted">
          Mini App invitation becomes available when the Telegram bot is
          configured. Use the web link for now.
        </p>
      )}
      {!referrer && (
        <p className="small muted">
          Sign in to generate your own referral link. This guest link opens
          the team without recording an inviter.
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}
