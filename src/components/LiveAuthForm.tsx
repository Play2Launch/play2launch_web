import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowUpRight, Send } from "lucide-react";
import { api, type Account, type LoginResult } from "../lib/api";
import { useApp } from "../state";
import {beginTelegramLogin} from '../lib/telegram-login';

type Step = "login" | "register" | "verify" | "forgot" | "reset";
const headings: Record<Step, string> = {
  login: "Sign in with email",
  register: "Create your account",
  verify: "Activate your email",
  forgot: "Reset your password",
  reset: "Choose a new password",
};
export function LiveAuthForm() {
  const app = useApp();
  const [telegramEnabled,setTelegramEnabled]=useState(false);
  useEffect(()=>{if(app.platform.runtime==='telegram')return;const controller=new AbortController();api.request<{enabled:boolean}>('/auth/telegram/config',undefined,{signal:controller.signal}).then(v=>{if(!controller.signal.aborted)setTelegramEnabled(v.enabled===true)}).catch(()=>{});return ()=>controller.abort();},[app.platform.runtime]);
  const [step, setStep] = useState<Step>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [code, setCode] = useState("");
  const [account, setAccount] = useState<Account | null>(null);
  const [message, setMessage] = useState("");
  const sentUntil = useRef<Record<string, number>>({});
  const autoSentFor = useRef<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const remaining = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));
  const sendActivation = () => {
    if (!account || app.authBusy || (sentUntil.current[account.account_id] || 0) > Date.now()) return;
    sentUntil.current[account.account_id] = Date.now() + 60_000;
    setCooldownUntil(sentUntil.current[account.account_id]);
    setNow(Date.now());
    setMessage("Sending activation code…");
    void app.executeAuth(
      async (signal) => {
        try { return await api.sendVerification(account.account_id, signal); }
        catch (error) {
          if (!signal.aborted) setMessage("Could not confirm delivery. Check your inbox and spam folder, or resend when the countdown ends.");
          throw error;
        }
      },
      () => setMessage("Activation code sent. Check your inbox and spam folder. It expires in 5 minutes."),
    );
  };
  useEffect(() => {
    if (step !== "verify") { autoSentFor.current = null; return; }
    if (!account || app.authBusy || app.platform.runtime === "telegram" || autoSentFor.current === account.account_id) return;
    autoSentFor.current = account.account_id;
    setCooldownUntil(sentUntil.current[account.account_id] || 0);
    sendActivation();
  });
  useEffect(() => {
    if (step !== "verify") return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [step]);
  const change = (next: Step) => {
    setStep(next);
    setPassword("");
    setConfirm("");
    setCode("");
    setMessage("");
    app.setAuthError("");
  };
  const accept = (result: LoginResult) => {
    setPassword("");
    setConfirm("");
    if (result.kind === "authenticated") app.completeLiveLogin(result);
    else {
      setAccount(result.account);
      setEmail(result.account.username);
      setStep("verify");
      setMessage("Your email needs activation before you can sign in.");
    }
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (app.authBusy) return;
    app.setAuthError("");
    setMessage("");
    if ((step === "register" || step === "reset") && password !== confirm) {
      app.setAuthError("The passwords do not match.");
      return;
    }
    if (password && new TextEncoder().encode(password).length > 72) {
      app.setAuthError("Your password must be no longer than 72 UTF-8 bytes.");
      return;
    }
    if (step === "login")
      void app.executeAuth(
        (signal) => api.login(email, password, app.authContext(), signal),
        accept,
      );
    else if (step === "register")
      void app.executeAuth(
        (signal) => api.register(email, password, signal),
        (created) => {
          setAccount(created);
          change("verify");
          setMessage(
            "Account created. We’ll send an activation code to your email.",
          );
        },
      );
    else if (step === "verify" && account)
      void app.executeAuth(
        (signal) =>
          api.verifyEmail(account.account_id, code, app.authContext(), signal),
        accept,
      );
    else if (step === "forgot")
      void app.executeAuth(
        (signal) => api.requestReset(email, signal),
        () => {
          change("reset");
          setMessage(
            "If this email is registered, a reset code has been sent. It expires in 5 minutes.",
          );
        },
      );
    else if (step === "reset")
      void app.executeAuth(
        (signal) => api.resetPassword(email, code, password, signal),
        () => {
          change("login");
          setMessage("Password updated. Sign in with your new password.");
        },
      );
  };
  if (app.platform.runtime === "telegram")
    return (
      <div className="auth-form">
        <p className="small muted">
          This is a Telegram Mini App session. Retry Telegram verification below.
          If your session has expired, close this Mini App and open it again from
          the bot’s Open App button. Email sign-in is only available on the regular website.
        </p>
        <button
          type="button"
          className="btn btn-primary full"
          disabled={app.authBusy}
          onClick={() => void app.telegramLogin()}
        >
          <Send size={16} />
          {app.authBusy ? "Verifying Telegram…" : "Continue with Telegram"}
        </button>
      </div>
    );
  return (
    <>
      <h3>{headings[step]}</h3>
      {telegramEnabled&&(step==='login'||step==='register')&&<><button type="button" className="btn btn-secondary" disabled={app.authBusy} onClick={()=>void app.executeAuth(()=>beginTelegramLogin(app.authContext()),()=>{})}><Send size={16}/> Continue with Telegram</button><p className="small muted">Or continue with email</p></>}
      <form className="auth-form" onSubmit={submit} aria-busy={app.authBusy}>
        {step !== "verify" ? (
          <label>
            Email address
            <input
              type="email"
              autoComplete="email"
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={app.authBusy}
              placeholder="you@example.com"
            />
          </label>
        ) : (
          <p className="small muted">
            Activation for {email}. Codes contain 6 letters or numbers and
            expire in 5 minutes.
          </p>
        )}
        {(step === "verify" || step === "reset") && (
          <label>
            Verification code
            <input
              autoComplete="one-time-code"
              autoCapitalize="characters"
              spellCheck={false}
              pattern="[A-Za-z0-9]{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              required
              disabled={app.authBusy}
              placeholder="6-character code"
            />
          </label>
        )}
        {(step === "login" || step === "register" || step === "reset") && (
          <label>
            {step === "reset" ? "New password" : "Password"}
            <input
              type="password"
              autoComplete={
                step === "login" ? "current-password" : "new-password"
              }
              minLength={step === "login" ? undefined : 8}
              maxLength={72}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={app.authBusy}
            />
          </label>
        )}
        {(step === "register" || step === "reset") && (
          <label>
            Confirm password
            <input
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={72}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              disabled={app.authBusy}
            />
          </label>
        )}
        <button className="btn btn-primary full" disabled={app.authBusy}>
          {app.authBusy
            ? "Please wait…"
            : {
                login: "Sign in",
                register: "Create account",
                verify: "Verify and sign in",
                forgot: "Send reset code",
                reset: "Update password",
              }[step]}
          <ArrowUpRight size={16} />
        </button>
      </form>
      {step === "verify" && account && (
        <button
          type="button"
          className="btn btn-secondary full"
          disabled={app.authBusy || remaining > 0}
          onClick={sendActivation}
        >
          {remaining > 0 ? `Resend code in ${remaining}s` : "Resend code"}
        </button>
      )}
      {message && (
        <p className="small" role="status">
          {message}
        </p>
      )}
      <div className="auth-links">
        {step === "login" ? (
          <>
            <button
              type="button"
              className="text-link"
              disabled={app.authBusy}
              onClick={() => change("register")}
            >
              Create an account
            </button>
            <button
              type="button"
              className="text-link"
              disabled={app.authBusy}
              onClick={() => change("forgot")}
            >
              Forgot password?
            </button>
          </>
        ) : (
          <button
            type="button"
            className="text-link"
            disabled={app.authBusy}
            onClick={() => change("login")}
          >
            Back to sign in
          </button>
        )}
        {step === "forgot" && (
          <button
            type="button"
            className="text-link"
            disabled={app.authBusy}
            onClick={() => change("reset")}
          >
            I already have a reset code
          </button>
        )}
      </div>
      <p className="small muted">
        Only your identity is connected. Teams, scores and rewards are still
        previews. Passwords and verification codes are never saved in browser
        storage.
      </p>
    </>
  );
}
