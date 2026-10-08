// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
vi.mock("./lib/api", async (original) => {
  const mod = await original<typeof import("./lib/api")>();
  return {
    ...mod,
    liveAuth: true,
    api: new mod.ApiClient("https://auth.p2l.test/api/v1"),
  };
});
import App from "./App";
import { api } from "./lib/api";
const account = {
  account_id: "AC1",
  username: "player@example.test",
  type: 1,
  status: 1,
  token: "test-token",
  display_name: "Live Player",
};
const liveUser = {
  nickname: "Live Player",
  id: "ur1",
  channel_id: "AC1",
  display_name: "Live Player",
  from: 2,
};
const reply = (data: unknown, status = 200, code = 0) =>
  new Response(JSON.stringify({ code, msg: "server message", data }), {
    status,
  });
let transport: ReturnType<typeof vi.fn>;
function mount(path = "/profile") {
  window.history.replaceState({}, "", path);
  return render(
    <BrowserRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <App />
    </BrowserRouter>,
  );
}
async function open() {
  fireEvent.click(screen.getByRole("button", { name: "Save your identity" }));
  await waitFor(() =>
    expect(
      (
        within(screen.getByRole("dialog")).getByRole("button", {
          name: "Sign in",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false),
  );
}
function field(label: string, value: string) {
  fireEvent.change(
    within(screen.getByRole("dialog")).getByLabelText(label, { exact: true }),
    { target: { value } },
  );
}
function click(name: string) {
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", {
      name,
    }),
  );
}
function submitCredentials() {
  field("Email address", account.username);
  field("Password", "password123");
  click("Sign in");
}
beforeEach(() => {
  api.logout();
  localStorage.clear();
  sessionStorage.clear();
  delete window.Telegram;
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  transport = vi.fn(async (url: string) => {
    if (url.endsWith("/user/memberships"))
      return reply({ items: [], next_cursor: "" });
    if (url.endsWith("/campaigns/phood"))
      return reply({
        id: "cp1",
        slug: "phood",
        name: "PAPERHOOD",
        ticker: "PHOOD",
        category: "Game",
        description: "Test",
        stage: "prelaunch",
        target: 10000,
        color: "#d2fa69",
        symbol: "PH",
        availability: {
          join_open: true,
          scoring_open: true,
          state: "open",
          server_time: new Date().toISOString(),
        },
      });
    if (url.endsWith("/campaigns/phood/teams"))
      return reply({
        items: [
          {
            id: "tm1",
            name: "Alice Army",
            handle: "@alice",
            initial: "A",
            color: "#d2fa69",
            description: "Test team",
            players: 0,
          },
        ],
      });
    if (url.endsWith("/campaigns/phood/membership"))
      return reply({ membership: null });
    if (url.endsWith("/user/tg_login")) return reply(liveUser);
    if (url.endsWith("/acc/create"))
      return reply({ ...account, status: 0, token: "" });
    if (
      url.endsWith("/acc/login") ||
      url.endsWith("/acc/check_token") ||
      url.endsWith("/acc/verify_email")
    )
      return reply(account);
    return reply("");
  });
  vi.stubGlobal("fetch", (url:string,options?:RequestInit)=>(url.endsWith('/auth/telegram/config')||url.endsWith('/auth/session/config'))?Promise.resolve(reply({enabled:false})):(options?.headers as Record<string,string>)?.['X-P2L-Session']==='cookie'?Promise.resolve(reply(null,401,10002)):transport(url,options));
});
afterEach(() => {
  cleanup();
  api.logout();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe("live client flows without sending mail", () => {
  it("signs in, restores on refresh, signs out locally and switches accounts", async () => {
    mount();
    expect(screen.queryByRole("button", { name: "Connect Wallet" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Wallet connection" })).toBeNull();
    await open();
    submitCredentials();
    await screen.findByRole("heading", { name: "Live Player" });
    expect(screen.queryByRole("button", { name: "Connect Wallet" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Wallet connection" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "My teams by campaign" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Practice history on this device" })).toBeNull();
    expect(
      screen.getByText("LIVE CAMPAIGNS & RANKINGS"),
    ).toBeTruthy();
    cleanup();
    mount();
    await screen.findByRole("heading", { name: "Live Player" });
    expect(
      transport.mock.calls.some(([url]) => url.endsWith("/acc/check_token")),
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(screen.getByRole("heading", { name: "Guest player" })).toBeTruthy();
    expect(transport.mock.calls.some(([url]) => url.includes("logout"))).toBe(
      false,
    );
    transport.mockImplementation(async (url: string) =>
      reply(
        url.endsWith("/user/tg_login")
          ? { ...liveUser, id: "ur2", nickname: "Second Player", display_name: "Second Player" }
          : { ...account, account_id: "AC2", token: "second-token" },
      ),
    );
    await open();
    submitCredentials();
    await screen.findByRole("heading", { name: "Second Player" });
    expect(localStorage.getItem("p2l.preview.v1")).toBeNull();
  });
  it("does not authenticate unvalidated HTTP 200 responses; activates with a letter/number code", async () => {
    transport.mockImplementation(async (url: string) =>
      reply(
        url.endsWith("/acc/login")
          ? { ...account, status: 0, token: "" }
          : url.endsWith("/acc/verify_email")
            ? account
            : url.endsWith("/user/tg_login")
              ? liveUser
              : "",
      ),
    );
    mount();
    await open();
    submitCredentials();
    await screen.findByRole("heading", { name: "Activate your email" });
    expect(
      transport.mock.calls.some(([url]) => url.endsWith("/user/tg_login")),
    ).toBe(false);
    field("Verification code", "ab2cd3");
    click("Verify and sign in");
    await screen.findByRole("heading", { name: "Live Player" });
    const options = transport.mock.calls.find(([url]) =>
      url.endsWith("/acc/verify_email"),
    )![1] as RequestInit;
    expect(JSON.parse(options.body as string).code).toBe("AB2CD3");
  });
  it("automatically requests activation email and reports disabled delivery honestly", async () => {
    const defaultTransport = transport.getMockImplementation()!;
    transport.mockImplementation((url: string) => url.endsWith("/acc/send_email") ? Promise.resolve(reply(null, 503, 11006)) : defaultTransport(url));
    mount();
    await open();
    click("Create an account");
    field("Email address", account.username);
    field("Password", "password123");
    field("Confirm password", "password123");
    click("Create account");
    await screen.findByRole("heading", { name: "Activate your email" });
    await screen.findByRole("alert");
    expect(transport.mock.calls.filter(([url]) => url.endsWith("/acc/send_email"))).toHaveLength(1);
    expect((screen.getByRole("button", {name: /Resend code in/}) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("alert").textContent).toContain(
      "Email delivery is currently unavailable",
    );
    expect(screen.queryByText(/Activation code sent/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Sign out" })).toBeNull();
  });
  it("tests password reset without signing the user in or storing the password", async () => {
    mount();
    await open();
    click("Forgot password?");
    field("Email address", account.username);
    click("Send reset code");
    await screen.findByRole("heading", { name: "Choose a new password" });
    field("Verification code", "AB2CD3");
    field("New password", "new-password123");
    field("Confirm password", "new-password123");
    click("Update password");
    await screen.findByText(
      "Password updated. Sign in with your new password.",
    );
    expect(screen.queryByRole("button", { name: "Sign out" })).toBeNull();
    expect(
      JSON.stringify({ ...sessionStorage, ...localStorage }),
    ).not.toContain("new-password123");
  });
  it("validates password confirmation before making a request", async () => {
    mount();
    await open();
    click("Create an account");
    field("Email address", account.username);
    field("Password", "password123");
    field("Confirm password", "different123");
    click("Create account");
    expect(screen.getByRole("alert").textContent).toContain("do not match");
    expect(transport).not.toHaveBeenCalled();
  });
  it("keeps invitation context but never promotes demo memberships or permissions", async () => {
    localStorage.setItem(
      "p2l.preview.v1",
      JSON.stringify({
        demoUser: { id: "demo1", name: "Fake", mode: "demo" },
        memberships: { phood: "alice" },
        kolRequests: { ur1: { status: "approved" } },
      }),
    );
    mount("/campaign/phood?team=alice&ref=urref&src=x");
    fireEvent.click(screen.getByRole("link", { name: /Profile/ }));
    await open();
    submitCredentials();
    await screen.findByRole("heading", { name: "Live Player" });
    const practice = JSON.parse(localStorage.getItem("p2l.practice.v1")!);
    expect(practice.memberships).toEqual({});
    expect(practice.kolRequests).toEqual({});
    expect(practice.demoUser).toBeNull();
    expect(
      JSON.parse(localStorage.getItem("p2l.preview.v1")!).memberships.phood,
    ).toBe("alice");
    expect(
      JSON.parse(sessionStorage.getItem("p2l.attribution.v1")!).phood,
    ).toMatchObject({
      campaignId: "phood",
      teamId: "alice",
      referrerId: "urref",
      source: "x",
    });
  });
  it("ignores a late sign-in result after the dialog is cancelled", async () => {
    let resolve!: (response: Response) => void;
    transport.mockImplementationOnce(
      () =>
        new Promise<Response>((r) => {
          resolve = r;
        }),
    );
    mount();
    await open();
    submitCredentials();
    click("Close dialog");
    await act(async () => resolve(reply(account)));
    expect(screen.queryByRole("button", { name: "Sign out" })).toBeNull();
    expect(transport).toHaveBeenCalledTimes(1);
    expect(
      Object.keys(sessionStorage).some((key) =>
        key.startsWith("p2l.account-session"),
      ),
    ).toBe(false);
  });
  it("shows network errors and allows a clean retry", async () => {
    transport.mockRejectedValueOnce(new TypeError("offline"));
    mount();
    await open();
    submitCredentials();
    await screen.findByRole("alert");
    expect(screen.getByRole("alert").textContent).toContain("Could not reach");
    click("Sign in");
    await screen.findByRole("heading", { name: "Live Player" });
  });
  it("uses only current TMA credentials, never stored web credentials", async () => {
    api.remember({
      kind: "authenticated",
      user: { id: "old", name: "Old", mode: "live" },
      credential: {
        kind: "account",
        accountId: "ACold",
        token: "old-web-token",
      },
    });
    window.Telegram = { WebApp: { initData: "signed-current-launch" } };
    mount();
    await screen.findByRole("heading", { name: "Live Player" });
    expect(
      transport.mock.calls.filter(([url]) => url.endsWith("/user/tg_login")),
    ).toHaveLength(1);
    expect((transport.mock.calls[0][1] as RequestInit).headers).toMatchObject({
      Authorization: "tma signed-current-launch",
    });
    expect(
      Object.keys(sessionStorage).some((key) =>
        key.startsWith("p2l.account-session"),
      ),
    ).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    fireEvent.click(screen.getByRole("button", { name: "Save your identity" }));
    expect(screen.queryByLabelText("Email address")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Continue with Telegram" }),
    ).toBeTruthy();
  });
  it("keeps a refreshed TMA tab out of email login and retries recovered SDK data", async () => {
    sessionStorage.setItem("p2l.telegram-tab.v1", "1");
    mount("/profile");
    await act(async () => {
      document.querySelector('script[src*="telegram.org"]')!.dispatchEvent(new Event("error"));
    });
    fireEvent.click(screen.getByRole("button", { name: "Save your identity" }));
    expect(screen.queryByLabelText("Email address")).toBeNull();
    expect(screen.getByRole("button", { name: "Continue with Telegram" })).toBeTruthy();
    window.Telegram = { WebApp: { initData: "recovered-launch" } };
    fireEvent.click(screen.getByRole("button", { name: "Continue with Telegram" }));
    await screen.findByRole("heading", { name: "Live Player" });
    const login=transport.mock.calls.find(([url]) => url.endsWith("/user/tg_login"));
    expect((login![1] as RequestInit).headers).toMatchObject({Authorization:"tma recovered-launch"});
  });
  it("requires an explicit join after login and never writes demo memberships", async () => {
    mount("/campaign/phood/teams?team=alice&ref=urref&src=x");
    fireEvent.click(await screen.findByRole("button", { name: /^Join / }));
    await waitFor(() =>
      expect(
        (
          within(screen.getByRole("dialog")).getByRole("button", {
            name: "Sign in",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false),
    );
    submitCredentials();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await screen.findByRole("button", { name: /^Join / });
    expect(transport.mock.calls.some(([url]) => url.endsWith("/join"))).toBe(
      false,
    );
    expect(
      JSON.parse(localStorage.getItem("p2l.practice.v1")!).memberships,
    ).toEqual({});
    expect(
      JSON.parse(sessionStorage.getItem("p2l.attribution.v1")!).phood
        .referrerId,
    ).toBe("urref");
  });
  it("joins with the authenticated identity and restores membership on refresh", async () => {
    const original = transport.getMockImplementation()!;
    let member: null | { id: string; team_id: string; joined_at: string } =
      null;
    transport.mockImplementation(async (url: string) => {
      if (url.endsWith("/campaigns/phood/membership"))
        return reply({ membership: member });
      if (url.endsWith("/teams/tm1/join")) {
        member = {
          id: "mb1",
          team_id: "tm1",
          joined_at: new Date().toISOString(),
        };
        return reply(member);
      }
      return original(url);
    });
    const view = mount("/campaign/phood/teams");
    fireEvent.click(await screen.findByRole("button", { name: /^Join / }));
    await waitFor(() =>
      expect(
        (
          within(screen.getByRole("dialog")).getByRole("button", {
            name: "Sign in",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false),
    );
    submitCredentials();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const join = await screen.findByRole("button", { name: /^Join / });
    fireEvent.click(join);
    fireEvent.click(join);
    await screen.findByText("Your team · Joined");
    const calls = transport.mock.calls.filter(([url]) => url.endsWith("/join"));
    expect(calls).toHaveLength(1);
    expect((calls[0][1] as RequestInit).headers).toMatchObject({
      Authorization: "bearer test-token",
    });
    expect(JSON.parse((calls[0][1] as RequestInit).body as string)).toEqual({});
    view.unmount();
    mount("/campaign/phood/teams");
    await screen.findByText("Your team · Joined");
    expect(
      JSON.parse(localStorage.getItem("p2l.practice.v1")!).memberships,
    ).toEqual({});
  });
  it("drops a cancelled pending join even when signing in successfully later", async () => {
    mount("/campaign/phood/teams?team=alice");
    fireEvent.click(await screen.findByRole("button", { name: /^Join / }));
    click("Close dialog");
    fireEvent.click(screen.getByRole("link", { name: /Profile/ }));
    await open();
    submitCredentials();
    await screen.findByRole("heading", { name: "Live Player" });
    expect(screen.queryByText(/no team was joined/)).toBeNull();
    expect(
      JSON.parse(localStorage.getItem("p2l.practice.v1")!).memberships,
    ).toEqual({});
  });
  it("does not submit local practice scores using a live user ID", async () => {
    localStorage.setItem(
      "p2l.practice.v1",
      JSON.stringify({
        runs: [
          {
            id: "run_live",
            campaignId: "phood",
            score: 100,
            trades: 2,
            created: Date.now(),
            saved: false,
          },
        ],
      }),
    );
    mount("/campaign/phood/result/run_live");
    fireEvent.click(screen.getByRole("button", { name: "Save score" }));
    await waitFor(() =>
      expect(
        (
          within(screen.getByRole("dialog")).getByRole("button", {
            name: "Sign in",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false),
    );
    submitCredentials();
    await screen.findByText(
      "This practice round stays on your device. Start a ranked game from the campaign page to submit an accepted score.",
    );
    const local = JSON.parse(localStorage.getItem("p2l.practice.v1")!);
    expect(local.runs[0].saved).toBe(false);
    expect(local.competition.submitted).not.toContain("run_live");
    expect(
      local.competition.players.some(
        (p: { userId: string }) => p.userId === "ur1",
      ),
    ).toBe(false);
  });
  it("survives malformed stored practice data", () => {
    localStorage.setItem(
      "p2l.practice.v1",
      JSON.stringify({ runs: { invalid: true } }),
    );
    mount();
    expect(screen.getByRole("heading", { name: "Guest player" })).toBeTruthy();
  });
});
