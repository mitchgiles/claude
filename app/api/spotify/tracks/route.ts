import { getPlaylistTracks } from '@/lib/spotify';
import { getAccessToken } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const token = await getAccessToken();
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const playlistId = searchParams.get('playlistId');
  if (!playlistId) {
    return NextResponse.json({ error: 'playlistId required' }, { status: 400 });
  }

  try {
    // Fetch up to 50 tracks
    const data = await getPlaylistTracks(token, playlistId, 50, 0);
    return NextResponse.json(data);
  } catch (err) {
    console.error('Tracks error:', err);
    return NextResponse.json({ error: 'Failed to fetch tracks' }, { status: 500 });
  }
}
