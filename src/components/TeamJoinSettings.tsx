import { useRef, useState } from "react";
import { api } from "../lib/api";
import { listTeams, type ServerTeam } from "../lib/teams";
export function TeamJoinSettings({
  slug,
  team,
  onChange,
}: {
  slug: string;
  team: ServerTeam;
  onChange: (teams: ServerTeam[]) => void;
}) {
  const [mode, setMode] = useState(team.join_mode || "public");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [action, setAction] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  function confirm(value: string) {
    setError("");
    setAction(value);
    dialog.current?.showModal();
  }
  async function save() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await api.authenticated(
        `/campaigns/${encodeURIComponent(slug)}/teams/${team.id}/invite-settings`,
        { action, join_mode: mode, expected_version: team.version || 0 },
      );
      onChange(await listTeams(slug));
      dialog.current?.close();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not update team settings.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="team-invite-card">
      <h3>Joining & invitations</h3>
      <p>
        Only current members can invite. Revoking links never changes existing
        members or past referrals.
      </p>
      <label className="team-invite-field">
        Joining policy
        <select
          value={mode}
          disabled={busy}
          onChange={(e) => setMode(e.target.value as typeof mode)}
        >
          <option value="public">Open to everyone</option>
          <option value="invite_only">Invitation only</option>
        </select>
      </label>
      <button
        type="button"
        className="btn btn-secondary"
        disabled={busy || mode === (team.join_mode || "public")}
        onClick={() => confirm("mode")}
      >
        Save joining policy
      </button>
      <p>Invitations: {team.invites_paused ? "Paused" : "Enabled"}</p>
      <button
        type="button"
        className="btn btn-secondary"
        disabled={busy}
        onClick={() => confirm(team.invites_paused ? "resume" : "pause")}
      >
        {team.invites_paused
          ? "Enable new invitations"
          : "Pause & revoke all invitations"}
      </button>
      {!team.invites_paused && (
        <button
          type="button"
          className="btn btn-secondary"
          disabled={busy}
          onClick={() => confirm("rotate")}
        >
          Revoke & regenerate all links
        </button>
      )}
      <dialog
        ref={dialog}
        className="invitation-confirm"
        aria-labelledby="invitation-confirm-title"
        style={{
          maxWidth: 480,
          width: "calc(100% - 32px)",
          padding: 24,
          background: "#151c10",
          color: "#eef4e6",
          border: "1px solid #64783b",
          borderRadius: 16,
        }}
        onCancel={(e) => {
          if (busy) e.preventDefault();
        }}
      >
        <h3 id="invitation-confirm-title">Confirm invitation settings</h3>
        <p>
          {action === "mode"
            ? "Change who can join this team? Existing members remain unchanged."
            : "All previously shared team invitations will permanently stop working. Members will need to copy new links when invitations are enabled."}
        </p>
        {error && <p role="alert">{error}</p>}
        <button
          type="button"
          className="btn btn-secondary"
          disabled={busy}
          onClick={() => dialog.current?.close()}
        >
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy}
          onClick={() => void save()}
        >
          {busy ? "Saving…" : "Confirm"}
        </button>
      </dialog>
    </section>
  );
}
