import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { campaignBackPath } from "./lib/campaignNavigation";
import { campaigns, teams, type Stage } from "./data";
import {
  defaultEntry,
  resolveEntry,
  validId,
  type EntryContext,
} from "./lib/entry";
import { localId, mountPlatform, platformContext, loadTelegramBridge } from "./lib/platform";
import { api, liveAuth, type SignedIn, type User } from "./lib/api";
import {
  createCaptainTeam,
  restoreCaptainTeams,
  teamCatalog,
  type CaptainTeam,
} from "./lib/captain";
import {
  applyForKol,
  reviewKol,
  kolPermissions,
  type KolApplication,
  type KolRequest,
} from "./lib/verification";
import {
  initialCompetition,
  submitScore,
  competitionSnapshot,
  type Competition,
} from "./lib/competition";

export type Run = {
  id: string;
  campaignId: string;
  score: number;
  trades: number;
  created: number;
  saved: boolean;
};
type LocalData = {
  captainTeams: CaptainTeam[];
  kolRequests: Record<string, KolRequest>;
  guestId: string;
  demoUser: User | null;
  memberships: Record<string, string>;
  runs: Run[];
  stages: Record<string, Stage>;
  launchTimes: Record<string, number>;
  competition: Competition;
};
const key = liveAuth ? "p2l.practice.v1" : "p2l.preview.v1";
function read<T>(storage: Storage, key: string, fallback: T): T {
  try {
    return JSON.parse(storage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
}
function write(storage: Storage, key: string, value: unknown) {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    /* Still usable when storage is restricted. */
  }
}
function loadLocal(): LocalData {
  const candidate = read<unknown>(localStorage, key, {});
  const raw: Partial<LocalData> =
    candidate && typeof candidate === "object" && !Array.isArray(candidate)
      ? (candidate as Partial<LocalData>)
      : {};
  if (liveAuth) {
    // Authentication does not promote prototype memberships, scores or KOL permissions.
    raw.demoUser = null;
    raw.memberships = {};
    raw.captainTeams = [];
    raw.kolRequests = {};
    raw.competition = initialCompetition();
    raw.runs = Array.isArray(raw.runs)
      ? raw.runs.map((run) => ({ ...run, saved: false }))
      : [];
  }
  const captainTeams = restoreCaptainTeams(raw.captainTeams);
  return {
    captainTeams,
    kolRequests: Object.fromEntries(
      Object.entries(raw.kolRequests || {}).filter(
        ([id, r]) =>
          r &&
          r.userId === id &&
          ["pending", "approved", "rejected", "revoked"].includes(r.status) &&
          typeof r.displayName === "string" &&
          typeof r.socialUrl === "string" &&
          typeof r.introduction === "string" &&
          typeof r.reason === "string" &&
          Number.isFinite(r.updated) &&
          Array.isArray(r.history),
      ),
    ),
    guestId: validId(raw.guestId) ? raw.guestId : `guest_${localId()}`,
    demoUser:
      raw.demoUser?.mode === "demo" &&
      validId(raw.demoUser.id) &&
      typeof raw.demoUser.name === "string" &&
      raw.demoUser.name.trim()
        ? raw.demoUser
        : null,
    memberships: Object.fromEntries(
      Object.entries(raw.memberships || {}).filter(
        ([c, t]) =>
          campaigns.some((x) => x.id === c) &&
          teamCatalog(captainTeams, c).some((x) => x.id === t),
      ),
    ),
    runs: Array.isArray(raw.runs)
      ? raw.runs
          .filter(
            (r) =>
              r &&
              typeof r.id === "string" &&
              Number.isFinite(r.score) &&
              r.score >= 0 &&
              Number.isFinite(r.created) &&
              Number.isInteger(r.trades) &&
              r.trades >= 0 &&
              typeof r.saved === "boolean" &&
              campaigns.some((c) => c.id === r.campaignId),
          )
          .slice(-50)
      : [],
    stages: raw.stages || {},
    launchTimes: raw.launchTimes || {},
    competition:
      raw.competition?.players &&
      raw.competition?.submitted &&
      raw.competition?.deadlines
        ? raw.competition
        : initialCompetition(),
  };
}
function resolveWithHistory(
  url: URL,
  runtime: "web" | "telegram",
  current: EntryContext,
  start?: string,
) {
  const history = read<Record<string, EntryContext>>(
    sessionStorage,
    "p2l.attribution.v1",
    {},
  );
  const preliminary = resolveEntry(url, runtime, current, start);
  const previous = preliminary.context.campaignId
    ? history[preliminary.context.campaignId] || current
    : current;
  return resolveEntry(url, runtime, previous, start);
}
function useAppState() {
  const [local, setLocal] = useState(loadLocal);
  const [demoTools, setDemoTools] = useState(
    () =>
      !liveAuth &&
      read<boolean>(sessionStorage, "p2l.demo-controls", false) === true,
  );
  const [platform] = useState(() =>
    platformContext(window.Telegram?.WebApp, new URL(window.location.href)),
  );
  const [entry, setEntry] = useState<EntryContext>(
    () =>
      resolveWithHistory(
        new URL(window.location.href),
        platform.runtime,
        read(sessionStorage, "p2l.entry.v1", defaultEntry),
        platform.start,
      ).context,
  );
  const [notice, setNotice] = useState("");
  const [user, setUser] = useState<User | null>(
    liveAuth ? null : local.demoUser,
  );
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const [shareCampaign, setShareCampaign] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const nav = useNavigate();
  const location = useLocation();
  const boot = useRef(true);
  const pending = useRef<((identity: User) => void) | null>(null);
  const authAttempt = useRef(0);
  const authController = useRef<AbortController | null>(null);
  const cancelAuth = () => {
    authAttempt.current++;
    authController.current?.abort();
    authController.current = null;
    setAuthBusy(false);
  };
  useEffect(() => write(localStorage, key, local), [local]);
  useEffect(
    () => mountPlatform(window.Telegram?.WebApp, platform.runtime),
    [platform.runtime],
  );
  useEffect(() => {
    const result = resolveWithHistory(
      new URL(window.location.href),
      platform.runtime,
      entry,
      boot.current ? platform.start : undefined,
    );
    boot.current = false;
    const known =
      liveAuth ||
      !result.context.campaignId ||
      campaigns.some((c) => c.id === result.context.campaignId);
    const validTeam =
      liveAuth ||
      !result.context.teamId ||
      teamCatalog(local.captainTeams, result.context.campaignId || "").some(
        (t) => t.id === result.context.teamId,
      );
    let next = result.context;
    if (!validTeam) {
      next = { ...next, teamId: undefined };
      setNotice(
        "The team in this invitation was not found. Your campaign is still available.",
      );
    }
    if (result.error) setNotice(result.error);
    else if (!known)
      setNotice(
        "This campaign was not found. Explore the available campaigns below.",
      );
    setEntry(next);
    write(sessionStorage, "p2l.entry.v1", next);
    if (next.campaignId && known && !result.error) {
      const history = read<Record<string, EntryContext>>(
        sessionStorage,
        "p2l.attribution.v1",
        {},
      );
      write(sessionStorage, "p2l.attribution.v1", {
        ...history,
        [next.campaignId]: next,
      });
    }
    if (
      result.destination &&
      result.destination !== location.pathname + location.search + location.hash
    )
      nav(result.destination, { replace: true });
    else if (
      window.location.hash.includes("tgWebApp") ||
      new URLSearchParams(location.search).has("startapp") ||
      new URLSearchParams(location.search).has("tgWebAppData")
    )
      nav(location.pathname, { replace: true });
    // Entry is intentionally preserved between ordinary route transitions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search]);
  useEffect(() => {
    const back = window.Telegram?.WebApp?.BackButton;
    if (platform.runtime !== "telegram" || !back) return;
    const action = () => nav(campaignBackPath(location.pathname));
    if (location.pathname === "/") back.hide();
    else back.show();
    back.onClick(action);
    return () => back.offClick(action);
  }, [location.pathname, entry.campaignId, platform.runtime, nav]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  const authContext = () => ({ guestId: local.guestId, entry });
  const completeLogin = (next: User) => {
    setUser(next);
    if (next.mode === "demo") setLocal((l) => ({ ...l, demoUser: next }));
    setAuthOpen(false);
    setAuthError("");
    const callback = pending.current;
    pending.current = null;
    setToast(
      next.mode === "demo"
        ? "Demo profile ready. Your invitation and local scores are preserved."
        : "Signed in. Your campaign and invitation are preserved.",
    );
    // Pending actions may provide a more specific result (e.g. live writes unavailable).
    callback?.(next);
  };
  const completeLiveLogin = (result: SignedIn) => {
    api.remember(result);
    completeLogin(result.user);
  };
  async function executeAuth<T>(
    work: (signal: AbortSignal) => Promise<T>,
    done: (result: T) => void,
  ) {
    authController.current?.abort();
    const attempt = ++authAttempt.current;
    const controller = new AbortController();
    authController.current = controller;
    setAuthBusy(true);
    setAuthError("");
    try {
      const result = await work(controller.signal);
      if (!controller.signal.aborted && attempt === authAttempt.current)
        done(result);
    } catch (e) {
      if (!controller.signal.aborted && attempt === authAttempt.current)
        setAuthError(
          e instanceof Error ? e.message : "Sign-in failed. Please retry.",
        );
    } finally {
      if (attempt === authAttempt.current) setAuthBusy(false);
    }
  }
  const telegramLogin = () =>
    executeAuth(
      async (signal) => {
        await loadTelegramBridge();
        const current = platformContext(window.Telegram?.WebApp, new URL(window.location.href));
        return api.telegram(current.initData || platform.initData, authContext(), signal);
      },
      completeLiveLogin,
    );
  useEffect(() => {
    if (!liveAuth) return;
    // Always revalidate the current TMA launch; never restore a web account into it.
    if (platform.runtime === "telegram") {
      api.logout();
      void telegramLogin();
    } else {
      void executeAuth(
        (signal) => api.session(authContext(), signal),
        (existing) => {
          if (existing) completeLiveLogin(existing);
        },
      );
    }
    return () => {
      authAttempt.current++;
      authController.current?.abort();
    };
    // Bootstrap only; route changes must not repeat authentication.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const requireUser = (action: (identity: User) => void) => {
    if (user) action(user);
    else {
      pending.current = action;
      setAuthOpen(true);
    }
  };
  const join = (campaignId: string, teamId: string) => {
    if (
      !campaigns.some((c) => c.id === campaignId) ||
      !teamCatalog(local.captainTeams, campaignId).some((t) => t.id === teamId)
    )
      return;
    if (local.memberships[campaignId]) {
      setToast(
        "Your team is locked for this campaign. Other campaigns remain independent.",
      );
      return;
    }
    requireUser((identity) => {
      if (liveAuth || identity.mode !== "demo") {
        setToast(
          "Signed in. Open the campaign’s Teams page to confirm joining. No team was joined automatically.",
        );
        return;
      }
      setLocal((l) =>
        l.memberships[campaignId] ||
        Date.now() >= l.competition.deadlines[campaignId]
          ? l
          : {
              ...l,
              memberships: { ...l.memberships, [campaignId]: teamId },
              competition: {
                ...l.competition,
                players: l.competition.players.map((p) =>
                  p.campaignId === campaignId && p.userId === identity.id
                    ? { ...p, teamId }
                    : p,
                ),
              },
            },
      );
      setToast(
        "Demo membership submitted. Teams lock on joining; closed campaigns cannot accept new members.",
      );
    });
  };
  const addRun = (campaignId: string, score: number, trades: number) => {
    const run: Run = {
      id: localId(),
      campaignId,
      score,
      trades,
      created: Date.now(),
      saved: false,
    };
    setLocal((l) => ({ ...l, runs: [...l.runs.slice(-49), run] }));
    return run;
  };
  const saveRun = (id: string) =>
    requireUser((identity) => {
      if (liveAuth || identity.mode !== "demo") {
        setToast(
          "This practice round stays on your device. Start a ranked game from the campaign page to submit an accepted score.",
        );
        return;
      }
      setLocal((l) => {
        const run = l.runs.find((r) => r.id === id);
        if (!run) return l;
        return {
          ...l,
          competition: submitScore(
            l.competition,
            run,
            identity,
            l.memberships[run.campaignId],
          ),
          runs: l.runs.map((r) => (r.id === id ? { ...r, saved: true } : r)),
        };
      });
      setToast(
        "Saved locally. Eligible rounds update the demo standings; closed or zero-trade rounds stay practice-only.",
      );
    });
  const getStage = (id: string): Stage => {
    const saved = local.stages[id];
    return ["prelaunch", "ready", "countdown", "live"].includes(saved)
      ? saved
      : competitionSnapshot(local.competition, id).unlockPoints >=
            (campaigns.find((c) => c.id === id)?.unlock_target || Infinity) &&
          campaigns.find((c) => c.id === id)?.stage === "prelaunch"
        ? "ready"
        : campaigns.find((c) => c.id === id)?.stage || "prelaunch";
  };
  const setStage = (id: string, stage: Stage) =>
    setLocal((l) => ({
      ...l,
      stages: { ...l.stages, [id]: stage },
      launchTimes: {
        ...l.launchTimes,
        [id]: l.launchTimes[id] || Date.now() + 86400000,
      },
    }));
  const logout = async () => {
    cancelAuth();
    pending.current = null;
    if (liveAuth) api.logout();
    setUser(null);
    setAuthOpen(false);
    setAuthError("");
    if (!liveAuth) setLocal((l) => ({ ...l, demoUser: null }));
    setToast(
      "Signed out on this device. Your local practice rounds are still here.",
    );
  };
  return {
    local,
    updatePublicName: (id: string, name: string, handle?: string) => setUser(current => current?.id === id ? {...current, name, ...(handle !== undefined ? {handle} : {})} : current),
    demoTools: !liveAuth && demoTools,
    demoToolsAvailable: !liveAuth,
    toggleDemoTools: (enabled: boolean) => {
      if (liveAuth) return;
      setDemoTools(enabled);
      write(sessionStorage, "p2l.demo-controls", enabled);
    },
    kolRequest:
      !liveAuth && user?.mode === "demo"
        ? local.kolRequests[user.id]
        : undefined,
    kolPermissions: kolPermissions(
      user ? local.kolRequests[user.id] : undefined,
      user?.id,
      !liveAuth && user?.mode === "demo",
    ),
    submitKol: (input: KolApplication) => {
      if (liveAuth || user?.mode !== "demo")
        throw new Error(
          "Sign in with a demo profile to test this application. Live review is not connected.",
        );
      const next = applyForKol(local.kolRequests[user.id], user.id, input);
      setLocal((l) => ({
        ...l,
        kolRequests: { ...l.kolRequests, [user.id]: next },
      }));
    },
    reviewKolDemo: (
      status: "approved" | "rejected" | "revoked",
      reason: string,
    ) => {
      if (liveAuth || user?.mode !== "demo" || !local.kolRequests[user.id])
        throw new Error("No demo application is available for review.");
      const next = reviewKol(local.kolRequests[user.id], status, reason);
      setLocal((l) => ({
        ...l,
        kolRequests: { ...l.kolRequests, [user.id]: next },
      }));
    },
    standings: (id: string) =>
      competitionSnapshot(local.competition, id, local.captainTeams),
    createTeam: (campaignId: string, name: string, description: string) => {
      const next = createCaptainTeam({
        custom: local.captainTeams,
        campaignId,
        ownerId: user?.id || "",
        eligible: kolPermissions(
          user ? local.kolRequests[user.id] : undefined,
          user?.id,
          !liveAuth && user?.mode === "demo",
        ).canCreateTeam,
        membership: local.memberships[campaignId],
        deadline: local.competition.deadlines[campaignId],
        name,
        description,
        id: `team_${localId()}`,
      });
      setLocal((l) => {
        if (
          l.memberships[campaignId] ||
          l.captainTeams.some(
            (t) => t.ownerId === next.ownerId && t.campaignId === campaignId,
          )
        )
          return l;
        return {
          ...l,
          captainTeams: [...l.captainTeams, next],
          memberships: { ...l.memberships, [campaignId]: next.id },
          competition: {
            ...l.competition,
            players: l.competition.players.map((p) =>
              p.userId === next.ownerId && p.campaignId === campaignId
                ? { ...p, teamId: next.id }
                : p,
            ),
          },
        };
      });
      return next;
    },
    simulateTeamPlayer: (teamId: string) => {
      const team = local.captainTeams.find(
        (t) => t.id === teamId && t.ownerId === user?.id,
      );
      if (
        liveAuth ||
        user?.mode !== "demo" ||
        !team ||
        !kolPermissions(local.kolRequests[user.id], user.id, true).canCreateTeam
      )
        throw new Error(
          "An approved demo captain and owned team are required.",
        );
      const now = Date.now();
      if (now >= local.competition.deadlines[team.campaignId])
        throw new Error("Scoring is closed. No simulated player was added.");
      const suffix = localId();
      const player = {
        id: `invite_${suffix}`,
        name: `Demo recruit ${local.competition.players.filter((p) => p.teamId === team.id).length + 1}`,
      };
      const run = {
        id: `run_${suffix}`,
        campaignId: team.campaignId,
        score: 12500,
        trades: 2,
        created: now,
      };
      setLocal((l) => ({
        ...l,
        competition: submitScore(l.competition, run, player, team.id, now),
      }));
    },
    campaign: (id: string) => {
      const c = campaigns.find((c) => c.id === id);
      return c
        ? {
            ...c,
            players: competitionSnapshot(local.competition, id).qualified,
            target: c.unlock_target ?? c.target,
            unlockPoints: competitionSnapshot(local.competition, id)
              .unlockPoints,
            teams: teamCatalog(local.captainTeams, id).length,
          }
        : undefined;
    },
    setCompetitionClosed: (id: string, closed: boolean) =>
      setLocal((l) => ({
        ...l,
        competition: {
          ...l.competition,
          deadlines: {
            ...l.competition.deadlines,
            [id]: closed ? Date.now() : Date.now() + 7 * 86400000,
          },
        },
      })),
    platform,
    entry,
    notice,
    setNotice,
    user,
    authBusy,
    setAuthBusy,
    authError,
    setAuthError,
    authOpen,
    setAuthOpen,
    closeAuth: () => {
      cancelAuth();
      pending.current = null;
      setAuthError("");
      setAuthOpen(false);
    },
    shareCampaign,
    setShareCampaign,
    toast,
    setToast,
    authContext,
    completeLogin,
    completeLiveLogin,
    executeAuth,
    telegramLogin,
    requireUser,
    join,
    addRun,
    saveRun,
    getStage,
    setStage,
    logout,
  };
}
type State = ReturnType<typeof useAppState>;
const Context = createContext<State | null>(null);
export function AppProvider({ children }: { children: ReactNode }) {
  const state = useAppState();
  return <Context.Provider value={state}>{children}</Context.Provider>;
}
export function useApp() {
  const value = useContext(Context);
  if (!value) throw new Error("Missing application provider");
  return value;
}
