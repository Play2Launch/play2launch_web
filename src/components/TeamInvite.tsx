import { playerConfig } from "../lib/playerConfig";
import { useEffect, useState } from "react";
import { UserRoundPlus } from "lucide-react";
import { api } from "../lib/api";
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
  const [token, setToken] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!referrer) return;
    const ctrl = new AbortController();
    setToken("");
    setNotice("");
    api
      .authenticated<{ token: string }>(
        `/campaigns/${encodeURIComponent(slug)}/teams/${encodeURIComponent(team)}/invitation`,
        {},
        ctrl.signal,
      )
      .then((v) => {
        if (!ctrl.signal.aborted) setToken(v.token);
      })
      .catch((e) => {
        if (!ctrl.signal.aborted) setNotice(e.message);
      });
    return () => ctrl.abort();
  }, [slug, team, referrer, retry]);
  const links = shareLinks(
    window.location.origin,
    {
      campaignId: slug,
      teamId: team,
      referrerId: referrer,
      inviteToken: token,
      source: "share",
      target: "teams",
    },
    {
      bot: playerConfig.telegram_bot_username,
      app: playerConfig.telegram_app_name,
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
  if (!referrer) return null;
  if (!token)
    return (
      <section className="team-invite-card">
        <p role="status">{notice || "Loading your invitation…"}</p>
        {notice && (
          <button
            className="btn btn-secondary"
            onClick={() => setRetry((n) => n + 1)}
          >
            Retry invitation
          </button>
        )}
      </section>
    );
  return (
    <section className="team-invite-card" aria-label="Team invitation">
      <div className="team-invite-heading">
        <span className="team-invite-icon"><UserRoundPlus size={20} aria-hidden="true" /></span>
        <div>
          <h3>Invite to team</h3>
          <p>Share a joining invitation for {name}.</p>
        </div>
      </div>
      <div className="team-invite-link-group">
        <label className="team-invite-field" htmlFor="web-team-invitation">Web invitation</label>
        <div className="team-invite-link-row">
          <input id="web-team-invitation" aria-label="Web team invitation" readOnly value={links.web} onFocus={(e) => e.target.select()} />
          <button type="button" className="btn btn-primary" onClick={() => void copy(links.web)}>Copy link</button>
        </div>
      </div>
      {links.telegram ? (
        <div className="team-invite-link-group">
          <label className="team-invite-field" htmlFor="mini-app-team-invitation">Telegram Mini App invitation</label>
          <div className="team-invite-link-row">
            <input id="mini-app-team-invitation" aria-label="Mini App team invitation" readOnly value={links.telegram} onFocus={(e) => e.target.select()} />
            <button type="button" className="btn btn-secondary" onClick={() => void copy(links.telegram!)}>Copy link</button>
          </div>
        </div>
      ) : null}
      <p className="team-invite-note">Players confirm joining after signing in. Existing players are not new referrals. This link stops working if you leave or switch teams.</p>
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}
