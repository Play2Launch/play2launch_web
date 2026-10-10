import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { publicAvatarURL } from "../lib/avatar";
import "./AvatarEditor.css";

type Props = { title: string; endpoint: string; value?: string; onChange: (url: string) => void };

function paint(canvas: HTMLCanvasElement, image: HTMLImageElement, zoom: number, pan: {x:number;y:number}) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const size = canvas.width;
  const scale = Math.max(size/image.naturalWidth, size/image.naturalHeight)*zoom;
  const w = image.naturalWidth*scale, h=image.naturalHeight*scale;
  const px=Math.max(-(w-size)/2,Math.min((w-size)/2,pan.x));
  const py=Math.max(-(h-size)/2,Math.min((h-size)/2,pan.y));
  ctx.fillStyle="#ffffff";
  ctx.fillRect(0,0,size,size);
  ctx.drawImage(image,(size-w)/2+px,(size-h)/2+py,w,h);
}

export function AvatarEditor({title,endpoint,value,onChange}: Props) {
  const [image,setImage] = useState<HTMLImageElement|null>(null);
  const [zoom,setZoom] = useState(1);
  const [pan,setPan] = useState({x:0,y:0});
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const canvas = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{x:number;y:number;panX:number;panY:number}|null>(null);
  useEffect(()=>{ if(canvas.current && image) paint(canvas.current,image,zoom,pan); },[image,zoom,pan]);
  function choose(file?: File) {
    if(!file)return;
    if(!["image/jpeg","image/png","image/webp"].includes(file.type) || file.size>5*1024*1024){setError("Choose a JPG, PNG or WebP image under 5 MB.");return;}
    const url=URL.createObjectURL(file);
    const next=new Image();
    next.onload=()=>{URL.revokeObjectURL(url);if(next.naturalWidth<64||next.naturalHeight<64||next.naturalWidth>8192||next.naturalHeight>8192){setError("Image must be between 64 and 8192 pixels per side.");return;}setImage(next);setZoom(1);setPan({x:0,y:0});setError("");};
    next.onerror=()=>{URL.revokeObjectURL(url);setError("Could not open that image.");};
    next.src=url;
  }
  async function upload() {
    if(!canvas.current||!image||busy)return;
    setBusy(true);setError("");
    try {
      const blob=await new Promise<Blob>((resolve,reject)=>canvas.current!.toBlob(v=>v?resolve(v):reject(new Error("Could not prepare image.")),"image/jpeg",0.86));
      const body=new FormData();body.append("avatar",blob,"avatar.jpg");
      const result=await api.authenticated<{avatar_url:string}>(endpoint,body);
      onChange(result.avatar_url);setImage(null);
    } catch(e) {setError(e instanceof Error?e.message:"Avatar upload failed.");}
    finally{setBusy(false);}
  }
  async function remove() {
    if(busy)return;setBusy(true);setError("");
    try {const result=await api.authenticated<{avatar_url:string}>(endpoint+"/remove",{});onChange(result.avatar_url);setImage(null);}
    catch(e){setError(e instanceof Error?e.message:"Could not remove avatar.");}
    finally{setBusy(false);}
  }
  return <div className="avatar-editor">
    <strong>{title}</strong>
    {publicAvatarURL(value) && !image && <img className="avatar-editor-current" src={publicAvatarURL(value)} alt="Current avatar" />}
    <div className="avatar-editor-pickers">
      <label className={`btn btn-secondary avatar-editor-select${busy?" is-disabled":""}`}>Choose image<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e=>{choose(e.target.files?.[0]);e.currentTarget.value="";}} /></label>
      {!!value && !image && <button type="button" className="btn btn-secondary" disabled={busy} onClick={()=>void remove()}>Remove avatar</button>}
    </div>
    {image && <div className="avatar-editor-tools">
      <div className="avatar-editor-preview"><canvas ref={canvas} width={512} height={512} aria-label="Drag to reposition avatar" onPointerDown={e=>{drag.current={x:e.clientX,y:e.clientY,panX:pan.x,panY:pan.y};e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{if(!drag.current)return;const unit=512/e.currentTarget.getBoundingClientRect().width;setPan({x:drag.current.panX+(e.clientX-drag.current.x)*unit,y:drag.current.panY+(e.clientY-drag.current.y)*unit});}} onPointerUp={()=>{drag.current=null;}} /></div>
      <label>Zoom <input type="range" min="1" max="3" step="0.01" value={zoom} onChange={e=>setZoom(Number(e.target.value))} /></label>
      <p>Drag to reposition. The circle previews how it will appear.</p>
      <div className="avatar-editor-actions"><button type="button" className="btn btn-primary" disabled={busy} onClick={()=>void upload()}>{busy?"Uploading…":"Save avatar"}</button><button type="button" className="btn btn-secondary" disabled={busy} onClick={()=>setImage(null)}>Cancel</button></div>
    </div>}
    {error && <p role="alert">{error}</p>}
  </div>;
}
