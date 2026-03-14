import { cookies } from 'next/headers';
import { getAccessToken } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  // Read via cookies() from next/headers
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('spotify_access_token')?.value;
  const refreshToken = cookieStore.get('spotify_refresh_token')?.value;
  const expiresAt = cookieStore.get('spotify_expires_at')?.value;

  // Read via req.cookies (what Route Handlers now use)
  const reqAccessToken = req.cookies.get('spotify_access_token')?.value;
  const reqRefreshToken = req.cookies.get('spotify_refresh_token')?.value;
  const reqExpiresAt = req.cookies.get('spotify_expires_at')?.value;

  // Call getAccessToken with raw values (same as playlists/tracks routes)
  const tokenFromReqCookies = await getAccessToken({
    accessToken: reqAccessToken,
    refreshToken: reqRefreshToken,
    expiresAt: reqExpiresAt,
  });

  // Test the token against Spotify if we have one
  let spotifyMeStatus: number | string | null = null;
  const tokenToTest = tokenFromReqCookies ?? accessToken;
  if (tokenToTest) {
    try {
      const res = await fetch('https://api.spotify.com/v1/me', {
        headers: { Authorization: `Bearer ${tokenToTest}` },
      });
      spotifyMeStatus = res.status;
    } catch (e) {
      spotifyMeStatus = `fetch error: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  const state = {
    // via cookies() from next/headers
    nextHeaders_has_access_token: !!accessToken,
    nextHeaders_has_refresh_token: !!refreshToken,
    nextHeaders_has_expires_at: !!expiresAt,
    // via req.cookies
    reqCookies_has_access_token: !!reqAccessToken,
    reqCookies_has_refresh_token: !!reqRefreshToken,
    reqCookies_has_expires_at: !!reqExpiresAt,
    // getAccessToken result
    getAccessToken_returned_token: !!tokenFromReqCookies,
    expires_in_seconds: expiresAt ? Math.round((Number(expiresAt) - Date.now()) / 1000) : null,
    // Spotify API test
    spotify_me_status: spotifyMeStatus,
    client_id_set: !!process.env.SPOTIFY_CLIENT_ID,
    redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
  };

  return NextResponse.json(state);
}
