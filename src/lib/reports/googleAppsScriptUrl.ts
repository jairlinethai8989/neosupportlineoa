const WEB_APP_PATH = /^\/macros\/s\/[A-Za-z0-9_-]{6,}\/exec\/?$/;
const CONTENT_REDIRECT_PATH = /^\/macros\/echo\/?$/;

function parseHttpsUrl(value: string, message: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError(message);
  }

  if (
    url.protocol !== 'https:' ||
    url.port !== '' ||
    url.username !== '' ||
    url.password !== '' ||
    url.hash !== ''
  ) {
    throw new TypeError(message);
  }
  return url;
}

export function parseGoogleAppsScriptTargetUrl(value: unknown) {
  if (typeof value !== 'string' || value !== value.trim()) {
    throw new TypeError('Invalid Google Apps Script URL');
  }
  const url = parseHttpsUrl(value, 'Invalid Google Apps Script URL');
  if (url.hostname !== 'script.google.com' || !WEB_APP_PATH.test(url.pathname)) {
    throw new TypeError('Invalid Google Apps Script URL');
  }
  return url.toString();
}

export function resolveGoogleAppsScriptRedirect(location: string, currentUrl: string) {
  let resolved: string;
  try {
    resolved = new URL(location, currentUrl).toString();
  } catch {
    throw new TypeError('Invalid Google Apps Script redirect');
  }

  const url = parseHttpsUrl(resolved, 'Invalid Google Apps Script redirect');
  const isWebAppRedirect = url.hostname === 'script.google.com' && WEB_APP_PATH.test(url.pathname);
  const isContentRedirect =
    url.hostname === 'script.googleusercontent.com' && CONTENT_REDIRECT_PATH.test(url.pathname);
  if (!isWebAppRedirect && !isContentRedirect) {
    throw new TypeError('Invalid Google Apps Script redirect');
  }
  return url.toString();
}
