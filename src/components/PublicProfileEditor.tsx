import { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";
import { useApp } from "../state";
import { Modal } from "../App";
import { ArrowRight, AtSign } from "lucide-react";
import { createPortal } from "react-dom";
type Profile = { id: string; nickname: string; avatar_url: string; handle?: string; handle_changes_remaining?: number };
export function PublicProfileEditor({ userId }: { userId: string }) {
  const app = useApp();
  const [profile, setProfile] = useState<Profile>();
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [avatar, setAvatar] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const [confirmRename, setConfirmRename] = useState(false);
  function valid(p: Profile) {
    return (
      p &&
      p.id === userId &&
      typeof p.nickname === "string" &&
      !p.nickname.includes("@") &&
      typeof p.avatar_url === "string"
    );
  }
  useEffect(() => {
    const ctrl = new AbortController();
    api
      .authenticated<Profile>("/user/profile", undefined, ctrl.signal)
      .then((p) => {
        if (ctrl.signal.aborted) return;
        if (!valid(p)) throw new Error("Invalid public profile");
        setProfile(p);
        setName(p.nickname);
        setHandle(p.handle ?? "");
        setAvatar(p.avatar_url);
        setError("");
        app.updatePublicName(userId, p.nickname, p.handle ?? "");
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setError("Could not load public profile.");
      });
    return () => ctrl.abort();
  }, [userId, retry]);
  async function save(confirmed = false) {
    if (busy) return;
    const nextHandle = handle.trim().toLowerCase();
    if (profile?.handle && nextHandle !== profile.handle && !confirmed) {
      setConfirmRename(true);
      return;
    }
    setConfirmRename(false);
    setBusy(true);
    setSaved(false);
    setError("");
    try {
      const p = await api.authenticated<Profile>("/user/profile", {
        nickname: name.trim(),
        avatar_url: avatar.trim(),
        ...(nextHandle !== (profile?.handle ?? "") ? { handle: nextHandle } : {}),
      });
      if (!valid(p)) throw new Error();
      setProfile(p);
      setHandle(p.handle ?? "");
      app.updatePublicName(userId, p.nickname, p.handle ?? "");
      setSaved(true);
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "Could not save. Use a 2–60 character display name without an email address, and an HTTPS image URL.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="public-profile-editor">
      <h3>Public profile</h3>
      <p>
        Your display name, @username and avatar are public. Display names can be shared by multiple players. Never include
        your email or private information. KOL verification details are managed
        separately.
      </p>
      {!profile ? (
        <>
          {!error && <p role="status">Loading public profile…</p>}
          {error && (
            <button
              className="text-link"
              onClick={() => setRetry((n) => n + 1)}
            >
              Retry public profile
            </button>
          )}
        </>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <fieldset disabled={busy}>
            <label>
              Display name
              <input
                required
                minLength={2}
                maxLength={60}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setSaved(false);
                }}
              />
            </label>
            <label>
              Unique username (@username)
              <input aria-label="Unique username" value={handle} placeholder="your_username (optional)"
                minLength={3} maxLength={24} pattern="[A-Za-z][A-Za-z0-9_]{2,23}" autoCapitalize="none" autoCorrect="off" spellCheck={false}
                disabled={!!profile.handle && profile.handle_changes_remaining === 0}
                required={!!profile.handle}
                onChange={e=>{setHandle(e.target.value.toLowerCase());setSaved(false);}} />
            </label>
            <small>3–24 letters, digits or underscores; start with a letter. Usernames are unique and case-insensitive.
              {profile.handle ? ` ${profile.handle_changes_remaining ?? 1} username change remaining. Old usernames stay reserved.` : " First setup is optional; you can change it once afterward."}
              {" "}This does not change your sign-in email or Telegram username.
            </small>
            <label>
              Avatar image URL
              <input
                type="url"
                placeholder="https://… (optional)"
                maxLength={2048}
                value={avatar}
                onChange={(e) => {
                  setAvatar(e.target.value);
                  setSaved(false);
                }}
              />
            </label>
            <small>
              Use a public HTTPS image URL. Leave blank for the default avatar.
            </small>
            <button className="btn btn-primary" type="submit">
              {busy ? "Saving…" : "Save public profile"}
            </button>
          </fieldset>
        </form>
      )}
      {error && <p role="alert">{error}</p>}
      {confirmRename && createPortal(
        <Modal title="Change your username?" close={() => setConfirmRename(false)}>
          <div className="modal-emblem"><AtSign size={30} /></div>
          <div className="username-change-preview">
            <span>@{profile?.handle}</span><ArrowRight size={18} aria-hidden="true" />
            <strong>@{handle.trim().toLowerCase()}</strong>
          </div>
          <p className="modal-copy">This is your one username change. After saving, you won’t be able to change it again. Your old username will stay reserved and cannot be claimed by another player.</p>
          <p className="modal-copy">Your account, teams and scores stay unchanged. Your display name can still be edited.</p>
          <div className="username-change-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setConfirmRename(false)}>Keep editing</button>
            <button type="button" className="btn btn-primary" onClick={() => void save(true)}>Confirm username change</button>
          </div>
        </Modal>, document.body
      )}
      {saved && (
        <p role="status">
          Public profile saved. Rankings update on their next refresh.
        </p>
      )}
    </section>
  );
}
