import { api } from "./api";
import { idoPath } from "./ido";
export async function relayRequest<T>(
  slug: string,
  path: string,
  method = "GET",
  body?: unknown,
  query?: Record<string, string>,
): Promise<T> {
  const result = await api.authenticated<{
    status: number;
    data: T & { message?: string; error?: string };
  }>(idoPath(slug) + "/relay", { path, method, body, query });
  if (result.status >= 400)
    throw new Error(
      result.data.message ||
        result.data.error ||
        "Unable to get a Relay quote. Please retry.",
    );
  return result.data;
}
export function relayConfigured(slug: string) {
  return api.authenticated<{ configured: boolean; testnet: boolean }>(
    idoPath(slug) + "/relay",
    { path: "/config", method: "GET" },
  );
}
