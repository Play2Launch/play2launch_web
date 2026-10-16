export function formatTicker(value: string): string {
  const symbol = value.trim().replace(/^(?:\$\s*)+/, "");
  return symbol ? `$${symbol}` : "";
}
