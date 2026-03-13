import { cookies } from 'next/headers';
import { refreshAccessToken } from './spotify';

export async function getAccessToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('spotify_access_token')?.value;
  const refreshToken = cookieStore.get('spotify_refresh_token')?.value;
  const expiresAt = cookieStore.get('spotify_expires_at')?.value;

  if (!refreshToken) return null;

  // Token still valid
  if (accessToken && expiresAt && Date.now() < Number(expiresAt) - 60000) {
    return accessToken;
  }

  // Refresh expired token
  try {
    const refreshed = await refreshAccessToken(refreshToken);
    const newExpiresAt = Date.now() + refreshed.expires_in * 1000;
    const prod = process.env.NODE_ENV === 'production';
    const opts = { httpOnly: true, secure: prod, sameSite: 'lax' as const, path: '/' };
    cookieStore.set('spotify_access_token', refreshed.access_token, { ...opts, maxAge: refreshed.expires_in });
    cookieStore.set('spotify_expires_at', String(newExpiresAt), { ...opts, maxAge: 60 * 60 * 24 * 30 });
    return refreshed.access_token;
  } catch {
    return null;
  }
}
