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
import App from "./App";
import { encodeStart } from "./lib/entry";
import { applyForKol, reviewKol } from "./lib/verification";

function mount(path = "/") {
  window.history.replaceState({}, "", path);
  return render(
    <BrowserRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <App />
    </BrowserRouter>,
  );
}
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  delete window.Telegram;
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
describe("complete prototype flows", () => {
  it("hides demo controls by default and toggles them without resetting data", () => {
    mount("/profile");
    expect(screen.queryByRole("button", { name: /PROTOTYPE/ })).toBeNull();
    expect(screen.getByText("TEST DATA · NO REAL TOKENS")).toBeTruthy();
    const before = localStorage.getItem("p2l.preview.v1");
    fireEvent.click(screen.getByText("Prototype settings"));
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Enable demo controls" }),
    );
    expect(screen.getByRole("button", { name: /PROTOTYPE/ })).toBeTruthy();
    cleanup();
    mount("/profile");
    fireEvent.click(screen.getByRole("button", { name: /PROTOTYPE/ }));
    expect(
      screen.getByRole("combobox", { name: "Campaign stage" }),
    ).toBeTruthy();
    fireEvent.click(screen.getByText("Prototype settings"));
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Enable demo controls" }),
    );
    expect(
      screen.queryByRole("combobox", { name: "Campaign stage" }),
    ).toBeNull();
    expect(localStorage.getItem("p2l.preview.v1")).toBe(before);
    cleanup();
    mount("/campaign/phood");
    expect(screen.queryByRole("button", { name: /PROTOTYPE/ })).toBeNull();
  });
  it("collapses detailed rules while keeping progress and deadline visible", () => {
    mount("/campaign/phood");
    const details = document.querySelector(
      ".competition-details",
    ) as HTMLDetailsElement;
    expect(details.open).toBe(false);
    expect(screen.getByText(/Not qualified yet/).closest("details")).toBeNull();
    expect(
      screen.getByRole("heading", { name: "Your campaign progress" }),
    ).toBeTruthy();
    fireEvent.click(screen.getByText("How scoring & teams work"));
    expect(details.open).toBe(true);
  });
  it("explains platform-only campaign publishing without a Creator entry", () => {
    mount("/verification");
    expect(screen.getByText("Platform-managed campaigns")).toBeTruthy();
    expect(
      screen.getByText(
        /Only platform administrators can create, publish or take down campaigns/,
      ),
    ).toBeTruthy();
    expect(
      screen.queryByRole("link", {
        name: /Creator|Create campaign|Publish campaign/i,
      }),
    ).toBeNull();
  });
  it("creates an approved captain team, preserves it on reload and shares campaign-scoped invitations", () => {
    sessionStorage.setItem("p2l.demo-controls", "true");
    const user = { id: "demo_captain", name: "Captain", mode: "demo" };
    const approval = reviewKol(
      applyForKol(undefined, user.id, {
        displayName: "Captain",
        socialUrl: "https://x.com/demo_captain",
        introduction: "A local test community that enjoys multiplayer games.",
      }),
      "approved",
      "",
    );
    localStorage.setItem(
      "p2l.preview.v1",
      JSON.stringify({ demoUser: user, kolRequests: { [user.id]: approval } }),
    );
    mount("/captain");
    fireEvent.change(screen.getByLabelText("Team name"), {
      target: { value: "Paper pioneers" },
    });
    fireEvent.change(screen.getByLabelText("Team introduction"), {
      target: { value: "A test crew learning to trade badly together." },
    });
    fireEvent.click(screen.getByRole("button", { name: /Create team & join/ }));
    expect(
      screen.getByRole("heading", { name: "Paper pioneers" }),
    ).toBeTruthy();
    let data = JSON.parse(localStorage.getItem("p2l.preview.v1")!);
    const team = data.captainTeams[0];
    expect(data.memberships.phood).toBe(team.id);
    expect(data.competition.players).toHaveLength(0);
    fireEvent.click(
      screen.getByRole("button", { name: "Invite to this team" }),
    );
    const invite = (
      screen.getByRole("textbox", { name: "Invite link" }) as HTMLInputElement
    ).value;
    expect(invite).toContain(`team=${team.id}`);
    expect(invite).toContain("ref=demo_captain");
    fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
    fireEvent.click(
      screen.getByRole("button", { name: /PROTOTYPE \/ SAMPLE DATA/ }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Simulate invited player + valid round",
      }),
    );
    expect(screen.getByRole("cell", { name: "12,500" })).toBeTruthy();
    cleanup();
    mount("/captain");
    expect(
      screen.getByRole("heading", { name: "Paper pioneers" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: /Create team & join/ }),
    ).toBeNull();
    cleanup();
    mount(`/campaign/phood?team=${team.id}&ref=demo_captain&src=share`);
    expect(
      screen.getByRole("heading", { name: "Paper pioneers" }),
    ).toBeTruthy();
    expect(JSON.parse(sessionStorage.getItem("p2l.entry.v1")!).teamId).toBe(
      team.id,
    );
    cleanup();
    mount(`/campaign/topfrog?team=${team.id}`);
    expect(
      JSON.parse(sessionStorage.getItem("p2l.entry.v1")!).teamId,
    ).toBeUndefined();
    cleanup();
    mount("/captain?campaign=topfrog");
    expect(
      screen.getByRole("button", { name: /Create team & join/ }),
    ).toBeTruthy();
    cleanup();
    // Separate visitor fixture shares the mock catalog, as a future server would.
    // This does not add multi-account support to the device-local product UI.
    const catalog = JSON.parse(localStorage.getItem("p2l.preview.v1")!);
    localStorage.setItem(
      "p2l.preview.v1",
      JSON.stringify({
        ...catalog,
        demoUser: { id: "demo_visitor", name: "Invited player", mode: "demo" },
        memberships: {},
        runs: [
          {
            id: "visitor_run",
            campaignId: "phood",
            score: 500,
            trades: 1,
            created: Date.now(),
            saved: false,
          },
        ],
      }),
    );
    mount(`/campaign/phood?team=${team.id}&ref=demo_captain&src=share`);
    expect(
      JSON.parse(localStorage.getItem("p2l.preview.v1")!).memberships.phood,
    ).toBeUndefined();
    fireEvent.click(
      screen.getByRole("button", { name: /Join Paper pioneers/ }),
    );
    expect(
      JSON.parse(localStorage.getItem("p2l.preview.v1")!).memberships.phood,
    ).toBe(team.id);
    cleanup();
    mount("/campaign/phood/result/visitor_run");
    fireEvent.click(screen.getByRole("button", { name: "Save score" }));
    const submitted = JSON.parse(localStorage.getItem("p2l.preview.v1")!);
    expect(
      submitted.competition.players.find(
        (p: { userId: string }) => p.userId === "demo_visitor",
      ),
    ).toMatchObject({ campaignId: "phood", teamId: team.id, best: 500 });
    expect(
      submitted.competition.players.filter(
        (p: { teamId: string }) => p.teamId === team.id,
      ),
    ).toHaveLength(2);
    expect(
      (
        screen.getByRole("button", {
          name: "Saved locally",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(JSON.parse(sessionStorage.getItem("p2l.entry.v1")!).referrerId).toBe(
      "demo_captain",
    );
  });
  it("blocks captain creation for guests and non-approved profiles", () => {
    mount("/captain");
    expect(screen.queryByLabelText("Team name")).toBeNull();
    cleanup();
    localStorage.setItem(
      "p2l.preview.v1",
      JSON.stringify({
        demoUser: { id: "demo_unapproved", name: "Player", mode: "demo" },
      }),
    );
    mount("/captain");
    expect(
      screen.getByRole("heading", { name: "KOL approval required" }),
    ).toBeTruthy();
    expect(screen.queryByLabelText("Team name")).toBeNull();
  });
  it("requires login for KOL application and simulates review, persistence and revocation", async () => {
    sessionStorage.setItem("p2l.demo-controls", "true");
    mount("/verification");
    expect(
      screen.queryByRole("button", { name: "Submit application" }),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Sign in to apply/ }));
    fireEvent.click(
      screen.getByRole("button", { name: "Continue with demo profile" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.change(screen.getByLabelText("Public social profile"), {
      target: { value: "https://x.com/demo_captain" },
    });
    fireEvent.change(screen.getByLabelText("Community introduction"), {
      target: {
        value: "A local test community that enjoys multiplayer games.",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit application" }));
    expect(screen.getByRole("heading", { name: "Under review" })).toBeTruthy();
    expect(screen.queryByText("KOL VERIFIED · DEMO")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Simulate approval" }),
    ).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: /PROTOTYPE \/ SAMPLE DATA/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Simulate rejection" }));
    expect(screen.getByRole("alert")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Review reason"), {
      target: { value: "Please clarify your community" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Simulate rejection" }));
    expect(
      screen.getByRole("heading", { name: "Changes requested" }),
    ).toBeTruthy();
    expect(
      screen.getByLabelText("Public social profile").getAttribute("value"),
    ).toBe("https://x.com/demo_captain");
    fireEvent.click(
      screen.getByRole("button", { name: "Resubmit application" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Simulate approval" }));
    expect(screen.getByText("KOL VERIFIED · DEMO")).toBeTruthy();
    cleanup();
    mount("/profile");
    expect(screen.getByText("KOL VERIFIED · DEMO")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: /PROTOTYPE \/ SAMPLE DATA/ }),
    );
    fireEvent.change(screen.getByLabelText("Review reason"), {
      target: { value: "Account ownership needs rechecking" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Simulate revocation" }),
    );
    expect(screen.queryByText("KOL VERIFIED · DEMO")).toBeNull();
    expect(
      Object.values(
        JSON.parse(localStorage.getItem("p2l.preview.v1")!).kolRequests,
      )[0],
    ).toMatchObject({ status: "revoked" });
  });
  it("labels global routes independently of the last campaign", () => {
    mount("/teams");
    expect(document.title).toBe("My teams · PLAY TO LAUNCH");
    cleanup();
    mount("/profile");
    expect(document.title).toBe("Profile · PLAY TO LAUNCH");
  });
  it("locks the first campaign team and leaves other campaign choices available", async () => {
    mount("/campaign/phood/teams?selected=alice");
    fireEvent.click(screen.getByRole("button", { name: /Join Alice Army/ }));
    fireEvent.click(
      screen.getByRole("button", { name: "Continue with demo profile" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    cleanup();
    mount("/campaign/phood/teams?selected=bob");
    expect(
      (screen.getByRole("button", { name: /Team locked/ }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      JSON.parse(localStorage.getItem("p2l.preview.v1")!).memberships.phood,
    ).toBe("alice");
    cleanup();
    mount("/campaign/topfrog/teams?selected=bob");
    expect(
      (
        screen.getByRole("button", {
          name: /Join Bob Gang/,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });
  it("shows an unlocked campaign without asking players to unlock again", () => {
    localStorage.setItem(
      "p2l.preview.v1",
      JSON.stringify({ stages: { phood: "ready" } }),
    );
    mount("/campaign/phood");
    expect(screen.getByText("You played. We unlocked.")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Play to unlock/ })).toBeNull();
    expect(screen.getByRole("link", { name: /Play again/ })).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /View launch progress/ }),
    ).toBeTruthy();
    cleanup();
    mount("/campaign/phood/launch");
    expect(document.querySelectorAll(".milestone-done")).toHaveLength(3);
    cleanup();
    mount("/");
    expect(
      document
        .querySelector(".hero-progress .progress-track i")
        ?.getAttribute("style"),
    ).toContain("82.14%");
    expect(document.querySelector(".genesis-card")?.getAttribute("href")).toBe(
      "/campaign/phood/launch",
    );
  });
  it("keeps an expired countdown waiting for confirmation across routes", () => {
    localStorage.setItem(
      "p2l.preview.v1",
      JSON.stringify({
        stages: { phood: "countdown" },
        launchTimes: { phood: Date.now() - 5000 },
      }),
    );
    mount("/campaign/phood");
    expect(
      screen.getByText(
        "Countdown complete. Awaiting a confirmed launch status.",
      ),
    ).toBeTruthy();
    cleanup();
    mount("/campaign/phood/launch");
    expect(
      screen.getByText(
        "Countdown complete. Awaiting a confirmed launch status.",
      ),
    ).toBeTruthy();
    expect(
      screen.queryByText("Launch state preview · no live token"),
    ).toBeNull();
    expect(document.querySelectorAll(".milestone-done")).toHaveLength(3);
    expect(
      JSON.parse(localStorage.getItem("p2l.preview.v1")!).stages.phood,
    ).toBe("countdown");
  });
  it("does not invent a countdown when a launch schedule is absent", () => {
    localStorage.setItem(
      "p2l.preview.v1",
      JSON.stringify({ stages: { phood: "countdown" } }),
    );
    mount("/campaign/phood/launch");
    expect(
      screen.getByText("Waiting for a confirmed launch schedule."),
    ).toBeTruthy();
    expect(document.querySelector(".countdown")).toBeNull();
  });
  it("keeps different team memberships in different campaigns and displays their mapping", async () => {
    mount("/campaign/phood/teams?selected=alice");
    fireEvent.click(screen.getByRole("button", { name: /Join Alice Army/ }));
    fireEvent.click(
      screen.getByRole("button", { name: "Continue with demo profile" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    cleanup();
    mount("/campaign/topfrog/teams?selected=bob");
    fireEvent.click(screen.getByRole("button", { name: /Join Bob Gang/ }));
    await waitFor(() =>
      expect(
        JSON.parse(localStorage.getItem("p2l.preview.v1")!).memberships,
      ).toEqual({ phood: "alice", topfrog: "bob" }),
    );
    cleanup();
    mount("/teams");
    const phood = screen.getByRole("article", { name: "PAPERHOOD membership" });
    expect(within(phood).getByText("Alice Army")).toBeTruthy();
    expect(within(phood).queryByText("Bob Gang")).toBeNull();
    expect(screen.getByText("Bob Gang")).toBeTruthy();
    expect(screen.getAllByText("No team yet")).toHaveLength(2);
    expect(
      within(phood)
        .getByRole("link", { name: "View my team" })
        .getAttribute("href"),
    ).toBe("/campaign/phood/teams?selected=alice");
    cleanup();
    mount("/profile");
    expect(screen.getByText("Alice Army")).toBeTruthy();
    expect(screen.getByText("Bob Gang")).toBeTruthy();
  });
  it("renders a fresh Web visit without authentication or Telegram", () => {
    mount();
    expect(screen.getByText("Early looks good on you")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeTruthy();
    expect(document.querySelector(".runtime-web")).toBeTruthy();
  });
  it("filters campaigns and clears an empty result", () => {
    mount();
    fireEvent.change(
      screen.getByRole("textbox", { name: "Search campaigns" }),
      { target: { value: "unfindable" } },
    );
    expect(screen.getByText("No projects found")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(document.querySelectorAll(".campaign-card")).toHaveLength(4);
  });
  it("retains a KOL invitation across login and team membership without auto-joining", async () => {
    mount("/phood/alice?ref=player_42&src=x");
    await waitFor(() =>
      expect(window.location.pathname).toBe("/campaign/phood"),
    );
    expect(
      JSON.parse(localStorage.getItem("p2l.preview.v1")!).memberships.phood,
    ).toBeUndefined();
    fireEvent.click(screen.getByRole("button", { name: "Join Alice Army" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Continue with demo profile" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const local = JSON.parse(localStorage.getItem("p2l.preview.v1")!);
    expect(local.memberships.phood).toBe("alice");
    expect(local.demoUser.mode).toBe("demo");
    expect(JSON.parse(sessionStorage.getItem("p2l.entry.v1")!)).toMatchObject({
      campaignId: "phood",
      teamId: "alice",
      referrerId: "player_42",
      source: "x",
    });
    fireEvent.click(screen.getByRole("link", { name: "See your team" }));
    expect(JSON.parse(sessionStorage.getItem("p2l.entry.v1")!).referrerId).toBe(
      "player_42",
    );
  });
  it("restores campaign attribution after visiting a different project", async () => {
    const view = mount("/phood/alice?ref=player_42&src=x");
    await waitFor(() =>
      expect(window.location.pathname).toBe("/campaign/phood"),
    );
    view.unmount();
    const other = mount("/campaign/orbit");
    expect(
      JSON.parse(sessionStorage.getItem("p2l.entry.v1")!).referrerId,
    ).toBeUndefined();
    other.unmount();
    mount("/campaign/phood");
    expect(JSON.parse(sessionStorage.getItem("p2l.entry.v1")!)).toMatchObject({
      teamId: "alice",
      referrerId: "player_42",
      source: "x",
    });
  });
  it("does not execute a pending join after login is cancelled", () => {
    mount("/campaign/phood?team=alice");
    fireEvent.click(screen.getByRole("button", { name: "Join Alice Army" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Keep playing as a guest" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Continue with demo profile" }),
    );
    expect(
      JSON.parse(localStorage.getItem("p2l.preview.v1")!).memberships.phood,
    ).toBeUndefined();
  });
  it("handles malformed invitations, unknown teams and unknown campaigns", () => {
    const view = mount("/?startapp=broken");
    expect(screen.getByText(/could not read this invitation/)).toBeTruthy();
    view.unmount();
    const teamView = mount("/campaign/phood?team=missing");
    expect(
      screen.getByText(/team in this invitation was not found/),
    ).toBeTruthy();
    teamView.unmount();
    mount("/campaign/does-not-exist");
    expect(
      screen.getByRole("heading", { name: "This page hasn’t launched." }),
    ).toBeTruthy();
  });
  it("loads a TMA deep link and cleans native back listeners", async () => {
    const start = encodeStart({
      campaignId: "phood",
      teamId: "alice",
      referrerId: "player_42",
      source: "telegram",
      target: "campaign",
    });
    const back = {
      show: vi.fn(),
      hide: vi.fn(),
      onClick: vi.fn(),
      offClick: vi.fn(),
    };
    window.Telegram = {
      WebApp: {
        initData: new URLSearchParams({
          start_param: start,
          hash: "test-only",
        }).toString(),
        ready: vi.fn(),
        expand: vi.fn(),
        BackButton: back,
      },
    };
    const view = mount("/");
    await waitFor(() =>
      expect(window.location.pathname).toBe("/campaign/phood"),
    );
    expect(document.querySelector(".runtime-telegram")).toBeTruthy();
    expect(window.Telegram.WebApp?.ready).toHaveBeenCalled();
    expect(back.show).toHaveBeenCalled();
    expect(JSON.parse(sessionStorage.getItem("p2l.entry.v1")!).referrerId).toBe(
      "player_42",
    );
    view.unmount();
    expect(back.offClick).toHaveBeenCalled();
  });
  it("completes a timed round, pauses correctly and saves after login", () => {
    vi.useFakeTimers();
    mount("/campaign/phood/play?team=alice&ref=player_42");
    fireEvent.click(
      screen.getByRole("button", { name: /Let’s make bad decisions/ }),
    );
    act(() => vi.advanceTimersByTime(1000));
    fireEvent.click(screen.getByRole("button", { name: /BUY HIGH Catch/ }));
    act(() => vi.advanceTimersByTime(2000));
    fireEvent.click(screen.getByRole("button", { name: /PANIC SELL/ }));
    fireEvent.click(screen.getByRole("button", { name: "Pause round" }));
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByText("Your timer is paused.")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Resume round" })[0]);
    act(() => vi.advanceTimersByTime(27000));
    expect(window.location.pathname).toMatch(/\/campaign\/phood\/result\//);
    expect(screen.getByText("Trades completed")).toBeTruthy();
    expect(
      JSON.parse(localStorage.getItem("p2l.preview.v1")!).runs,
    ).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Save score" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Continue with demo profile" }),
    );
    const data = JSON.parse(localStorage.getItem("p2l.preview.v1")!);
    expect(data.runs[0].saved).toBe(true);
    expect(data.competition.players).toHaveLength(1);
    expect(data.competition.submitted).toEqual([data.runs[0].id]);
    expect(data.competition.players[0].best).toBe(data.runs[0].score);
    expect(JSON.parse(sessionStorage.getItem("p2l.entry.v1")!).referrerId).toBe(
      "player_42",
    );
  });
  it("does not fabricate a Mini App URL when the Bot is unconfigured", () => {
    mount("/campaign/phood");
    fireEvent.click(screen.getByRole("button", { name: "Share campaign" }));
    const modal = screen.getByRole("dialog");
    const link = within(modal).getByRole("textbox", {
      name: "Invite link",
    }) as HTMLInputElement;
    expect(link.value).toContain("/campaign/phood?src=share");
    fireEvent.click(
      within(modal).getByRole("button", { name: "Mini App link" }),
    );
    expect(
      within(modal).queryByRole("textbox", { name: "Invite link" }),
    ).toBeNull();
    expect(
      within(modal).getByText(/Bot and app name are configured/),
    ).toBeTruthy();
  });
  it("persists launch stage without issuing a real token", () => {
    sessionStorage.setItem("p2l.demo-controls", "true");
    mount("/campaign/phood/launch");
    fireEvent.click(screen.getByRole("button", { name: /PROTOTYPE/ }));
    fireEvent.change(screen.getByRole("combobox", { name: "Campaign stage" }), {
      target: { value: "live" },
    });
    expect(
      screen.getByText("Launch state preview · no live token"),
    ).toBeTruthy();
    expect(
      JSON.parse(localStorage.getItem("p2l.preview.v1")!).stages.phood,
    ).toBe("live");
  });
  it("recovers from a malformed persisted profile", () => {
    localStorage.setItem(
      "p2l.preview.v1",
      JSON.stringify({
        demoUser: { mode: "demo" },
        runs: [null, { score: "bad" }],
      }),
    );
    mount();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeTruthy();
  });
});
