import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('spotify_access_token')?.value;
  const refreshToken = cookieStore.get('spotify_refresh_token')?.value;
  const expiresAt = cookieStore.get('spotify_expires_at')?.value;

  const state = {
    has_access_token: !!accessToken,
    has_refresh_token: !!refreshToken,
    has_expires_at: !!expiresAt,
    expires_at_ms: expiresAt ? Number(expiresAt) : null,
    expires_in_seconds: expiresAt ? Math.round((Number(expiresAt) - Date.now()) / 1000) : null,
    client_id_set: !!process.env.SPOTIFY_CLIENT_ID,
    client_secret_set: !!process.env.SPOTIFY_CLIENT_SECRET,
    redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
    refresh_result: null as string | null,
  };

  if (refreshToken) {
    try {
      const credentials = Buffer.from(
        `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
      ).toString('base64');
      const res = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
      });
      const body = await res.json();
      if (res.ok) {
        state.refresh_result = 'success';
      } else {
        state.refresh_result = `failed: ${body.error} — ${body.error_description}`;
      }
    } catch (e) {
      state.refresh_result = `fetch error: ${e instanceof Error ? e.message : String(e)}`;
    }
  } else {
    state.refresh_result = 'no refresh token to test';
  }

  return NextResponse.json(state);
}
