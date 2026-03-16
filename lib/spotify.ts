const SPOTIFY_BASE_URL = 'https://api.spotify.com/v1';
const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com';

export const SCOPES = [
  'user-read-private',
  'user-read-email',
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-library-read',
  'user-modify-playback-state',
  'user-read-playback-state',
  'streaming',
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
    const raw = await res.text().catch(() => '');
    let detail: string;
    try {
      const body = JSON.parse(raw);
      detail = body?.error?.message ?? body?.error ?? res.statusText;
    } catch {
      detail = raw.slice(0, 200) || res.statusText;
    }
    console.error(`Spotify ${res.status} on ${endpoint}:`, raw.slice(0, 500));
    throw new Error(`Spotify API error: ${res.status} ${detail}`);
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
    `/playlists/${playlistId}/items?limit=${limit}&offset=${offset}&market=from_token&additional_types=track`,
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

export async function getPlaylist(token: string, playlistId: string) {
  return spotifyFetch(`/playlists/${playlistId}?fields=id,name,description,images,tracks(total),owner(display_name)`, token);
}

export async function startPlayback(token: string, trackUri: string) {
  const res = await fetch(`${SPOTIFY_BASE_URL}/me/player/play`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ uris: [trackUri] }),
  });
  // 204 = success; 404 = no active device
  if (res.status === 204 || res.status === 202) return;
  const raw = await res.text().catch(() => '');
  throw new Error(`Spotify playback error: ${res.status} ${raw.slice(0, 200)}`);
}

// /recommendations is unavailable for new apps (deprecated Nov 2024).
// The genre: filter in /search only works for artists, not tracks — use a
// plain keyword search instead.
export async function searchTracksByGenre(token: string, genre: string) {
  const keyword = genre.replace(/-/g, ' ');
  const params = new URLSearchParams({
    q: `${keyword} music`,
    type: 'track',
    market: 'from_token',
    limit: '50',
  });
  return spotifyFetch(`/search?${params}`, token);
}
