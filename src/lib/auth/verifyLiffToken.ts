const LINE_VERIFY_ENDPOINT = 'https://api.line.me/oauth2/v2.1/verify';

export interface VerifiedLiffIdentity {
  lineUserId: string;
  verified: boolean;
}

function extractChannelIdFromLiffId(liffId?: string | null): string | null {
  const trimmed = liffId?.trim();
  if (trimmed && trimmed.includes('-')) {
    const channelId = trimmed.split('-')[0]?.trim();
    if (channelId) return channelId;
  }
  return null;
}

function getLineLoginChannelId(overrideChannelId?: string | null, overrideLiffId?: string | null): string | null {
  if (overrideChannelId?.trim()) return overrideChannelId.trim();
  const fromOverrideLiff = extractChannelIdFromLiffId(overrideLiffId);
  if (fromOverrideLiff) return fromOverrideLiff;

  const explicit = process.env.LINE_LOGIN_CHANNEL_ID?.trim();
  if (explicit) return explicit;

  const fromEnvLiff = extractChannelIdFromLiffId(process.env.NEXT_PUBLIC_LIFF_ID);
  if (fromEnvLiff) return fromEnvLiff;

  return null;
}

function isMockLiffAllowed(): boolean {
  return (
    process.env.NODE_ENV !== 'production' ||
    process.env.NEXT_PUBLIC_ENABLE_LIFF_MOCK === 'true'
  );
}

/**
 * Verifies a LINE LIFF ID token against LINE's OAuth2 verify endpoint.
 * Supports per-project channelId / liffId overrides for Multi-LINE OA portals.
 */
export async function verifyLiffIdentity(input: {
  lineUserId?: string | null;
  idToken?: string | null;
  channelId?: string | null;
  liffId?: string | null;
}): Promise<VerifiedLiffIdentity> {
  const trimmedToken = input.idToken?.trim();
  const fallbackUserId = input.lineUserId?.trim();
  const channelId = getLineLoginChannelId(input.channelId, input.liffId);

  if (trimmedToken && channelId) {
    const body = new URLSearchParams({
      id_token: trimmedToken,
      client_id: channelId,
    });

    const response = await fetch(LINE_VERIFY_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error('Unauthorized: Invalid or expired LINE LIFF token');
    }

    const payload = (await response.json()) as { sub?: unknown };
    if (typeof payload.sub !== 'string' || !payload.sub.trim()) {
      throw new Error('Unauthorized: LINE token missing subject');
    }

    return {
      lineUserId: payload.sub.trim(),
      verified: true,
    };
  }

  if (isMockLiffAllowed() && fallbackUserId) {
    return {
      lineUserId: fallbackUserId,
      verified: false,
    };
  }

  if (!channelId && fallbackUserId) {
    console.warn('LIFF verification skipped: LINE_LOGIN_CHANNEL_ID / NEXT_PUBLIC_LIFF_ID not configured.');
    return {
      lineUserId: fallbackUserId,
      verified: false,
    };
  }

  throw new Error('Unauthorized: LINE LIFF ID token is required');
}
