const firebaseConfig = {
  apiKey: "AIzaSyA7cH6zQw_Js7rQ2tNdpgsQomFdnKJ_B94",
  authDomain: "metamyth-web3.firebaseapp.com",
  projectId: "metamyth-web3",
  storageBucket: "metamyth-web3.firebasestorage.app",
  messagingSenderId: "3536439492",
  appId: "1:3536439492:web:85029ed1ab065376d36191",
  measurementId: "G-K2NSJ2FH6G",
};

// Keep identifiers and invitation tokens out of Analytics URLs.
export function analyticsPagePath(pathname: string): string {
  if (/^\/invite\/[^/]+\/?$/.test(pathname)) return "/invite/:token";
  if (/^\/ref\/[^/]+\/?$/.test(pathname)) return "/ref/:userId";
  if (/^\/players\/[^/]+\/?$/.test(pathname)) return "/players/:userId";
  if (/^\/posts\/[^/]+\/?$/.test(pathname)) return "/posts/:postId";
  if (/^\/entry\/[^/]+\/[^/]+\/?$/.test(pathname)) return "/entry/:channel/:to";
  if (/^\/campaign\/[^/]+\/session\/[^/]+\/?$/.test(pathname)) return "/campaign/:id/session/:sessionId";
  if (/^\/campaign\/[^/]+\/result\/[^/]+\/?$/.test(pathname)) return "/campaign/:id/result/:runId";
  if (/^\/campaign\/[^/]+\/?$/.test(pathname)) return "/campaign/:id";
  const campaignSection = pathname.match(/^\/campaign\/[^/]+\/(play|compete|try|teams|leaderboard|launch)\/?$/);
  if (campaignSection) return `/campaign/:id/${campaignSection[1]}`;
  if (["/", "/teams", "/following", "/leaderboard", "/profile", "/verification", "/captain", "/tasks", "/auth/telegram", "/terms", "/privacy"].includes(pathname)) return pathname;
  return "/other";
}

function analyticsEnabled(): boolean {
  return import.meta.env.PROD && import.meta.env.VITE_API_MODE === "live" &&
    ["www.play2launch.com", "play2launch.com", "app.play2launch.com"].includes(window.location.hostname);
}

type AnalyticsModules = {
  analytics: import("firebase/analytics").Analytics;
  logEvent: typeof import("firebase/analytics").logEvent;
};

let analyticsPromise: Promise<AnalyticsModules | null> | undefined;

function loadAnalytics(): Promise<AnalyticsModules | null> {
  if (!analyticsEnabled()) return Promise.resolve(null);
  analyticsPromise ??= Promise.all([
    import("firebase/app"),
    import("firebase/analytics"),
  ]).then(async ([firebase, analyticsModule]) => {
    if (!(await analyticsModule.isSupported())) return null;
    const app = firebase.getApps().find((item) => item.name === "p2l-analytics")
      ?? firebase.initializeApp(firebaseConfig, "p2l-analytics");
    const analytics = analyticsModule.initializeAnalytics(app, {
      config: {
        send_page_view: false,
        page_location: window.location.origin + analyticsPagePath(window.location.pathname),
      },
    });
    return { analytics, logEvent: analyticsModule.logEvent };
  }).catch(() => null);
  return analyticsPromise;
}

export function trackPageView(pathname: string): void {
  const pagePath = analyticsPagePath(pathname);
  void loadAnalytics().then((modules) => {
    if (!modules) return;
    modules.logEvent(modules.analytics, "page_view", {
      page_path: pagePath,
      page_location: window.location.origin + pagePath,
      page_title: pagePath,
    });
  });
}

export type GameAnalyticsEvent = "game_start" | "game_effective" | "game_score_accepted";
export type GameAnalyticsMode = "trial" | "ranked";

const recordedGameEvents = new Set<string>();

export function trackGameEvent(
  event: GameAnalyticsEvent,
  campaign: string,
  mode: GameAnalyticsMode,
  runID?: string,
): void {
  if (!analyticsEnabled() || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(campaign)) return;
  if (runID) {
    const key = `${event}:${campaign}:${mode}:${runID}`;
    if (recordedGameEvents.has(key)) return;
    recordedGameEvents.add(key);
  }
  void loadAnalytics().then((modules) => {
    if (!modules) return;
    modules.logEvent(modules.analytics, event, { campaign, game_mode: mode });
  });
}
