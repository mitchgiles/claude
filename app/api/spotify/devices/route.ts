import { getAccessToken } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET() {
  const token = await getAccessToken();
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const res = await fetch('https://api.spotify.com/v1/me/player/devices', {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    return NextResponse.json({ error: `Spotify ${res.status}` }, { status: res.status });
  }

  const data = await res.json();
  return NextResponse.json(data); // { devices: [...] }
}
