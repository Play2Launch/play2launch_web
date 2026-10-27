import {useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {api} from '../lib/api';
import type {ArcadeTask} from '../lib/arcade';
export function ArcadeTasks({userId}:{userId:string}){
 const [items,setItems]=useState<ArcadeTask[]>([]),[error,setError]=useState(''),[revision,setRevision]=useState(0);
 useEffect(()=>{const c=new AbortController();void api.authenticated<ArcadeTask[]>('/arcade/tasks',undefined,c.signal).then(v=>{setItems(v);setError('')}).catch(()=>{if(!c.signal.aborted)setError('Unable to load game tasks.')});return()=>c.abort()},[userId,revision]);
 if(!items.length&&!error)return null;
 return <section className="task-group"><h2>Game & activity tasks</h2>{error&&<p role="alert">{error}</p>}<button className="btn btn-secondary" onClick={()=>setRevision(v=>v+1)}>Refresh game tasks</button><div className="task-grid">{items.map(v=><article className="task-card" key={v.task.id}><h3>{v.task.name}</h3><p>{v.task.description}</p><p>{v.progress} / {v.task.target} · {v.credited?'Credited':v.progress>=v.task.target?'Completed · reward pending':`+${v.task.reward} Points`}</p><progress value={v.progress} max={v.task.target}/><p>{v.task.period} · UTC</p><Link className="btn btn-secondary" to={v.task.campaign?`/games/${v.task.game_id}?campaign=${encodeURIComponent(v.task.campaign)}`:v.task.game_id?`/games/${v.task.game_id}`:'/'}>Play</Link></article>)}</div></section>
}
