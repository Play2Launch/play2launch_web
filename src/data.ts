export type Stage = "prelaunch" | "ready" | "countdown" | "live";
export type Campaign = {
  game_key?: string;
  rules_version?: string;
  demo_unlock_seed_points?: number;
  unlock_target?: number;
  score_per_unlock_point?: number;
  unlockPoints?: number;
  id: string;
  name: string;
  ticker: string;
  category: string;
  description: string;
  players: number;
  target: number;
  growth: number;
  score: number;
  teams: number;
  color: string;
  stage: Stage;
  symbol: string;
  cover_image?: string;
  hero_image?: string;
  image_alt?: string;
  featured?: boolean;
  sort_order?: number;
};
export const campaigns: Campaign[] = [
  {
    id: "phood",
    cover_image: "/images/paperhood.png",
    hero_image: "/images/paperhood.png",
    image_alt: "Paperhood, a folded-paper Robin Hood in a green cloak",
    featured: true,
    sort_order: 0,
    name: "PAPERHOOD",
    ticker: "PHOOD",
    category: "Trading · Reaction",
    description: "Buy high. Sell low. Make your paper hands legendary.",
    players: 8214,
    demo_unlock_seed_points: 8214,
    target: 10000,
    unlock_target: 10000,
    score_per_unlock_point: 100,
    growth: 37.2,
    score: 91,
    teams: 24,
    color: "#d2fa69",
    stage: "prelaunch",
    symbol: "PH",
  },
  {
    id: "topfrog",
    name: "TOPFROG",
    ticker: "FROG",
    category: "Arcade · Jump",
    description: "One small leap. One very big community.",
    players: 6430,
    demo_unlock_seed_points: 6430,
    target: 10000,
    unlock_target: 10000,
    score_per_unlock_point: 100,
    growth: 81.4,
    score: 87,
    teams: 18,
    color: "#b8a3ff",
    stage: "prelaunch",
    symbol: "TF",
  },
  {
    id: "orbit",
    name: "ORBIT CLUB",
    ticker: "ORBT",
    category: "Runner · Space",
    description: "Escape gravity. Bring your crew.",
    players: 12000,
    demo_unlock_seed_points: 12000,
    target: 12000,
    unlock_target: 12000,
    score_per_unlock_point: 100,
    growth: 24.8,
    score: 94,
    teams: 31,
    color: "#ffac72",
    stage: "countdown",
    symbol: "OC",
  },
  {
    id: "aura",
    name: "AURA.EXE",
    ticker: "AURA",
    category: "Puzzle · AI",
    description: "Find the pattern. Build the signal.",
    players: 21840,
    demo_unlock_seed_points: 21840,
    target: 20000,
    unlock_target: 20000,
    score_per_unlock_point: 100,
    growth: 18.6,
    score: 96,
    teams: 42,
    color: "#78ccf4",
    stage: "live",
    symbol: "AU",
  },
];
export const teams = [
  {
    id: "alice",
    name: "Alice Army",
    handle: "@aliceonchain",
    initial: "A",
    color: "#d2fa69",
    players: 3821,
    score: 48200000,
    referrals: 1282,
    change: 2,
  },
  {
    id: "bob",
    name: "Bob Gang",
    handle: "@bobtrades",
    initial: "B",
    color: "#b8a3ff",
    players: 2174,
    score: 44700000,
    referrals: 987,
    change: -1,
  },
  {
    id: "charlie",
    name: "Charlie Club",
    handle: "@charlie_eth",
    initial: "C",
    color: "#ffac72",
    players: 1482,
    score: 37100000,
    referrals: 821,
    change: 1,
  },
  {
    id: "nova",
    name: "Nova Collective",
    handle: "@novaverse",
    initial: "N",
    color: "#78ccf4",
    players: 737,
    score: 24600000,
    referrals: 462,
    change: 0,
  },
];
export const short = (n: number) =>
  Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
export const number = (n: number) => Intl.NumberFormat("en").format(n);
export const stageLabel = (s: Stage) =>
  ({
    prelaunch: "PRE-LAUNCH",
    ready: "UNLOCKED",
    countdown: "LAUNCH SOON",
    live: "LAUNCHED",
  })[s];
