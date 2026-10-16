import { formatTicker } from "../lib/ticker";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Users } from "lucide-react";
import { listCampaigns, type PublicCampaign } from "../lib/catalog";
import { stageLabel } from "../data";

export function ExploreTeams() {
  const [query, setQuery] = useState("");
  const [after, setAfter] = useState("");
  const [items, setItems] = useState<PublicCampaign[]>([]);
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    setBusy(true);
    setError("");
    const timer = setTimeout(() => {
      listCampaigns(after, ctrl.signal, query.trim())
        .then((page) => {
          if (ctrl.signal.aborted) return;
          setItems((old) => after
            ? [...old, ...page.items.filter((item) => !old.some((existing) => existing.id === item.id))]
            : page.items);
          setNext(page.next_cursor);
        })
        .catch((cause) => {
          if (!ctrl.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not load campaigns.");
        })
        .finally(() => { if (!ctrl.signal.aborted) setBusy(false); });
    }, query ? 250 : 0);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [query, after, retry]);

  return (
    <section className="teams-explore" aria-label="Explore teams by campaign">
      <p className="muted">Choose a campaign to browse its teams, captains and members.</p>
      <label className="search-field">
        <Search size={16} />
        <input
          type="search"
          aria-label="Search campaigns for teams"
          placeholder="Find a campaign"
          maxLength={80}
          value={query}
          onChange={(event) => { setQuery(event.target.value); setAfter(""); setItems([]); setNext(""); setBusy(true); }}
        />
      </label>
      {error && <div className="notice" role="alert">{error}<button onClick={() => setRetry((value) => value + 1)}>Retry</button></div>}
      {busy && <p role="status">Loading campaigns…</p>}
      {!busy && !error && !items.length && <div className="empty-panel"><Users size={28} /><h2>No campaigns found</h2><p>Try another name or browse Discover.</p><Link to="/">Discover campaigns</Link></div>}
      <div className="teams-explore-list">
        {items.map((campaign) => (
          <article className="membership-card teams-explore-card" key={campaign.id}>
            <div>
              <span className="eyebrow">{stageLabel(campaign.stage)} · {formatTicker(campaign.ticker)}</span>
              <h2>{campaign.name}</h2>
              <p className="muted">{campaign.description}</p>
              {campaign.availability?.join_open === false && <span className="small muted">Joining currently closed · Teams can still be viewed</span>}
            </div>
            <Link className="btn btn-secondary" to={`/campaign/${encodeURIComponent(campaign.slug)}/teams`}>View teams</Link>
          </article>
        ))}
      </div>
      {next && !error && <button className="btn btn-secondary" disabled={busy} onClick={() => setAfter(next)}>Load more campaigns</button>}
    </section>
  );
}
