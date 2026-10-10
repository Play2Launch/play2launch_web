import { describe, expect, it, vi } from "vitest";
import { ApiClient, ApiError, type SignedIn } from "./api";
const context = {
  guestId: "guest_1",
  entry: {
    campaignId: "phood",
    teamId: "alice",
    referrerId: "urref",
    source: "telegram",
    target: "play" as const,
  },
};
const account = {
  account_id: "AC1",
  username: "player@example.test",
  type: 1,
  status: 1,
  token: "opaque-token",
  display_name: "Player",
};
const user = { id: "ur1", channel_id: "AC1", display_name: "Player", from: 2 };
const response = (data: unknown, status = 200, code = 0) =>
  new Response(JSON.stringify({ code, msg: "ignored", data }), { status });
function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
    clear: () => values.clear(),
    key: (i: number) => [...values.keys()][i] ?? null,
    get length() {
      return values.size;
    },
  };
}
describe("DashFun authentication contract", () => {
 it("sends avatar uploads as authenticated multipart without forcing JSON headers",async()=>{
  const transport=vi.fn().mockResolvedValue(response({avatar_url:"https://api.test/avatar.jpg"}));
  const client=new ApiClient("https://api.test",transport,memoryStorage());
  client.remember({kind:"authenticated",user:{id:"ur1",name:"P",mode:"live"},credential:{kind:"account",accountId:"AC1",token:"secret"}});
  const form=new FormData();form.append("avatar",new Blob(["image"],{type:"image/jpeg"}),"avatar.jpg");
  await client.authenticated("/user/avatar",form);
  const options=transport.mock.calls[0][1] as RequestInit;
  expect(options.body).toBe(form);
  expect((options.headers as Record<string,string>).Authorization).toBe("bearer secret");
  expect((options.headers as Record<string,string>)["Content-Type"]).toBeUndefined();
 });
 it.each(['login','activation'])('uses a persistent cookie after email %s, without check_token renewal',async flow=>{
  let signedIn=false;
  const storage=memoryStorage();
  const transport=vi.fn().mockImplementation(async(url:string)=>{
   if(url.endsWith('/auth/session/config'))return response({enabled:true,cookie_session:true});
   if(url.endsWith('/acc/login')||url.endsWith('/acc/verify_email')){signedIn=true;return response({...account,token:'',session:'cookie'});}
   if(url.endsWith('/user/tg_login'))return signedIn?response(user):response(null,401,10002);
   if(url.endsWith('/auth/session/logout')){signedIn=false;return response('signed out');}
   throw new Error('Unexpected endpoint '+url);
  });
  const client=new ApiClient('https://api.test',transport,storage);
  expect(await client.session(context)).toBeNull();
  const result=flow==='login'?await client.login(account.username,'password123',context):await client.verifyEmail('AC1','ABC123',context);
  expect(result.kind).toBe('authenticated');if(result.kind!=='authenticated')throw new Error('not authenticated');
  client.remember(result);expect(storage.length).toBe(0);expect(result.credential.kind).toBe('web-cookie');
  const authCall=transport.mock.calls.find(([url])=>url.endsWith(flow==='login'?'/acc/login':'/acc/verify_email'))!;
  expect(authCall[1].credentials).toBe('include');expect(authCall[1].headers['X-P2L-Session']).toBe('cookie');
  expect(JSON.parse(authCall[1].body).referrer_id).toBe('urref');
  expect((await new ApiClient('https://api.test',transport,memoryStorage()).session(context))?.user.id).toBe('ur1');
  expect(transport.mock.calls.some(([url])=>url.endsWith('/acc/check_token'))).toBe(false);
  expect(await client.logout()).toBe(true);
  expect(await new ApiClient('https://api.test',transport,memoryStorage()).session(context)).toBeNull();
 });
 it('treats a missing or expired cookie as signed out but surfaces network failures',async()=>{
  const transport=vi.fn().mockResolvedValueOnce(response({enabled:true,cookie_session:true})).mockResolvedValueOnce(response(null,401,10002)).mockRejectedValueOnce(new TypeError('offline'));
  const client=new ApiClient('https://api.test',transport,memoryStorage());
  expect(await client.session(context)).toBeNull();
  await expect(client.session(context)).rejects.toThrow('Could not reach');
 });
 it('blocks automatic cookie restore after failed logout without storing a credential',async()=>{
  const preferences=memoryStorage();vi.stubGlobal('localStorage',preferences);
  try {
   const transport=vi.fn().mockImplementation(async(url:string)=>{if(url.endsWith('/auth/session/config'))return response({enabled:true,cookie_session:true});throw new TypeError('offline');});
   const client=new ApiClient('https://api.test',transport,memoryStorage());
   client.remember({kind:'authenticated',user:{id:'ur1',name:'Player',mode:'live'},credential:{kind:'web-cookie',token:''}});
   expect(await client.logout()).toBe(false);
   expect(await new ApiClient('https://api.test',transport,memoryStorage()).session(context)).toBeNull();
   expect(transport).toHaveBeenCalledTimes(2);
   expect(preferences.getItem(preferences.key(0)!)).toBe('1');
  } finally {vi.unstubAllGlobals();}
 });
 it('uses the configured callback origin for login start without changing the API base',async()=>{
  vi.stubGlobal('window',{location:{origin:'https://www.play2launch.com'}});
  try {
   const transport=vi.fn().mockResolvedValue(response({enabled:true,start_url:'https://www.play2launch.com/api/v1/auth/telegram/start'}));
   const client=new ApiClient('https://api.play2launch.com/api/v1',transport,memoryStorage());
   const url=new URL(await client.telegramStartURL('challenge','ur123'));
   expect(url.origin).toBe('https://www.play2launch.com');
   expect(url.searchParams.get('challenge')).toBe('challenge');expect(url.searchParams.get('ref')).toBe('ur123');
   expect(transport.mock.calls[0][0]).toBe('https://api.play2launch.com/api/v1/auth/telegram/config');
   transport.mockResolvedValue(response({enabled:true}));
   expect(new URL(await client.telegramStartURL('challenge')).origin).toBe('https://api.play2launch.com');
   transport.mockResolvedValue(response({enabled:false}));
   await expect(client.telegramStartURL('challenge')).rejects.toThrow('unavailable');
   for(const start_url of ['javascript:alert(1)','http://www.play2launch.com/api/v1/auth/telegram/start','https://www.play2launch.com/other','https://user:pass@www.play2launch.com/api/v1/auth/telegram/start','https://www.play2launch.com/api/v1/auth/telegram/start?other=1']) {
    transport.mockResolvedValue(response({enabled:true,start_url}));
    await expect(client.telegramStartURL('challenge')).rejects.toThrow();
   }
  } finally {vi.unstubAllGlobals();}
 });
 it('exchanges, persists and restores a Telegram web session without TMA data',async()=>{
  const storage=memoryStorage();
  const transport=vi.fn().mockResolvedValueOnce(response({session:'cookie'})).mockImplementation(async(url:string)=>response(url.endsWith('/auth/session/config')?{enabled:true,cookie_session:true}:{...user,from:1,channel_id:'123',display_name:'Telegram Player'}));
  const client=new ApiClient('https://api.test',transport,storage);
  const result=await client.telegramExchange('ticket','verifier',context);
  expect(result.credential).toEqual({kind:'web-cookie',token:''});expect(storage.length).toBe(0);
  client.remember(result);
  const restored=await new ApiClient('https://api.test',transport,storage).session(context);
  expect(restored?.user.id).toBe('ur1');
  expect(storage.length).toBe(0);
  expect(transport.mock.calls[3][1].headers.Authorization).toBeUndefined();
  expect(transport.mock.calls[3][1].headers['X-P2L-Session']).toBe('cookie');
  expect(transport.mock.calls[3][1].credentials).toBe('include');
  client.logout();expect(storage.length).toBe(0);
  expect(transport.mock.calls[4][0]).toBe('https://api.test/auth/session/logout');
 });
  it('retains the public avatar for account and Telegram login',async()=>{
    const transport=vi.fn().mockResolvedValueOnce(response(account)).mockResolvedValueOnce(response({...user,avatar_url:'https://example.com/avatar.png'})).mockResolvedValueOnce(response({...user,avatar_url:'https://example.com/tg.png'}));
    const client=new ApiClient('https://api.test',transport);
    const result=await client.login('p','pass',context);
    expect(result.kind==='authenticated'&&result.user.avatarUrl).toBe('https://example.com/avatar.png');
    const tg=await client.telegram('signed-init-data',context);
    expect(tg.user.avatarUrl).toBe('https://example.com/tg.png');
  });
  it('exposes the own email only for an email account',async()=>{
    const transport=vi.fn().mockResolvedValueOnce(response(account))
      .mockResolvedValueOnce(response({...user,user_name:'player@example.test'}))
      .mockResolvedValueOnce(response({...user,from:1,user_name:'player@example.test'}));
    const client=new ApiClient('https://api.test',transport);
    const emailLogin=await client.login('player@example.test','password123',context);
    expect(emailLogin.kind==='authenticated'&&emailLogin.user.email).toBe('player@example.test');
    const telegramLogin=await client.telegram('signed-init-data',context);
    expect(telegramLogin.user.email).toBeUndefined();
  });
  it("uses account password login then bearer user login; stores only on commit", async () => {
    const transport = vi
      .fn()
      .mockResolvedValueOnce(response(account))
      .mockResolvedValueOnce(response(user));
    const storage = memoryStorage();
    const client = new ApiClient(
      "https://api.p2l.test/api/v1/",
      transport,
      storage,
    );
    const result = await client.login(
      " player@example.test ",
      "password",
      context,
    );
    expect(result.kind).toBe("authenticated");
    expect(transport.mock.calls[0][0]).toBe(
      "https://api.p2l.test/api/v1/acc/login",
    );
    expect(JSON.parse(transport.mock.calls[0][1].body)).toEqual({
      username: account.username,
      password: "password",
      acc_type: 1,
    });
    expect(transport.mock.calls[1][1].headers.Authorization).toBe(
      "bearer opaque-token",
    );
    expect(transport.mock.calls[1][1].body).toBe("referrer_id=urref");
    expect(transport.mock.calls[1][1].credentials).toBe("omit");
    expect(storage.length).toBe(0);
    client.remember(result as SignedIn);
    expect(storage.getItem(storage.key(0)!)).not.toContain("password");
    expect(storage.getItem(storage.key(0)!)).not.toContain("Player");
  });
  it("treats HTTP 200 unvalidated accounts as activation, not authentication", async () => {
    const transport = vi
      .fn()
      .mockResolvedValue(response({ ...account, status: 0, token: "" }));
    const result = await new ApiClient("https://api.test", transport).login(
      "p",
      "pass",
      context,
    );
    expect(result.kind).toBe("verification");
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it("registers without sending email automatically and supports alphanumeric activation", async () => {
    const transport = vi
      .fn()
      .mockResolvedValueOnce(response({ ...account, status: 0, token: "" }))
      .mockResolvedValueOnce(response(""))
      .mockResolvedValueOnce(response(account))
      .mockResolvedValueOnce(response(user));
    const client = new ApiClient("https://api.test", transport);
    await client.register(account.username, "password");
    expect(transport).toHaveBeenCalledTimes(1);
    await client.sendVerification("AC1");
    const result = await client.verifyEmail("AC1", " ab2cd3 ", context);
    expect(JSON.parse(transport.mock.calls[2][1].body)).toEqual({
      account_id: "AC1",
      code: "AB2CD3",
    });
    expect(result.kind).toBe("authenticated");
  });
  it("sends password reset payloads without claiming login or revocation", async () => {
    const transport = vi
      .fn()
      .mockImplementation(() => Promise.resolve(response("")));
    const client = new ApiClient("https://api.test", transport);
    await client.requestReset(account.username);
    await client.resetPassword(account.username, "ab2cd3", "new-password");
    expect(JSON.parse(transport.mock.calls[1][1].body)).toEqual({
      username: account.username,
      code: "AB2CD3",
      password: "new-password",
    });
  });
  it("sends raw TMA credentials only in the header, never persists them", async () => {
    const transport = vi.fn().mockResolvedValue(response(user));
    const storage = memoryStorage();
    const client = new ApiClient("https://api.test", transport, storage);
    const result = await client.telegram("signed&data=raw", context);
    client.remember(result);
    expect(transport.mock.calls[0][1].headers.Authorization).toBe(
      "tma signed&data=raw",
    );
    expect(transport.mock.calls[0][1].body).toBe("referrer_id=urref");
    expect(storage.length).toBe(0);
  });
  it("sends a TMA team token for server-side first-login attribution and marks only a new account for auto-join", async () => {
    const token = "a".repeat(32);
    const transport = vi.fn().mockResolvedValueOnce(response({ ...user, new_account: true })).mockResolvedValueOnce(response(user));
    const client = new ApiClient("https://api.test", transport);
    const invitation = { ...context, entry: { ...context.entry, inviteToken: token } };
    const first = await client.telegram("signed-init-data", invitation);
    expect(transport.mock.calls[0][1].body).toBe(`referrer_id=urref&invite_token=${token}`);
    expect(first.user.signupInviteToken).toBe(token);
    const existing = await client.telegram("signed-init-data", invitation);
    expect(existing.user.signupInviteToken).toBeUndefined();
  });
  it("does not send prototype referrers or fabricate Telegram identity", async () => {
    const transport = vi.fn().mockResolvedValue(response(user));
    const client = new ApiClient("https://api.test", transport);
    await expect(client.telegram("", context)).rejects.toThrow(
      "Telegram Mini App link",
    );
    expect(transport).not.toHaveBeenCalled();
    await client.telegram("raw", {
      ...context,
      entry: { ...context.entry, referrerId: "player_42" },
    });
    expect(transport.mock.calls[0][1].body).toBe("referrer_id=");
  });
  it("restores by checking token and reloading the user, scoped to the API base", async () => {
    const storage = memoryStorage();
    const transport = vi
      .fn()
      .mockResolvedValueOnce(response({enabled:false}))
      .mockResolvedValueOnce(response({ ...account, token: "refreshed" }))
      .mockResolvedValueOnce(response(user));
    new ApiClient("https://api.test", transport, storage).remember({
      kind: "authenticated",
      user: { id: "ur1", name: "P", mode: "live" },
      credential: { kind: "account", accountId: "AC1", token: "old" },
    });
    const client = new ApiClient("https://api.test", transport, storage);
    const restored = await client.session(context);
    expect(transport.mock.calls[1][0]).toBe("https://api.test/acc/check_token");
    expect(restored?.credential.token).toBe("refreshed");
    transport.mockResolvedValueOnce(response({enabled:false}));
    expect(
      await new ApiClient("https://other.test", transport, storage).session(
        context,
      ),
    ).toBeNull();
    client.logout();
    expect(storage.length).toBe(0);
  });
  it("clears expired stored credentials but preserves them on network failures", async () => {
    const storage = memoryStorage();
    const transport = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("network"))
      .mockResolvedValueOnce(response({enabled:false}))
      .mockResolvedValueOnce(response(null, 401, 10002));
    const client = new ApiClient("https://api.test", transport, storage);
    client.remember({
      kind: "authenticated",
      user: { id: "ur1", name: "P", mode: "live" },
      credential: { kind: "account", accountId: "AC1", token: "old" },
    });
    await expect(client.session(context)).rejects.toThrow("Could not reach");
    expect(storage.length).toBe(1);
    await expect(client.session(context)).rejects.toThrow("session expired");
    expect(storage.length).toBe(0);
  });
  it.each([
    [503, 11006, "Email delivery"],
    [403, 11004, "frozen"],
    [429, 10005, "Too many"],
    [400, 11005, "incorrect or expired"],
    [200, 11002, "Incorrect email"],
  ])("handles status %s code %s", async (status, code, message) => {
    const client = new ApiClient(
      "https://api.test",
      vi
        .fn()
        .mockResolvedValue(response(null, status as number, code as number)),
    );
    await expect(client.sendVerification("AC1")).rejects.toThrow(
      message as string,
    );
  });
  it("rejects malformed envelopes/users and hides raw server errors", async () => {
    const client = new ApiClient(
      "https://api.test",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ code: -1, msg: "secret-password", data: null }),
            { status: 500 },
          ),
        ),
    );
    try {
      await client.sendVerification("AC1");
      throw new Error("expected failure");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as Error).message).not.toContain("secret");
    }
    await expect(
      new ApiClient(
        "https://api.test",
        vi.fn().mockResolvedValue(response({ id: 4 })),
      ).telegram("raw", context),
    ).rejects.toThrow("invalid");
    await expect(new ApiClient("").login("a", "b", context)).rejects.toThrow(
      "not been configured",
    );
  });
  it("cancellation rejects late transport results without committing a session", async () => {
    let finish!: (r: Response) => void;
    const transport = vi.fn(
      () =>
        new Promise<Response>((r) => {
          finish = r;
        }),
    );
    const client = new ApiClient("https://api.test", transport);
    const controller = new AbortController();
    const result = client.telegram("raw", context, controller.signal);
    controller.abort();
    finish(response(user));
    await expect(result).rejects.toMatchObject({ name: "AbortError" });
  });
  it("times out slow requests", async () => {
    vi.useFakeTimers();
    try {
      const transport = vi.fn(
        (_url: unknown, options?: RequestInit) =>
          new Promise<Response>((_resolve, reject) =>
            options?.signal?.addEventListener("abort", () =>
              reject(new DOMException("aborted", "AbortError")),
            ),
          ),
      );
      const result = new ApiClient(
        "https://api.test",
        transport,
      ).sendVerification("AC1");
      const assertion = expect(result).rejects.toThrow("timed out");
      await vi.advanceTimersByTimeAsync(12001);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });
});
