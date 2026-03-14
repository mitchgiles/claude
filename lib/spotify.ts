const SPOTIFY_BASE_URL = 'https://api.spotify.com/v1';
const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com';

export const SCOPES = [
  'user-read-private',
  'user-read-email',
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-library-read',
].join(' ');

export function getAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: process.env.SPOTIFY_CLIENT_ID!,
    response_type: 'code',
    redirect_uri: process.env.SPOTIFY_REDIRECT_URI!,
    scope: SCOPES,
    show_dialog: 'true',
  });
  return `${SPOTIFY_AUTH_URL}/authorize?${params}`;
}

export async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const credentials = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString('base64');

  const res = await fetch(`${SPOTIFY_AUTH_URL}/api/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.SPOTIFY_REDIRECT_URI!,
    }),
  });

  if (!res.ok) {
    throw new Error(`Token exchange failed: ${res.statusText}`);
  }
  return res.json();
}

export async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
}> {
  const credentials = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString('base64');

  const res = await fetch(`${SPOTIFY_AUTH_URL}/api/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Token refresh failed: ${body.error_description || body.error || res.statusText}`);
  }
  return res.json();
}

async function spotifyFetch(endpoint: string, token: string) {
  const res = await fetch(`${SPOTIFY_BASE_URL}${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Spotify API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function getUserPlaylists(token: string, limit = 20, offset = 0) {
  return spotifyFetch(`/me/playlists?limit=${limit}&offset=${offset}`, token);
}

export async function getPlaylistTracks(
  token: string,
  playlistId: string,
  limit = 50,
  offset = 0
) {
  return spotifyFetch(
    `/playlists/${playlistId}/tracks?limit=${limit}&offset=${offset}&fields=items(track(id,name,artists,album,duration_ms,uri,preview_url)),total,next`,
    token
  );
}

export async function getAudioFeatures(token: string, trackIds: string[]) {
  const ids = trackIds.join(',');
  return spotifyFetch(`/audio-features?ids=${ids}`, token);
}

export async function getCurrentUser(token: string) {
  return spotifyFetch('/me', token);
}
