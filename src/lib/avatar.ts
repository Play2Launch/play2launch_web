export function publicAvatarURL(value: unknown, pageHostname = typeof window === 'undefined' ? '' : window.location.hostname): string {
  if (typeof value !== 'string') return '';
  try {
    const url = new URL(value.trim());
    const local = url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname);
    if (!((url.protocol === 'https:' || local) && url.hostname && !url.username && !url.password)) return '';
    // Existing uploaded avatars may still contain the former API URL in the database.
    if (['www.play2launch.com', 'play2launch.com', 'app.play2launch.com'].includes(pageHostname)
      && url.origin === 'https://api.play2launch.com'
      && /^\/api\/v1\/avatars\/[a-f0-9]{32}\.jpg$/.test(url.pathname)
      && !url.search && !url.hash) {
      return `https://www.play2launch.com/avatars/${url.pathname.split('/').pop()}`;
    }
    return url.href;
  } catch { return ''; }
}
