import { cookies } from 'next/headers';
import { refreshAccessToken } from './spotify';

function cookieOpts(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}

// Accepts raw cookie values directly — avoids any CookieStore abstraction issues
export async function getAccessToken(rawCookies?: {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string;
}): Promise<string | null> {
  let accessToken: string | undefined;
  let refreshToken: string | undefined;
  let expiresAt: string | undefined;

  if (rawCookies) {
    accessToken = rawCookies.accessToken;
    refreshToken = rawCookies.refreshToken;
    expiresAt = rawCookies.expiresAt;
  } else {
    const store = await cookies();
    accessToken = store.get('spotify_access_token')?.value;
    refreshToken = store.get('spotify_refresh_token')?.value;
    expiresAt = store.get('spotify_expires_at')?.value;
  }

  if (!refreshToken) return null;

  const expiresAtNum = Number(expiresAt);

  // Token still valid (with 60-second buffer)
  if (accessToken && expiresAt && !isNaN(expiresAtNum) && Date.now() < expiresAtNum - 60_000) {
    return accessToken;
  }

  // Refresh expired token — only update cookies via next/headers (safe for browser)
  try {
    const refreshed = await refreshAccessToken(refreshToken);
    const newExpiresAt = Date.now() + refreshed.expires_in * 1000;
    try {
      const store = await cookies();
      store.set('spotify_access_token', refreshed.access_token, cookieOpts(refreshed.expires_in));
      store.set('spotify_expires_at', String(newExpiresAt), cookieOpts(60 * 60 * 24 * 30));
    } catch {
      // ignore — token still returned below
    }
    return refreshed.access_token;
  } catch (err) {
    console.error('Token refresh failed:', err);
    return null;
  }
}
