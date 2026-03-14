import { getAccessToken } from '@/lib/auth';
import { NextResponse } from 'next/server';

// Returns the access token for client-side use (Spotify Web Playback SDK).
export async function GET() {
  const token = await getAccessToken();
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ token });
}
