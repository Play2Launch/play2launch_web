import type { EntryContext } from "./entry";
import { publicAvatarURL } from './avatar';
export type User = { id: string; name: string; handle?: string; avatarUrl?: string; email?: string; signupInviteToken?: string; mode: "demo" | "live" };
export type AuthContext = { guestId: string; entry: EntryContext };
export type Account = {
  account_id: string;
  username: string;
  type: number;
  status: number;
  token: string;
  display_name: string;
  session?: 'cookie';
};
export type AccountCredential = {
  kind: "account";
  accountId: string;
  token: string;
};
export type SignedIn = {
  kind: "authenticated";
  user: User;
  credential: AccountCredential | { kind: "telegram"; token: string } | {kind:"webtelegram";token:string} | {kind:'web-cookie';token:''};
};
export type LoginResult = SignedIn | { kind: "verification"; account: Account };
const messages: Record<number, string> = {
  11008: "Use 3–24 letters, digits or underscores, starting with a letter. Official names are reserved.",
  11009: "This username is already used or reserved. Choose another.",
  11010: "You have used your one username change. Your display name can still be edited.",
  11011: "Your profile changed. Reload before trying again.",
  16003: "Approved KOL verification is required to create a team.",
  16004: "Set your P2L @username in Profile before starting KOL verification.",
  13003: "Another team or game operation is in progress. Please retry.",
  13004: "Finish your active game or wait for it to expire before creating a team.",
  13005: "This team name is already used in the campaign.",
  13006: "Confirm leaving your current team before creating a new team.",
  13007: "This team is paused. Joining and new games are unavailable; your past scores are preserved.",
  13009: "This invitation is invalid or revoked. Ask a current team member for a new link. You cannot invite yourself.",
  13008: "Team settings have changed. Reload the page before trying again.",
  16001: "Your application is pending or already approved.",
  16002: "The application changed or the ownership code expired. Refresh and try again.",
  14001: "The game operations were invalid. This score was not accepted.",
  14002: "This round is not ready for submission or has expired.",
  14003: "This round already has a different accepted record. Open its result.",
  12004: "The campaign participation window is closed.",
  13001: "You already belong to another team in this campaign.",
  13002: "Joining is closed or this campaign has reached capacity.",
  10000: "The service encountered a problem. Please try again.",
  10001: "Please check the information you entered.",
  10002: "Your session expired. Please sign in again.",
  10003: "This action is not permitted.",
  10005: "Too many attempts. Please wait a minute and try again.",
  10006: "The service is temporarily unavailable. Please try again.",
  11001: "This email is already registered. Sign in or reset your password.",
  11002: "Incorrect email or password.",
  11003: "Verify your email before signing in.",
  11004: "This account is frozen. Please contact support.",
  11005: "The verification code is incorrect or expired.",
  11006:
    "Email delivery is currently unavailable. Please try again later or sign in with an existing verified account.",
  11007: "Telegram login is not configured on this server yet.",
};
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: number,
  ) {
    super(
      messages[code] ||
        (status === 401
          ? messages[10002]
          : status === 429
            ? messages[10005]
            : messages[10006]),
    );
    this.name = "ApiError";
  }
}
const invalid = () =>
  new Error("The sign-in response was invalid. Please try again.");
const aborted = () => new DOMException("Sign-in cancelled", "AbortError");
const browserStorage = () => {
  try {
    return typeof sessionStorage === "undefined" ? undefined : sessionStorage;
  } catch {
    return undefined;
  }
};
export class ApiClient {
  private base: string;
  private useCookieSession = false;
  private credential: SignedIn["credential"] | null = null;
  constructor(
    base: string,
    private transport: typeof fetch = (...args) => fetch(...args),
    private storage = browserStorage(),
  ) {
    this.base = base.replace(/\/$/, "");
  }
  private get storageKey() {
    return "p2l.account-session.v1:" + this.base;
  }
  // Non-secret preference prevents a failed logout or an account switch from
  // silently restoring an older HttpOnly session on the next browser launch.
  private cookieRestoreBlocked(block?:boolean) {
    try {
      const key='p2l.cookie-signout.v1:'+this.base;
      if(block===true)localStorage.setItem(key,'1');
      if(block===false)localStorage.removeItem(key);
      return localStorage.getItem(key)==='1';
    } catch {return false;}
  }
  async request<T>(
    path: string,
    data?: unknown,
    options: { authorization?: string; signal?: AbortSignal } = {},
  ): Promise<T> {
    if (!this.base)
      throw new Error(
        "The authentication service has not been configured. You can continue playing as a guest.",
      );
    if (options.signal?.aborted) throw aborted();
    const controller = new AbortController();
    const cancel = () => controller.abort();
    options.signal?.addEventListener("abort", cancel, { once: true });
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 12000);
    const form = data instanceof URLSearchParams;
    const multipart = data instanceof FormData;
    try {
      const response = await this.transport(this.base + path, {
        method: data === undefined ? "GET" : "POST",
        credentials: options.authorization==='cookie' ? 'include' : 'omit',
        cache: "no-store",
        headers: {
          ...(data === undefined || multipart
            ? {}
            : {
                "Content-Type": form
                  ? "application/x-www-form-urlencoded"
                  : "application/json",
              }),
          ...(options.authorization==='cookie'
            ? {'X-P2L-Session':'cookie'}
            : options.authorization
            ? { Authorization: options.authorization }
            : {}),
        },
        body:
          data === undefined
            ? undefined
            : multipart
              ? data
              : form
              ? data.toString()
              : JSON.stringify(data),
        signal: controller.signal,
      });
      if (controller.signal.aborted) throw aborted();
      let result: { code?: number; data?: T };
      try {
        result = await response.json();
      } catch {
        throw new ApiError(response.status, 10006);
      }
      if (controller.signal.aborted) throw aborted();
      if (!result || typeof result !== "object") throw invalid();
      if (!response.ok || result.code !== 0)
        throw new ApiError(
          response.status,
          typeof result.code === "number" ? result.code : 10006,
        );
      if (!("data" in result)) throw invalid();
      return result.data as T;
    } catch (error) {
      if (options.signal?.aborted) throw aborted();
      if (timedOut)
        throw new Error(
          "The request timed out. Your local progress is still on this device.",
        );
      if (error instanceof TypeError)
        throw new Error(
          "Could not reach the sign-in service. Check your connection and try again.",
        );
      throw error;
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener("abort", cancel);
    }
  }
  private account(value: Account): Account {
    if (
      !value ||
      typeof value.account_id !== "string" ||
      !value.account_id ||
      value.type !== 1 ||
      ![0, 1, 2, 3].includes(value.status) ||
      typeof value.username !== "string" ||
      typeof value.token !== "string"
    )
      throw invalid();
    if (value.status === 2) throw new ApiError(403, 11004);
    if (value.status === 3) throw new ApiError(401, 10002);
    return value;
  }
  private async user(
    authorization: string,
    context: AuthContext,
    signal?: AbortSignal,
  ): Promise<User> {
    // Campaign attribution remains local; only actual business-user IDs are global referrers.
    const referrer = /^ur[a-z0-9]+$/.test(context.entry.referrerId || "")
      ? context.entry.referrerId!
      : "";
    // A TMA starts authentication before the invitation page can fetch its
    // preview. The server derives first-login attribution from this token.
    const inviteToken = /^tma /i.test(authorization) && /^[A-Za-z0-9_-]{32}$/.test(context.entry.inviteToken || "")
      ? context.entry.inviteToken!
      : "";
    const data = await this.request<{
      id: string;
      new_account?: boolean;
      display_name?: string;
      user_name?: string;
      nickname?: string;
      avatar_url?: string;
      handle?: string;
      from?: number;
    }>("/user/tg_login", new URLSearchParams({ referrer_id: referrer, ...(inviteToken ? { invite_token: inviteToken } : {}) }), {
      authorization,
      signal,
    });
    if (!data || typeof data.id !== "string" || !data.id) throw invalid();
    const name = [data.nickname, data.from === 1 ? data.display_name : undefined].find(
      (value) => typeof value === "string" && value.trim() && !value.includes("@") && !/[\u0000-\u001f\u007f]/.test(value),
    );
    const email = data.from === 2 && typeof data.user_name === 'string' && /^[^\s@]+@[^\s@]+$/.test(data.user_name) ? data.user_name : undefined;
    return { id: data.id, name: name?.trim() || `Player #${data.id}`, ...(publicAvatarURL(data.avatar_url) ? {avatarUrl:publicAvatarURL(data.avatar_url)} : {}), ...(typeof data.handle === "string" && /^[a-z][a-z0-9_]{2,23}$/.test(data.handle) ? {handle:data.handle} : {}), ...(email ? {email} : {}), ...(data.new_account === true && inviteToken ? {signupInviteToken:inviteToken} : {}), mode: "live" };
  }
  private async finish(
    account: Account,
    context: AuthContext,
    signal?: AbortSignal,
  ): Promise<LoginResult> {
    const a = this.account(account);
    if (a.status === 0)
      return { kind: "verification", account: { ...a, token: "" } };
    if(account.session==='cookie')return {kind:'authenticated',user:await this.user('cookie',context,signal),credential:{kind:'web-cookie',token:''}};
    if (!a.token) throw invalid();
    return {
      kind: "authenticated",
      user: await this.user("bearer " + a.token, context, signal),
      credential: { kind: "account", accountId: a.account_id, token: a.token },
    };
  }
  async login(
    email: string,
    password: string,
    context: AuthContext,
    signal?: AbortSignal,
  ) {
    return this.finish(
      await this.request<Account>(
        "/acc/login",
        { username: email.trim(), password, acc_type: 1, ...(this.useCookieSession ? {referrer_id:context.entry.referrerId||''} : {}) },
        { signal, ...(this.useCookieSession ? {authorization:'cookie'} : {}) },
      ),
      context,
      signal,
    );
  }
  async register(email: string, password: string, signal?: AbortSignal) {
    return this.account(
      await this.request<Account>(
        "/acc/create",
        { username: email.trim(), password, acc_type: 1 },
        { signal },
      ),
    );
  }
  sendVerification(accountId: string, signal?: AbortSignal) {
    return this.request(
      "/acc/send_email",
      { account_id: accountId },
      { signal },
    );
  }
  async verifyEmail(
    accountId: string,
    code: string,
    context: AuthContext,
    signal?: AbortSignal,
  ) {
    return this.finish(
      await this.request<Account>(
        "/acc/verify_email",
        { account_id: accountId, code: code.trim().toUpperCase(), ...(this.useCookieSession ? {referrer_id:context.entry.referrerId||''} : {}) },
        { signal, ...(this.useCookieSession ? {authorization:'cookie'} : {}) },
      ),
      context,
      signal,
    );
  }
  requestReset(email: string, signal?: AbortSignal) {
    return this.request(
      "/acc/request_reset_password",
      { username: email.trim() },
      { signal },
    );
  }
  resetPassword(
    email: string,
    code: string,
    password: string,
    signal?: AbortSignal,
  ) {
    return this.request(
      "/acc/reset_password",
      { username: email.trim(), code: code.trim().toUpperCase(), password },
      { signal },
    );
  }
  async telegram(
    initData: string,
    context: AuthContext,
    signal?: AbortSignal,
  ): Promise<SignedIn> {
    if (!initData)
      throw new Error(
        "Open this app through its Telegram Mini App link to sign in with Telegram.",
      );
    return {
      kind: "authenticated",
      user: await this.user("tma " + initData, context, signal),
      credential: { kind: "telegram", token: initData },
    };
  }
  // Only the active UI attempt may commit credentials. Never persist raw Telegram data.
  async telegramStartURL(challenge:string,referrer?:string) {
    if(!this.base) throw new Error('The authentication service has not been configured.');
    const config=await this.request<{enabled:boolean;start_url?:string}>('/auth/telegram/config');
    if(!config.enabled)throw new Error('Telegram sign-in is currently unavailable.');
    const url=new URL(config.start_url || this.base+'/auth/telegram/start',window.location.origin);
    if(url.protocol!=='https:' || url.username || url.password || url.pathname!=='/api/v1/auth/telegram/start' || url.search || url.hash)throw new Error('The Telegram sign-in address is not configured correctly.');
    url.searchParams.set('challenge',challenge);
    if(/^ur[0-9a-z]{1,32}$/.test(referrer||''))url.searchParams.set('ref',referrer!);
    return url.toString();
  }
  async telegramExchange(ticket:string,verifier:string,context:AuthContext):Promise<SignedIn> {
    const data=await this.request<{session:string}>('/auth/telegram/exchange',{ticket,verifier},{authorization:'cookie'});
    if(data?.session!=='cookie')throw invalid();
    return {kind:'authenticated',user:await this.user('cookie',context),credential:{kind:'web-cookie',token:''}};
  }
  authenticated<T>(path: string, data?: unknown, signal?: AbortSignal): Promise<T> {
    const credential = this.credential;
    if (!credential) return Promise.reject(new ApiError(401, 10002));
    return this.request<T>(path, data, {signal, authorization: credential.kind==='web-cookie' ? 'cookie' : `${credential.kind === "account" ? "bearer" : credential.kind === 'webtelegram' ? 'p2l' : "tma"} ${credential.token}`});
  }
  remember(result: SignedIn) {
    this.credential = result.credential;
    this.cookieRestoreBlocked(result.credential.kind!=='web-cookie');
    try {
      if (result.credential.kind !== "telegram" && result.credential.kind !== 'web-cookie')
        this.storage?.setItem(
          this.storageKey,
          JSON.stringify(result.credential),
        );
      else this.storage?.removeItem(this.storageKey);
    } catch {
      /* Memory-only login when session storage is unavailable. */
    }
  }
  private saved(): AccountCredential | {kind:'webtelegram';token:string} | {kind:'web-cookie';token:''} | null {
    if (this.credential && this.credential.kind !== "telegram") return this.credential;
    try {
      const value = JSON.parse(
        this.storage?.getItem(this.storageKey) || "null",
      );
      if(value?.kind==='webtelegram' && typeof value.token==='string' && /^[A-Za-z0-9_-]{43}$/.test(value.token))return value;
      if (
        value?.kind === "account" &&
        typeof value.accountId === "string" &&
        value.accountId &&
        typeof value.token === "string" &&
        value.token
      )
        return value;
    } catch {
      /* Storage is not proof of identity. */
    }
    return null;
  }
  async session(
    context: AuthContext,
    signal?: AbortSignal,
  ): Promise<SignedIn | null> {
    const saved = this.saved();
    if(this.base){
      const config=await this.request<{enabled:boolean;cookie_session?:boolean}>('/auth/session/config',undefined,{signal});
      this.useCookieSession=config.enabled===true&&config.cookie_session===true;
    }
    if (!saved || saved.kind==='web-cookie') {
      if(!this.base||(!saved&&this.cookieRestoreBlocked()))return null;
      if(!saved&&!this.useCookieSession)return null;
      try {
        return {kind:'authenticated',user:await this.user('cookie',context,signal),credential:{kind:'web-cookie',token:''}};
      } catch(error) {
        if(error instanceof ApiError && [401,403].includes(error.status)){this.credential=null;return null;}
        throw error;
      }
    }
    try {
      if(saved.kind==='webtelegram')return {kind:'authenticated',user:await this.user('p2l '+saved.token,context,signal),credential:saved};
      const checked = await this.request<Account>(
        "/acc/check_token",
        { account_id: saved.accountId, token: saved.token, acc_type: 1 },
        { signal },
      );
      if (checked?.account_id !== saved.accountId) throw invalid();
      const result = await this.finish(checked, context, signal);
      if (result.kind !== "authenticated") throw new ApiError(401, 10002);
      return result;
    } catch (error) {
      if (
        !signal?.aborted &&
        error instanceof ApiError &&
        [401, 403].includes(error.status) &&
        this.saved()?.token === saved.token
      )
        this.logout();
      throw error;
    }
  }
  logout() {
    const old=this.saved();
    this.cookieRestoreBlocked(true);
    const revoked=old?.kind==='web-cookie'||old?.kind==='webtelegram'
      ? this.request(old.kind==='web-cookie'?'/auth/session/logout':'/auth/telegram/logout',{}, {authorization:old.kind==='web-cookie'?'cookie':'p2l '+old.token}).then(()=>true,()=>false)
      : Promise.resolve(true);
    this.credential = null;
    try {
      this.storage?.removeItem(this.storageKey);
    } catch {
      /* Legacy protocol has no server logout endpoint. */
    }
    return revoked;
  }
}
export const liveAuth = import.meta.env.VITE_API_MODE === "live";
// Complete API prefix, e.g. http://127.0.0.1:8088/api/v1.
export const api = new ApiClient(import.meta.env.VITE_API_BASE_URL || "");
