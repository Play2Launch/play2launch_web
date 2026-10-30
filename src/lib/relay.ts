import { api } from "./api";
import { idoPath } from "./ido";
export type RelayScope = 'ido' | 'airdrop-gas';
function relayPath(slug: string, scope: RelayScope) {
  return scope === 'airdrop-gas' ? `/campaigns/${encodeURIComponent(slug)}/airdrop/gas/relay` : idoPath(slug) + '/relay';
}
export async function relayRequest<T>(
  slug: string,
  path: string,
  method = "GET",
  body?: unknown,
  query?: Record<string, string>,
  scope: RelayScope = 'ido',
): Promise<T> {
  const result = await api.authenticated<{
    status: number;
    data: T & { message?: string; error?: string };
  }>(relayPath(slug, scope), { path, method, body, query });
  if (result.status >= 400)
    throw new Error(
      result.data.message ||
        result.data.error ||
        "Unable to get a Relay quote. Please retry.",
    );
  return result.data;
}
export function relayConfigured(slug: string, scope: RelayScope = 'ido') {
  return api.authenticated<{ configured: boolean; testnet: boolean }>(
    relayPath(slug, scope),
    { path: "/config", method: "GET" },
  );
}
