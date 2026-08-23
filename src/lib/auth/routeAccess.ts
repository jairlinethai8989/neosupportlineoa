const EXACT_PUBLIC_PATHS = new Set([
  '/login',
  '/api/line/webhook',
  '/api/cron/daily-summary',
]);

const PUBLIC_SUBTREES = [
  '/portal',
  '/survey',
  '/escalate',
  '/line/imagemap-portal-menu',
];

export function isPublicRequestPath(pathname: string) {
  if (EXACT_PUBLIC_PATHS.has(pathname)) return true;
  return PUBLIC_SUBTREES.some((root) => pathname === root || pathname.startsWith(`${root}/`));
}

export function sanitizeInternalRedirect(value: string | null | undefined, fallback = '/') {
  if (!value || value !== value.trim()) return fallback;
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return fallback;
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback;

  try {
    const base = new URL('https://app.invalid');
    const destination = new URL(value, base);
    if (destination.origin !== base.origin) return fallback;
    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return fallback;
  }
}
