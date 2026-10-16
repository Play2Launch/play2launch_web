import { formatTicker } from "../lib/ticker";
import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { listCampaigns, type PublicCampaign } from "../lib/catalog";
import { stageLabel } from "../data";
export type CaptainCampaign = PublicCampaign & {
  my_team_id?: string;
  join_deadline_at?: string;
};
export function CampaignChoice({ campaign }: { campaign: CaptainCampaign }) {
  const [failed, setFailed] = useState(false);
  const src = campaign.cover_image || campaign.hero_image;
  return (
    <>
      <span
        className="campaign-choice-art"
        style={{ background: campaign.color }}
      >
        {src && !failed ? (
          <img src={src} alt="" onError={() => setFailed(true)} />
        ) : (
          campaign.symbol
        )}
      </span>
      <span className="campaign-choice-text">
        <strong>{campaign.name}</strong>
        <small>
          {stageLabel(campaign.stage)} · {formatTicker(campaign.ticker)}
        </small>
        <small>
          {campaign.join_deadline_at
            ? `Join by ${new Date(campaign.join_deadline_at).toLocaleString()}`
            : "Joining schedule not set"}
        </small>
      </span>
    </>
  );
}
export function CampaignPicker({
  choose,
  close,
  purpose = "captain",
}: {
  choose: (c: CaptainCampaign) => void;
  close: () => void;
  purpose?: "captain" | "leaderboard";
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState(""),
    [mode, setMode] = useState("available"),
    [after, setAfter] = useState(""),
    [next, setNext] = useState("");
  const [rows, setRows] = useState<CaptainCampaign[]>([]),
    [busy, setBusy] = useState(true),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    return () => {
      dialog.current?.close();
      previous?.focus();
    };
  }, []);
  useEffect(() => {
    const ctrl = new AbortController();
    setBusy(true);
    setError("");
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ q: query, mode, after });
      (purpose === "leaderboard"
        ? listCampaigns(after, ctrl.signal, query)
        : api.authenticated<{ items: CaptainCampaign[]; next_cursor: string }>(
            `/captain/campaigns?${params}`,
            undefined,
            ctrl.signal,
          )
      )
        .then((p) => {
          if (ctrl.signal.aborted) return;
          setRows((old) =>
            after
              ? [
                  ...old,
                  ...p.items.filter((c) => !old.some((o) => o.id === c.id)),
                ]
              : p.items,
          );
          setNext(p.next_cursor);
        })
        .catch((e) => {
          if (!ctrl.signal.aborted) setError(e.message);
        })
        .finally(() => {
          if (!ctrl.signal.aborted) setBusy(false);
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query, mode, after, retry, purpose]);
  function reset() {
    setAfter("");
    setNext("");
    setRows([]);
    setBusy(true);
  }
  return (
    <dialog
      ref={dialog}
      className="campaign-picker"
      aria-labelledby="campaign-picker-title"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
    >
      <header>
        <h2 id="campaign-picker-title">Choose a campaign</h2>
        <button
          className="btn btn-secondary"
          onClick={close}
          aria-label="Close campaign picker"
        >
          Close
        </button>
      </header>
      <label className="campaign-picker-search">
        Search campaigns
        <input
          autoFocus
          type="search"
          placeholder="Name, token or campaign slug"
          maxLength={80}
          value={query}
          onChange={(e) => {
            reset();
            setQuery(e.target.value);
          }}
        />
      </label>
      {purpose === "captain" && (
        <div className="tabs" aria-label="Campaign filter">
          {[
            ["available", "Open to team creation"],
            ["all", "All campaigns"],
          ].map(([value, label]) => (
            <button
              key={value}
              aria-pressed={mode === value}
              className={mode === value ? "selected" : ""}
              onClick={() => {
                if (mode !== value) {
                  reset();
                  setMode(value);
                }
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <div className="campaign-picker-results" aria-busy={busy}>
        {rows.map((c) => (
          <div key={c.id} className="campaign-picker-row">
            <CampaignChoice campaign={c} />
            <button
              className="btn btn-secondary"
              disabled={
                purpose === "captain" &&
                !c.my_team_id &&
                !c.availability?.join_open
              }
              onClick={() => choose(c)}
            >
              {purpose === "leaderboard"
                ? "View leaderboard"
                : c.my_team_id
                  ? "View my team"
                  : c.availability?.join_open
                    ? "Select"
                    : "Joining closed"}
            </button>
          </div>
        ))}
        {busy && <p role="status">Loading campaigns…</p>}
        {error && (
          <div role="alert">
            {error}
            <button
              className="text-link"
              onClick={() => setRetry((n) => n + 1)}
            >
              Retry
            </button>
          </div>
        )}
        {!busy && !error && !rows.length && (
          <p>
            No matching campaigns. Try another search or view all campaigns.
          </p>
        )}
        {next && !error && (
          <button
            className="btn btn-secondary"
            disabled={busy}
            onClick={() => setAfter(next)}
          >
            Load more campaigns
          </button>
        )}
      </div>
    </dialog>
  );
}
