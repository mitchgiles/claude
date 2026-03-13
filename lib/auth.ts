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
    // Note: In a production app, we'd set cookies here via a middleware approach.
    // For simplicity, return the new token and let the client handle re-auth.
    return refreshed.access_token;
  } catch {
    return null;
  }
}
