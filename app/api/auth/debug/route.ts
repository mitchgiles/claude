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

  const tokenToTest = tokenFromReqCookies ?? accessToken;

  // Test /me
  let spotifyMeStatus: number | string | null = null;
  let spotifyMeBody: unknown = null;
  // Test /me/playlists
  let spotifyPlaylistsStatus: number | string | null = null;
  // Test a known playlist items call (first playlist if available)
  let spotifyItemsStatus: number | string | null = null;
  let spotifyItemsBody: unknown = null;
  let firstPlaylistId: string | null = null;

  if (tokenToTest) {
    const h = { Authorization: `Bearer ${tokenToTest}` };
    try {
      const r = await fetch('https://api.spotify.com/v1/me', { headers: h });
      spotifyMeStatus = r.status;
      spotifyMeBody = await r.json().catch(() => null);
    } catch (e) { spotifyMeStatus = `error: ${e instanceof Error ? e.message : e}`; }

    try {
      const r = await fetch('https://api.spotify.com/v1/me/playlists?limit=1', { headers: h });
      spotifyPlaylistsStatus = r.status;
      const body = await r.json().catch(() => null);
      firstPlaylistId = body?.items?.[0]?.id ?? null;
    } catch (e) { spotifyPlaylistsStatus = `error: ${e instanceof Error ? e.message : e}`; }

    if (firstPlaylistId) {
      try {
        const r = await fetch(
          `https://api.spotify.com/v1/playlists/${firstPlaylistId}/items?limit=1&market=from_token&additional_types=track`,
          { headers: h }
        );
        spotifyItemsStatus = r.status;
        spotifyItemsBody = await r.json().catch(() => null);
      } catch (e) { spotifyItemsStatus = `error: ${e instanceof Error ? e.message : e}`; }
    }
  }

  const state = {
    nextHeaders_has_access_token: !!accessToken,
    nextHeaders_has_refresh_token: !!refreshToken,
    reqCookies_has_access_token: !!reqAccessToken,
    reqCookies_has_refresh_token: !!reqRefreshToken,
    getAccessToken_returned_token: !!tokenFromReqCookies,
    expires_in_seconds: expiresAt ? Math.round((Number(expiresAt) - Date.now()) / 1000) : null,
    client_id_set: !!process.env.SPOTIFY_CLIENT_ID,
    redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
    // Live Spotify API tests
    spotify_me_status: spotifyMeStatus,
    spotify_me_country: (spotifyMeBody as { country?: string } | null)?.country ?? null,
    spotify_me_product: (spotifyMeBody as { product?: string } | null)?.product ?? null,
    spotify_playlists_status: spotifyPlaylistsStatus,
    first_playlist_id: firstPlaylistId,
    spotify_items_status: spotifyItemsStatus,
    spotify_items_error: spotifyItemsBody,
  };

  return NextResponse.json(state);
}
