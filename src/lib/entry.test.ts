import { describe, expect, it } from "vitest";
import {
  decodeStart,
  encodeStart,
  resolveEntry,
  shareLinks,
  type EntryContext,
} from "./entry";
import { platformContext } from "./platform";
it('round trips a campaign-independent friend invitation and clears stale team context',()=>{
 const friend:EntryContext={referrerId:'ur123',source:'share',target:'campaign'};
 const links=shareLinks('https://www.play2launch.com',friend,{bot:'p2l_bot'});
 expect(new URL(links.web).pathname).toBe('/ref/ur123');
 expect(new URL(links.web).searchParams.get('team')).toBeNull();
 expect(decodeStart(encodeStart(friend))).toEqual({...friend,source:'telegram'});
 const resolved=resolveEntry(new URL(links.web),'web',{campaignId:'old',teamId:'oldteam',inviteToken:'oldtoken',source:'share',target:'teams'});
 expect(resolved.context).toEqual(friend);
 expect(links.telegram).toContain('startapp=r_ur123');
});
it('keeps old personal links working and validates the new invitation path',()=>{
 expect(resolveEntry(new URL('https://web.test/?ref=ur123'),'web').context.referrerId).toBe('ur123');
 expect(resolveEntry(new URL('https://web.test/ref/ur123?ref=urother'),'web').context.referrerId).toBe('ur123');
 expect(resolveEntry(new URL('https://web.test/ref/invalid'),'web').error).toBeTruthy();
});
const entry: EntryContext = {
  campaignId: "phood",
  teamId: "alice",
  referrerId: "player_42",
  source: "x",
  target: "campaign",
};
describe("distribution and attribution", () => {
  it("opens a clean Web visit without Telegram launch data", () => {
    expect(
      platformContext(undefined, new URL("https://p2l.test/")).runtime,
    ).toBe("web");
    expect(
      resolveEntry(new URL("https://p2l.test/"), "web").context.source,
    ).toBe("direct");
  });
  it("does not mistake the globally loaded Telegram SDK for a TMA session", () => {
    expect(
      platformContext(
        { initData: "", platform: "unknown" },
        new URL("https://p2l.test/"),
      ).runtime,
    ).toBe("web");
  });
  it("canonicalizes a KOL campaign link and retains all attribution", () => {
    const r = resolveEntry(
      new URL("https://p2l.test/phood/alice?ref=player_42&utm_source=x"),
      "web",
    );
    expect(r.destination).toBe("/campaign/phood");
    expect(r.context).toEqual(entry);
  });
  it("preserves referral across play, result, ranking, refresh and UI team selection", () => {
    let previous = entry;
    for (const route of [
      "/campaign/phood/play",
      "/campaign/phood/result/run1",
      "/campaign/phood/leaderboard",
      "/campaign/phood/teams?selected=bob",
      "/profile",
      "/campaign/phood",
    ]) {
      previous = resolveEntry(
        new URL(route, "https://p2l.test"),
        "web",
        previous,
      ).context;
      expect(previous).toMatchObject({
        campaignId: "phood",
        teamId: "alice",
        referrerId: "player_42",
        source: "x",
      });
    }
  });
  it("does not leak one campaign referral into a different campaign", () => {
    expect(
      resolveEntry(new URL("https://p2l.test/campaign/orbit"), "web", entry)
        .context,
    ).toMatchObject({
      campaignId: "orbit",
      teamId: undefined,
      referrerId: undefined,
      source: "direct",
    });
  });
  it("replaces rather than mixes attribution on a new explicit invitation", () => {
    const next = resolveEntry(
      new URL("https://p2l.test/phood/bob"),
      "web",
      entry,
    ).context;
    expect(next.teamId).toBe("bob");
    expect(next.referrerId).toBeUndefined();
  });
  it("round-trips every target through Telegram startapp", () => {
    for (const target of [
      "campaign",
      "play",
      "teams",
      "leaderboard",
      "launch",
    ] as const) {
      const input = { ...entry, target };
      const token = encodeStart(input);
      expect(token.length).toBeLessThanOrEqual(512);
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(decodeStart(token)).toEqual(input);
      expect(
        resolveEntry(new URL(`https://p2l.test/?startapp=${token}`), "telegram")
          .destination,
      ).toBe(
        target === "campaign" ? "/campaign/phood" : `/campaign/phood/${target}`,
      );
    }
  });
  it("extracts start_param from raw initData without claiming verification", () => {
    const raw = new URLSearchParams({
      start_param: encodeStart(entry),
      user: '{"id":123}',
      hash: "not-verified",
    }).toString();
    const p = platformContext({ initData: raw }, new URL("https://p2l.test/"));
    expect(p.runtime).toBe("telegram");
    expect(p.initData).toBe(raw);
    expect(decodeStart(p.start!)).toEqual(entry);
  });
  it("accepts Telegram parameters in the fragment", () => {
    expect(
      resolveEntry(
        new URL(`https://p2l.test/#tgWebAppStartParam=${encodeStart(entry)}`),
        "telegram",
      ).destination,
    ).toBe("/campaign/phood");
  });
  it("rejects malformed, oversized and injection-shaped links without crashing", () => {
    for (const token of [
      "v1_!!!",
      "unknown",
      "v1_" + "a".repeat(600),
      encodeStart({ ...entry, campaignId: "../../evil" }),
    ]) {
      expect(
        resolveEntry(
          new URL(`https://p2l.test/?startapp=${encodeURIComponent(token)}`),
          "web",
        ).error,
      ).toBeTruthy();
    }
    expect(
      resolveEntry(
        new URL("https://p2l.test/phood/alice?ref=%3Cscript%3E"),
        "web",
      ).error,
    ).toBeTruthy();
  });
  it("supports old Web entry paths without mocking Telegram identity", () => {
    expect(
      resolveEntry(
        new URL(
          "https://p2l.test/entry/web/game?game_id=phood&team=alice&ref=player_42",
        ),
        "web",
      ).destination,
    ).toBe("/campaign/phood/play");
    expect(
      resolveEntry(new URL("https://p2l.test/entry/web/game-center"), "web")
        .destination,
    ).toBe("/");
    expect(
      resolveEntry(new URL("https://p2l.test/entry/test/game"), "web").error,
    ).toBeTruthy();
    expect(
      resolveEntry(new URL("https://p2l.test/entry/web/game"), "web").error,
    ).toBeTruthy();
  });
  it("generates real Web URLs and only configured TMA URLs", () => {
    const links = shareLinks("https://p2l.test", entry, {
      bot: "@P2LDemoBot",
      app: "Play",
    });
    expect(links.web).toBe(
      "https://p2l.test/campaign/phood?team=alice&ref=player_42&src=share",
    );
    expect(links.telegram).toMatch(
      /^https:\/\/t.me\/P2LDemoBot\/Play\?startapp=/,
    );
    expect(
      decodeStart(new URL(links.telegram!).searchParams.get("startapp")!),
    ).toMatchObject({
      campaignId: "phood",
      teamId: "alice",
      referrerId: "player_42",
    });
    expect(shareLinks("https://p2l.test", entry, {}).telegram).toBeNull();
    expect(
      shareLinks("https://p2l.test", entry, { bot: "invalid/path" }).telegram,
    ).toBeNull();
  });
  it("routes captain invitations to teams in both web and TMA, preserving attribution across sign-in routes", () => {
    const invite = {
      campaignId: "new-event",
      teamId: "tm123",
      referrerId: "ur123",
      source: "share",
      target: "teams" as const,
    };
    const links = shareLinks("https://p2l.test", invite, {
      bot: "P2LBot",
      app: "Play",
    });
    const web = resolveEntry(new URL(links.web), "web");
    expect(new URL(links.web).pathname).toBe("/campaign/new-event/teams");
    const tg = resolveEntry(
      new URL("https://p2l.test/"),
      "telegram",
      undefined,
      new URL(links.telegram!).searchParams.get("startapp")!,
    );
    expect(tg.destination).toBe("/campaign/new-event/teams");
    for (const context of [web.context, tg.context]) {
      const login = resolveEntry(
        new URL("https://p2l.test/profile"),
        "web",
        context,
      );
      expect(
        resolveEntry(
          new URL("https://p2l.test/campaign/new-event/teams"),
          "web",
          login.context,
        ).context,
      ).toMatchObject({ teamId: "tm123", referrerId: "ur123" });
      expect(
        resolveEntry(
          new URL("https://p2l.test/campaign/other/teams"),
          "web",
          context,
        ).context.referrerId,
      ).toBeUndefined();
      expect(
        resolveEntry(
          new URL("https://p2l.test/campaign/new-event/teams?src=direct"),
          "web",
          context,
        ).context.referrerId,
      ).toBeUndefined();
    }
  });
});
