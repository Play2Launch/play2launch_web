import {useEffect,useId,useRef,useState} from 'react';
import {Check,ChevronDown,Search} from 'lucide-react';
import {AssetIcon} from './AssetIcon';
type Option={value:string;label:string;icon?:string;detail?:string};
function OptionIcon({option}:{option:Option}) {
 const [failed,setFailed]=useState(false);
 useEffect(()=>setFailed(false),[option.icon]);
 const kind=option.label.toLowerCase();
 if(option.icon&&/^https:\/\//i.test(option.icon)&&!failed)return <img className="relay-option-icon" src={option.icon} alt="" loading="lazy" referrerPolicy="no-referrer" onError={()=>setFailed(true)}/>;
 if(['ethereum','usdt','usdc','usdg'].includes(kind))return <AssetIcon kind={kind} size={28}/>;
 return <span className="relay-option-fallback" aria-hidden="true">{option.label.slice(0,2).toUpperCase()}</span>;
}
export function RelayAssetSelect({label,value,options,disabled,onChange}:{label:string;value:string;options:Option[];disabled?:boolean;onChange:(value:string)=>void}) {
 const [open,setOpen]=useState(false),[search,setSearch]=useState('');
 const root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),input=useRef<HTMLInputElement>(null),id=useId();
 const selected=options.find(o=>o.value===value),filtered=options.filter(o=>(o.label+' '+(o.detail||'')).toLowerCase().includes(search.toLowerCase()));
 useEffect(()=>{if(disabled)setOpen(false)},[disabled]);
 useEffect(()=>{if(!open)return;if(!window.matchMedia?.('(pointer: coarse)').matches)input.current?.focus();const close=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false)};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close)},[open]);
 return <div className="relay-asset-select" ref={root} onBlur={e=>{if(e.relatedTarget&&!e.currentTarget.contains(e.relatedTarget))setOpen(false)}} onKeyDown={e=>{if(e.key==='Escape'&&open){e.stopPropagation();setOpen(false);trigger.current?.focus()}}}>
  <span id={id+'-label'}>{label}</span>
  <button ref={trigger} type="button" className="btn btn-secondary relay-select-trigger" aria-labelledby={id+'-label'} aria-expanded={open} aria-controls={id} disabled={disabled} onClick={()=>{setSearch('');setOpen(!open)}}>
   {selected?<><OptionIcon option={selected}/><span>{selected.label}</span></>:<span>Select {label.toLowerCase()}</span>}<ChevronDown size={16}/>
  </button>
  {open&&<div className="relay-select-menu" id={id}>
   <div className="relay-select-search"><Search size={16}/><input ref={input} aria-label={`Search ${label.toLowerCase()}`} placeholder="Search…" value={search} onChange={e=>setSearch(e.target.value)}/></div>
   <div className="relay-select-options">{filtered.map(option=><button type="button" key={option.value} className="relay-select-option" aria-pressed={option.value===value} onClick={()=>{onChange(option.value);setOpen(false);trigger.current?.focus()}}><OptionIcon option={option}/><span>{option.label}{option.detail&&<small>{option.detail}</small>}</span>{option.value===value&&<Check size={16}/>}</button>)}{!filtered.length&&<p className="muted">No matching assets</p>}</div>
  </div>}
 </div>;
}
