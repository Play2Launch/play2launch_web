import { api } from "./api";
import type { Stage } from "../data";

export type PublicCampaign = {
  game_key?: string;
  rules_version?: string;
  unlock_target?: number;
  score_per_unlock_point?: number;
  availability?: {
    join_open: boolean;
    scoring_open: boolean;
    state: string;
    server_time: string;
  };
  id: string;
  slug: string;
  name: string;
  ticker: string;
  launch_at?: string | null;
  category: string;
  description: string;
  stage: Stage;
  target: number;
  color: string;
  symbol: string;
  cover_image?: string;
  hero_image?: string;
  image_alt?: string;
  featured?: boolean;
  sort_order?: number;
};
export type CampaignPage = { items: PublicCampaign[]; next_cursor: string; order?: string; has_more?: boolean };
export type RecentCampaigns = { items: PublicCampaign[]; hasMore: boolean };

function isCampaign(value: unknown): value is PublicCampaign {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (
    !["unlock_target", "score_per_unlock_point"].every(
      (k) =>
        v[k] === undefined ||
        (typeof v[k] === "number" &&
          Number.isSafeInteger(v[k]) &&
          (v[k] as number) >= 0),
    )
  )
    return false;
  if (v.availability !== undefined) {
    const a = v.availability as PublicCampaign["availability"];
    if (
      !a ||
      typeof a.join_open !== "boolean" ||
      typeof a.scoring_open !== "boolean" ||
      typeof a.state !== "string" ||
      typeof a.server_time !== "string" ||
      !Number.isFinite(Date.parse(a.server_time))
    )
      return false;
  }
  return (
    [
      "game_key",
      "rules_version",
      "cover_image",
      "hero_image",
      "image_alt",
    ].every((k) => v[k] === undefined || typeof v[k] === "string") &&
    (v.featured === undefined || typeof v.featured === "boolean") &&
    (v.sort_order === undefined ||
      (typeof v.sort_order === "number" &&
        Number.isInteger(v.sort_order) &&
        v.sort_order >= -2147483648 &&
        v.sort_order <= 2147483647)) &&
    typeof v.id === "string" &&
    /^cp[0-9a-z]{1,13}$/.test(v.id) &&
    typeof v.slug === "string" &&
    /^[a-z0-9][a-z0-9-]{0,63}$/.test(v.slug) &&
    ["name", "ticker", "category", "description", "symbol"].every(
      (k) => typeof v[k] === "string",
    ) &&
    typeof v.stage === "string" &&
    ["prelaunch", "ready", "countdown", "live"].includes(v.stage) &&
    typeof v.target === "number" &&
    Number.isSafeInteger(v.target) &&
    v.target > 0 &&
    typeof v.color === "string" &&
    /^#[0-9a-fA-F]{6}$/.test(v.color)
  );
}
export async function listCampaigns(
  after = "",
  signal?: AbortSignal,
  query = "",
): Promise<CampaignPage> {
  const data = await api.request<CampaignPage>(
    `/campaigns?limit=20${after ? `&after=${encodeURIComponent(after)}` : ""}${query ? `&q=${encodeURIComponent(query)}` : ""}`,
    undefined,
    { signal },
  );
  if (
    !data ||
    !Array.isArray(data.items) ||
    !data.items.every(isCampaign) ||
    typeof data.next_cursor !== "string" ||
    (data.next_cursor !== "" &&
      !/^v1\.[01]\.-?\d{1,10}\.cp[0-9a-z]{1,13}$/.test(data.next_cursor))
  ) {
    throw new Error("The campaign response was invalid. Please try again.");
  }
  return data;
}
export async function recentCampaigns(signal?: AbortSignal): Promise<RecentCampaigns> {
  const data = await api.request<CampaignPage>(
    "/campaigns?limit=3&order=recent",
    undefined,
    { signal },
  );
  if (!data || data.order !== "recent" || !Array.isArray(data.items) || data.items.length > 3 ||
      (data.has_more !== undefined && typeof data.has_more !== "boolean") ||
      !data.items.every(isCampaign) || data.next_cursor !== "") {
    throw new Error("The recent campaign response was invalid. Please try again.");
  }
  // Servers deployed before has_more still prove there is no fourth item when
  // fewer than three were returned. With exactly three, keep the picker visible.
  return { items: data.items, hasMore: data.has_more ?? data.items.length === 3 };
}
export async function getCampaign(
  slug: string,
  signal?: AbortSignal,
): Promise<PublicCampaign> {
  const data = await api.request<PublicCampaign>(
    `/campaigns/${encodeURIComponent(slug)}`,
    undefined,
    { signal },
  );
  if (!isCampaign(data) || data.slug !== slug)
    throw new Error("The campaign response was invalid. Please try again.");
  return data;
}
