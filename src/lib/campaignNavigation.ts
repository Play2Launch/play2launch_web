// Route context takes precedence over the retained invitation/attribution context.
// Global pages must never fall back to a historical campaign.
export function campaignBackPath(pathname: string): string {
  const match = pathname.match(/^\/campaign\/([^/]+)(?:\/(.+))?\/?$/);
  if (!match) return "/";
  return match[2] ? `/campaign/${match[1]}` : "/";
}
