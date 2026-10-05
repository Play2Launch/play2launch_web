export type Runtime = "web" | "telegram";
export type EntryContext = {
  inviteToken?: string;
  campaignId?: string;
  teamId?: string;
  referrerId?: string;
  source: string;
  target: "campaign" | "play" | "teams" | "leaderboard" | "launch";
};
export type EntryResult = {
  context: EntryContext;
  destination?: string;
  error?: string;
};
const idPattern = /^[a-zA-Z0-9_-]{1,64}$/;
export const validId = (value: unknown): value is string =>
  typeof value === "string" && idPattern.test(value);
export const defaultEntry: EntryContext = {
  source: "direct",
  target: "campaign",
};
const targets = ["campaign", "play", "teams", "leaderboard", "launch"];

export function encodeStart(entry: EntryContext): string {
  if (!entry.campaignId && !entry.teamId && !entry.inviteToken && /^ur[0-9a-z]{1,32}$/.test(entry.referrerId || '')) return `r_${entry.referrerId}`;
  if (entry.inviteToken && /^[A-Za-z0-9_-]{32}$/.test(entry.inviteToken)) return `i_${entry.inviteToken}`;
  const params = new URLSearchParams();
  if (entry.campaignId) params.set("c", entry.campaignId);
  if (entry.teamId) params.set("t", entry.teamId);
  if (entry.referrerId) params.set("r", entry.referrerId);
  params.set("s", entry.source);
  params.set("p", entry.target);
  const token = `v1_${btoa(params.toString()).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "")}`;
  if (token.length > 512) throw new Error("This invitation is too long.");
  return token;
}

export function decodeStart(token: string): EntryContext {
  if (/^r_ur[0-9a-z]{1,32}$/.test(token)) return {referrerId:token.slice(2),source:'telegram',target:'campaign'};
  if (/^i_[A-Za-z0-9_-]{32}$/.test(token)) return {inviteToken:token.slice(2),source:"telegram",target:"teams"};
  if (
    !token.startsWith("v1_") ||
    token.length > 512 ||
    !/^[A-Za-z0-9_-]+$/.test(token)
  )
    throw new Error("This invitation is invalid or no longer supported.");
  const body = token.slice(3).replaceAll("-", "+").replaceAll("_", "/");
  const p = new URLSearchParams(
    atob(body.padEnd(Math.ceil(body.length / 4) * 4, "=")),
  );
  const c = p.get("c"),
    t = p.get("t"),
    r = p.get("r"),
    s = p.get("s") || "telegram",
    target = p.get("p") || "campaign";
  if (
    [c, t, r].some((v) => v !== null && !validId(v)) ||
    !validId(s) ||
    !targets.includes(target) ||
    !c
  )
    throw new Error("This invitation has invalid fields.");
  return {
    campaignId: c,
    teamId: t || undefined,
    referrerId: r || undefined,
    source: s,
    target: target as EntryContext["target"],
  };
}

export function entryPath(entry: EntryContext): string {
  if (entry.inviteToken && !entry.campaignId) return `/invite/${encodeURIComponent(entry.inviteToken)}`;
  if (!entry.campaignId) return "/";
  const base = `/campaign/${encodeURIComponent(entry.campaignId)}`;
  return entry.target === "campaign" ? base : `${base}/${entry.target}`;
}

export function resolveEntry(
  url: URL,
  runtime: Runtime,
  previous?: EntryContext,
  telegramStart?: string,
): EntryResult {
  const query = url.searchParams;
  const hash = new URLSearchParams(url.hash.slice(1));
  const start =
    telegramStart ||
    query.get("tgWebAppStartParam") ||
    hash.get("tgWebAppStartParam") ||
    query.get("startapp");
  if (start) {
    try {
      const context = decodeStart(start);
      return { context, destination: entryPath(context) };
    } catch {
      return {
        context: { ...defaultEntry, source: runtime },
        error:
          "We could not read this invitation. You can still explore and play.",
      };
    }
  }
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0] === 'ref') return /^ur[0-9a-z]{1,32}$/.test(parts[1] || '') && parts.length === 2 ? {context:{referrerId:parts[1],source:'share',target:'campaign'}} : {context:defaultEntry,error:'This invitation is invalid.'};
  if (parts[0] === "invite") return {context:{inviteToken:parts[1],source:"share",target:"teams"}};
  let campaignId: string | undefined;
  let teamId: string | undefined;
  let destination: string | undefined;
  let target: EntryContext["target"] = "campaign";
  if (parts[0] === "campaign") {
    campaignId = parts[1];
    if (targets.includes(parts[2])) target = parts[2] as EntryContext["target"];
  } else if (["phood", "topfrog", "orbit", "aura"].includes(parts[0])) {
    campaignId = parts[0];
    teamId = parts[1];
    destination = `/campaign/${campaignId}`;
  } else if (parts[0] === "entry") {
    if (!["web", "tg"].includes(parts[1]))
      return {
        context: defaultEntry,
        error:
          "This entry channel is not supported. Use a Web or Telegram invitation.",
        destination: "/",
      };
    campaignId = query.get("game_id") || undefined;
    target = parts[2] === "game" ? "play" : "campaign";
    if (parts[2] === "game" && !campaignId)
      return {
        context: defaultEntry,
        error: "This game link is missing a campaign.",
        destination: "/",
      };
    destination = campaignId
      ? entryPath({ campaignId, target, source: "direct" })
      : "/";
  }
  teamId = query.get("team") || teamId;
  const referrerId = query.get("ref") || undefined;
  const inviteToken = query.get("invite") || undefined;
  const source = query.get("src") || query.get("utm_source") || undefined;
  if (
    [campaignId, teamId, referrerId, source].some(
      (v) => v !== undefined && !validId(v),
    )
  )
    return {
      context: defaultEntry,
      error: "This link contains invalid campaign or referral information.",
    };
  const explicit = Boolean(teamId || referrerId || source || inviteToken);
  if (referrerId && !campaignId && !teamId && !inviteToken) return {context:{referrerId,source:source||'share',target:'campaign'}};
  const sameCampaign = !campaignId || previous?.campaignId === campaignId;
  const inherited = !explicit && sameCampaign ? previous : undefined;
  const context: EntryContext = {
    ...inherited,
    campaignId: campaignId || previous?.campaignId,
    teamId: explicit ? teamId : inherited?.teamId,
    referrerId: explicit ? referrerId : inherited?.referrerId,
    inviteToken: explicit ? inviteToken : inherited?.inviteToken,
    source:
      source ||
      inherited?.source ||
      (runtime === "telegram" ? "telegram" : "direct"),
    target,
  };
  return { context, destination };
}

export function shareLinks(
  origin: string,
  entry: EntryContext,
  config: { bot?: string; app?: string },
) {
  const target = entry.target === "teams" ? "teams" : "campaign";
  const url = new URL(entryPath({ ...entry, target }), origin);
  if (url.hostname === 'play2launch.com') {
    url.hostname = 'www.play2launch.com';
    url.protocol = 'https:';
    url.port = '';
  }
  if (!entry.campaignId && !entry.teamId && !entry.inviteToken && /^ur[0-9a-z]{1,32}$/.test(entry.referrerId || '')) url.pathname = `/ref/${entry.referrerId}`;
  if (entry.inviteToken) url.pathname = `/invite/${encodeURIComponent(entry.inviteToken)}`;
  if (!entry.inviteToken && entry.teamId) url.searchParams.set("team", entry.teamId);
  if (!entry.inviteToken && entry.referrerId && !url.pathname.startsWith('/ref/')) url.searchParams.set("ref", entry.referrerId);
  url.searchParams.set("src", "share");
  const bot = config.bot?.replace(/^@/, "");
  const telegram =
    bot &&
    /^[A-Za-z0-9_]+$/.test(bot) &&
    (!config.app || /^[A-Za-z0-9_]+$/.test(config.app))
      ? `https://t.me/${bot}${config.app ? `/${config.app}` : ""}?startapp=${encodeStart({ ...entry, source: "telegram", target })}`
      : null;
  return { web: url.toString(), telegram };
}
