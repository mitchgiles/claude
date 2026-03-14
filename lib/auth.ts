import { cookies } from 'next/headers';
import { RequestCookies } from 'next/dist/compiled/@edge-runtime/cookies';
import { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies';
import { refreshAccessToken } from './spotify';

type CookieStore = RequestCookies | ReadonlyRequestCookies | Awaited<ReturnType<typeof cookies>>;

function cookieOpts(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}

export async function getAccessToken(reqCookies?: CookieStore): Promise<string | null> {
  const store = reqCookies ?? await cookies();

  const accessToken = store.get('spotify_access_token')?.value;
  const refreshToken = store.get('spotify_refresh_token')?.value;
  const expiresAt = store.get('spotify_expires_at')?.value;

  if (!refreshToken) return null;

  // Token still valid (with 60-second buffer)
  if (accessToken && expiresAt && Date.now() < Number(expiresAt) - 60_000) {
    return accessToken;
  }

  // Refresh expired token
  try {
    const refreshed = await refreshAccessToken(refreshToken);
    const newExpiresAt = Date.now() + refreshed.expires_in * 1000;
    try {
      const writableStore = reqCookies ?? await cookies();
      writableStore.set('spotify_access_token', refreshed.access_token, cookieOpts(refreshed.expires_in));
      writableStore.set('spotify_expires_at', String(newExpiresAt), cookieOpts(60 * 60 * 24 * 30));
    } catch {
      // ignore — token still returned below
    }
    return refreshed.access_token;
  } catch (err) {
    console.error('Token refresh failed:', err);
    try {
      const writableStore = reqCookies ?? await cookies();
      writableStore.delete('spotify_refresh_token');
      writableStore.delete('spotify_access_token');
      writableStore.delete('spotify_expires_at');
    } catch {
      // ignore
    }
    return null;
  }
}
