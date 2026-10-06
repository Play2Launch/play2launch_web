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
 it('exchanges, persists and restores a Telegram web session without TMA data',async()=>{
  const token='a'.repeat(43),storage=memoryStorage();
  const transport=vi.fn().mockResolvedValueOnce(response({token})).mockImplementation(async()=>response({...user,from:1,channel_id:'123',display_name:'Telegram Player'}));
  const client=new ApiClient('https://api.test',transport,storage);
  const result=await client.telegramExchange('ticket','verifier',context);
  expect(result.credential).toEqual({kind:'webtelegram',token});expect(storage.length).toBe(0);
  client.remember(result);
  const restored=await new ApiClient('https://api.test',transport,storage).session(context);
  expect(restored?.user.id).toBe('ur1');
  expect(transport.mock.calls[2][1].headers.Authorization).toBe('p2l '+token);
  client.logout();expect(storage.length).toBe(0);
  expect(transport.mock.calls[3][0]).toBe('https://api.test/auth/telegram/logout');
 });
  it('retains the public avatar for account and Telegram login',async()=>{
    const transport=vi.fn().mockResolvedValueOnce(response(account)).mockResolvedValueOnce(response({...user,avatar_url:'https://example.com/avatar.png'})).mockResolvedValueOnce(response({...user,avatar_url:'https://example.com/tg.png'}));
    const client=new ApiClient('https://api.test',transport);
    const result=await client.login('p','pass',context);
    expect(result.kind==='authenticated'&&result.user.avatarUrl).toBe('https://example.com/avatar.png');
    const tg=await client.telegram('signed-init-data',context);
    expect(tg.user.avatarUrl).toBe('https://example.com/tg.png');
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
      .mockResolvedValueOnce(response({ ...account, token: "refreshed" }))
      .mockResolvedValueOnce(response(user));
    new ApiClient("https://api.test", transport, storage).remember({
      kind: "authenticated",
      user: { id: "ur1", name: "P", mode: "live" },
      credential: { kind: "account", accountId: "AC1", token: "old" },
    });
    const client = new ApiClient("https://api.test", transport, storage);
    const restored = await client.session(context);
    expect(transport.mock.calls[0][0]).toBe("https://api.test/acc/check_token");
    expect(restored?.credential.token).toBe("refreshed");
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
