export interface TrustedLineIdentity {
  lineUserId: string;
  displayName: string | null;
  pictureUrl: string | null;
}

type LineVerifyResponse = {
  iss?: unknown;
  sub?: unknown;
  aud?: unknown;
  exp?: unknown;
  name?: unknown;
  picture?: unknown;
};

export async function verifyLineIdToken(
  idToken: string,
  expectedClientId: string,
  fetcher: typeof fetch = fetch
): Promise<TrustedLineIdentity> {
  const body = new URLSearchParams({
    id_token: idToken,
    client_id: expectedClientId,
  });
  const response = await fetcher('https://api.line.me/oauth2/v2.1/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Unauthorized: LINE ID token verification failed');
  }

  const payload = (await response.json()) as LineVerifyResponse;
  if (
    payload.iss !== 'https://access.line.me' ||
    payload.aud !== expectedClientId ||
    typeof payload.sub !== 'string' ||
    typeof payload.exp !== 'number' ||
    payload.exp <= Math.floor(Date.now() / 1000)
  ) {
    throw new Error('Unauthorized: Invalid LINE identity');
  }

  return {
    lineUserId: payload.sub,
    displayName: typeof payload.name === 'string' ? payload.name : null,
    pictureUrl: typeof payload.picture === 'string' ? payload.picture : null,
  };
}
