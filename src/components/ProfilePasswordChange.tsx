import {useEffect, useRef, useState, type FormEvent} from 'react';
import {ChevronRight, LockKeyhole} from 'lucide-react';
import {api} from '../lib/api';
import './ProfilePasswordChange.css';

export function ProfilePasswordChange({email,onChanged}:{email:string;onChanged:()=>Promise<void>}) {
  const [open,setOpen]=useState(false);
  const [sent,setSent]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [code,setCode]=useState('');
  const [password,setPassword]=useState('');
  const [confirm,setConfirm]=useState('');
  const pending=useRef<AbortController|null>(null);
  useEffect(()=>()=>pending.current?.abort(),[]);

  async function sendCode() {
    if(busy)return;
    const controller=new AbortController();pending.current=controller;
    setBusy(true);setError('');
    try {
      await api.requestReset(email,controller.signal);
      if(!controller.signal.aborted)setSent(true);
    } catch(e) {
      if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Could not send the code. Please try again.');
    } finally {
      if(!controller.signal.aborted)setBusy(false);
      if(pending.current===controller)pending.current=null;
    }
  }

  async function updatePassword(event:FormEvent) {
    event.preventDefault();
    if(busy)return;
    setError('');
    if(password!==confirm){setError('The passwords do not match.');return;}
    if(new TextEncoder().encode(password).length>72){setError('Your password must be no longer than 72 UTF-8 bytes.');return;}
    const controller=new AbortController();pending.current=controller;
    setBusy(true);
    try {
      await api.resetPassword(email,code,password,controller.signal);
      if(!controller.signal.aborted){
        setCode('');setPassword('');setConfirm('');
        await onChanged();
      }
    } catch(e) {
      if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Could not update your password.');
    } finally {
      if(!controller.signal.aborted)setBusy(false);
      if(pending.current===controller)pending.current=null;
    }
  }

  return <section className="profile-security" aria-label="Account security">
    <span className="eyebrow">ACCOUNT SECURITY</span>
    <button type="button" className="profile-security-trigger" aria-expanded={open} aria-controls="profile-password-form" disabled={busy} onClick={()=>{setOpen(value=>!value);setError('');}}>
      <span className="profile-tool-icon"><LockKeyhole size={19} aria-hidden="true"/></span>
      <span><strong>Change password</strong><small>Use a code sent to your email</small></span>
      <ChevronRight size={18} aria-hidden="true"/>
    </button>
    {open&&<div id="profile-password-form" className="profile-security-body">
      <p>A verification code will be sent to <strong>{email}</strong>. It expires in 5 minutes. After updating, sign in again on this device.</p>
      {!sent?<button type="button" className="btn btn-secondary" disabled={busy} onClick={()=>void sendCode()}>{busy?'Sending…':'Send code'}</button>
        :<form onSubmit={event=>void updatePassword(event)}>
          <label>Verification code<input type="text" autoComplete="one-time-code" autoCapitalize="characters" spellCheck={false} pattern="[A-Za-z0-9]{6}" maxLength={6} value={code} onChange={event=>setCode(event.target.value.toUpperCase())} required disabled={busy}/></label>
          <label>New password<input type="password" autoComplete="new-password" minLength={8} maxLength={72} value={password} onChange={event=>setPassword(event.target.value)} required disabled={busy}/></label>
          <label>Confirm new password<input type="password" autoComplete="new-password" minLength={8} maxLength={72} value={confirm} onChange={event=>setConfirm(event.target.value)} required disabled={busy}/></label>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy?'Updating…':'Update password'}</button>
          <button type="button" className="text-link" disabled={busy} onClick={()=>void sendCode()}>Resend code</button>
        </form>}
      {sent&&<p className="profile-security-hint">If the email is registered, the code has been sent. Check your inbox and spam folder.</p>}
      {error&&<p role="alert" className="profile-security-error">{error}</p>}
    </div>}
  </section>;
}
