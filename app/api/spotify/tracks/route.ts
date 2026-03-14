import { getPlaylistTracks } from '@/lib/spotify';
import { getAccessToken } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const at = req.cookies.get('spotify_access_token')?.value;
  const rt = req.cookies.get('spotify_refresh_token')?.value;
  const ea = req.cookies.get('spotify_expires_at')?.value;
  const token = await getAccessToken({ accessToken: at, refreshToken: rt, expiresAt: ea });
  if (!token) {
    return NextResponse.json({
      error: 'Unauthorized',
      debug: { hasAt: !!at, hasRt: !!rt, hasEa: !!ea, ea, dateNow: Date.now() },
    }, { status: 401 });
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
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Tracks error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
