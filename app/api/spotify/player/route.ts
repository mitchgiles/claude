import { getAccessToken } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

const SPOTIFY_BASE_URL = 'https://api.spotify.com/v1';

// Play a track
export async function POST(req: NextRequest) {
  const token = await getAccessToken();
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { uri, deviceId } = await req.json().catch(() => ({}));
  if (!uri) return NextResponse.json({ error: 'Missing uri' }, { status: 400 });

  const url = deviceId
    ? `${SPOTIFY_BASE_URL}/me/player/play?device_id=${deviceId}`
    : `${SPOTIFY_BASE_URL}/me/player/play`;

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ uris: [uri] }),
  });

  if (res.status === 204 || res.status === 202) return NextResponse.json({ ok: true });
  const raw = await res.text().catch(() => '');
  const status = res.status === 404 ? 404 : 500;
  return NextResponse.json({ error: `Spotify ${res.status}: ${raw.slice(0, 200)}` }, { status });
}

// Pause playback
export async function DELETE(req: NextRequest) {
  const token = await getAccessToken();
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { deviceId } = await req.json().catch(() => ({}));
  const url = deviceId
    ? `${SPOTIFY_BASE_URL}/me/player/pause?device_id=${deviceId}`
    : `${SPOTIFY_BASE_URL}/me/player/pause`;

  const res = await fetch(url, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 204 || res.status === 202) return NextResponse.json({ ok: true });
  const raw = await res.text().catch(() => '');
  return NextResponse.json({ error: `Spotify ${res.status}: ${raw.slice(0, 200)}` }, { status: 500 });
}
