import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Gamepad2, ArrowLeftRight, Flag, Users } from 'lucide-react';
import { api } from '../lib/api';
import { CampaignPicker, type CaptainCampaign } from './CampaignPicker';
import { TeamPostPicker, type TeamChoice } from './TeamPost';

type Result = { id: string; session_id: string; campaign_id: string; name: string; slug: string; score: number; game_key: string; rules: string; played_at: string };
type Results = { items: Result[]; next_cursor: string };
function valid(p: Results) { return p && Array.isArray(p.items) && typeof p.next_cursor === 'string' && p.items.every(r => /^gs[0-9a-z]{1,13}$/.test(r.session_id) && typeof r.name === 'string' && Number.isSafeInteger(r.score) && r.score >= 0 && Number.isFinite(Date.parse(r.played_at))); }
export function PostComposer({ sessionId, onPosted, entryAvatar }: { sessionId?: string; onPosted?: () => void; entryAvatar?: ReactNode }) {
  const [open, setOpen] = useState(false), [done, setDone] = useState(false);
  return <div className="post-composer-entry">
    {!open && (entryAvatar ? <button className="feed-compose-prompt" aria-label="Write a post" onClick={()=>{setOpen(true);setDone(false);}}>{entryAvatar}<span>Share a thought or a game result…</span><strong>Post <span aria-hidden="true">↗</span></strong></button> : <button className="btn btn-primary" onClick={() => { setOpen(true); setDone(false); }}>{sessionId ? 'Write a post with this score' : 'Write a post'}</button>)}
    {done && <p role="status">Your post is public. You can delete it from your profile or Following.</p>}
    {open && <Editor sessionId={sessionId} close={() => setOpen(false)} published={() => { setOpen(false); setDone(true); onPosted?.(); }} />}
  </div>;
}
function Editor({ sessionId, close, published }: { sessionId?: string; close: () => void; published: () => void }) {
  const [team,setTeam]=useState<TeamChoice>(),[pickingTeam,setPickingTeam]=useState(false);
  const [text, setText] = useState(''), [selected, setSelected] = useState<Result>(), [picking, setPicking] = useState(false);
  const [campaign, setCampaign] = useState<CaptainCampaign>(), [chooseCampaign, setChooseCampaign] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [initialBusy, setInitialBusy] = useState(!!sessionId), [retry, setRetry] = useState(0);
  const request = useRef<AbortController>(), lock = useRef(false);
  const submission = useRef<{ body: string; request_id: string }>();
  useEffect(() => {
    if (!sessionId) return;
    const ctrl = new AbortController(); setInitialBusy(true); setError('');
    api.authenticated<Results>(`/social/results?session=${encodeURIComponent(sessionId)}`, undefined, ctrl.signal).then(p => {
      if (!valid(p) || p.items.length !== 1) throw new Error('Could not load this accepted result.');
      if (!ctrl.signal.aborted) setSelected(p.items[0]);
    }).catch(e => { if (!ctrl.signal.aborted) setError(e instanceof Error ? e.message : 'Could not load result.'); }).finally(() => { if (!ctrl.signal.aborted) setInitialBusy(false); });
    return () => ctrl.abort();
  }, [sessionId, retry]);
  useEffect(() => () => request.current?.abort(), []);
  async function publish() {
    if (lock.current || !text.trim() || Array.from(text.trim()).length > 500) return;
    lock.current = true; setBusy(true); setError('');
    const body = { text: text.trim(), session_id: selected?.session_id || '', ...(team ? {team_id:team.membership.team_id,team_campaign:team.slug} : {}) }, signature = JSON.stringify(body);
    const ctrl = new AbortController(); request.current = ctrl;
    try {
      if (!submission.current || submission.current.body !== signature) submission.current = { body: signature, request_id: Array.from(crypto.getRandomValues(new Uint8Array(16)), n => n.toString(16).padStart(2, '0')).join('') };
      const post = await api.authenticated<{ id: string }>('/social/posts', { ...body, request_id: submission.current.request_id }, ctrl.signal);
      if (!post || !/^sp[0-9a-f]{64}$/.test(post.id)) throw new Error('Could not confirm publication. Retry without changing the post.');
      if (!ctrl.signal.aborted) published();
    } catch (e) { if (!ctrl.signal.aborted) setError(e instanceof Error ? e.message : 'Could not publish.'); }
    finally { lock.current = false; if (!ctrl.signal.aborted) setBusy(false); }
  }
  return <section className="post-composer membership-card" aria-label="Write a public post">
    <h2>What would you like to share?</h2>
    <p className="small muted">Public · Visible on your profile and in your followers’ feed. Attach a card or post text only.</p>
    <label htmlFor="post-text">Your post</label>
    <textarea id="post-text" autoFocus rows={4} value={text} disabled={busy} onChange={e => setText(e.target.value)} placeholder="Tell your story…" />
    <span className="small muted">{Array.from(text).length} / 500 characters</span>
    {initialBusy && <p role="status">Loading accepted result…</p>}
    {selected && <div className="post-result"><strong>{selected.score.toLocaleString()} game points</strong><p>{selected.name} · {selected.game_key} · {selected.rules}</p><small>{new Date(selected.played_at).toLocaleString()}</small><button className="text-link" disabled={busy} onClick={() => setSelected(undefined)}>Remove score</button></div>}
    {team&&<div className="post-result"><strong>{team.team_name}</strong><p>{team.name}</p><small>Your personal invitation and a verified team snapshot will be attached when you publish.</small><button className="text-link" disabled={busy} onClick={()=>setTeam(undefined)}>Remove team</button></div>}
    <div className="post-attachments" role="group" aria-label="Post attachment types">
      <div className="post-attachments-heading"><strong>Add a card</strong><span className="small muted">Optional · One card per post</span></div>
      <div className="post-attachment-grid">
        <button className={`post-attachment-option ${selected || picking ? 'active' : ''}`} disabled={busy || initialBusy} aria-label={selected ? 'Choose a different round' : 'Attach a game result'} aria-expanded={picking} onClick={() => {setPicking(v => !v);setPickingTeam(false);}}>
          <Gamepad2 size={21} aria-hidden="true" /><span><strong>Game result</strong><small>{selected ? 'Change selected round' : 'Choose a verified score'}</small></span><span className="post-attachment-badge">{selected ? 'Attached' : 'Available'}</span>
        </button>
        <button className={`post-attachment-option ${team||pickingTeam?'active':''}`} disabled={busy||initialBusy} aria-label="Attach a team report" aria-expanded={pickingTeam} onClick={()=>{setPickingTeam(v=>!v);setPicking(false);}}><Users size={21} aria-hidden="true"/><span><strong>Team</strong><small>Share your progress and invitation</small></span><span className="post-attachment-badge">{team?'Attached':'Available'}</span></button>
        {([{ label: 'Trade', description: 'Share an on-chain transaction', Icon: ArrowLeftRight }, { label: 'Campaign', description: 'Share a campaign you believe in', Icon: Flag }]).map(({ label, description, Icon }) =>
          <button className="post-attachment-option" key={label} disabled aria-label={`${label} — Coming soon`}>
            <Icon size={21} aria-hidden="true" /><span><strong>{label}</strong><small>{description}</small></span><span className="post-attachment-badge">Coming soon</span>
          </button>)}
      </div>
      <p className="small muted">Game results and team reports are available now. More card types are coming soon.</p>
    </div>
    {picking && !busy && <div className="post-picker">
      <div className="following-toolbar"><span>{campaign?.name || 'All campaigns'}</span><button className="text-link" onClick={() => setChooseCampaign(true)}>Filter by campaign</button>{campaign && <button className="text-link" onClick={() => setCampaign(undefined)}>Clear filter</button>}</div>
      <ResultPicker key={campaign?.id || 'all'} campaign={campaign?.id} select={r => { setSelected(r);setTeam(undefined); setPicking(false); }} />
    </div>}
    {pickingTeam&&!busy&&<TeamPostPicker select={t=>{setTeam(t);setSelected(undefined);setPickingTeam(false);}}/>}
    {chooseCampaign && <CampaignPicker purpose="leaderboard" choose={c => { setCampaign(c); setChooseCampaign(false); }} close={() => setChooseCampaign(false)} />}
    {error && <p role="alert">{error} {sessionId && !selected && <button className="text-link" onClick={() => setRetry(n => n + 1)}>Retry result</button>}</p>}
    <div className="following-links"><button className="btn btn-primary" disabled={busy || initialBusy || !text.trim() || Array.from(text.trim()).length > 500} onClick={() => void publish()}>{busy ? 'Publishing…' : 'Publish publicly'}</button><button className="btn btn-secondary" disabled={busy} onClick={close}>Cancel</button></div>
  </section>;
}
function ResultPicker({ campaign, select }: { campaign?: string; select: (r: Result) => void }) {
  const [rows, setRows] = useState<Result[]>([]), [next, setNext] = useState(''), [busy, setBusy] = useState(false), [loaded, setLoaded] = useState(false), [error, setError] = useState('');
  const lock = useRef(false), ctrl = useRef<AbortController>(), retry = useRef('');
  async function load(after = '') {
    if (lock.current) return; lock.current = true; retry.current = after; setBusy(true); setError('');
    const controller = new AbortController(); ctrl.current = controller;
    const q = new URLSearchParams(); if (campaign) q.set('campaign', campaign); if (after) q.set('after', after);
    try {
      const page = await api.authenticated<Results>(`/social/results${q.size ? '?' + q : ''}`, undefined, controller.signal);
      if (!valid(page)) throw new Error('Could not read game results.');
      if (!controller.signal.aborted) { setRows(old => after ? [...old, ...page.items.filter(r => !old.some(o => o.id === r.id))] : page.items); setNext(page.next_cursor); setLoaded(true); }
    } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Could not load results.'); }
    finally { if (!controller.signal.aborted) { lock.current = false; setBusy(false); } }
  }
  useEffect(() => { void load(); return () => ctrl.current?.abort(); }, [campaign]);
  return <><p className="small muted">Your server-accepted rounds, newest first. Trial rounds are not included.</p>
    {rows.map(r => <button className="post-result post-result-choice" key={r.id} onClick={() => select(r)}><strong>{r.score.toLocaleString()} game points · {r.name}</strong><span>{r.game_key} · {r.rules} · {new Date(r.played_at).toLocaleString()}</span></button>)}
    {busy && <p role="status">Loading results…</p>}{loaded && !rows.length && <p>No accepted rounds in this selection.</p>}
    {error && <p role="alert">{error} <button className="text-link" onClick={() => void load(retry.current)}>Retry results</button></p>}
    {next && <button className="btn btn-secondary" disabled={busy} onClick={() => void load(next)}>Load more results</button>}
  </>;
}
