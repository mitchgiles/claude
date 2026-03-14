import { getUserPlaylists } from '@/lib/spotify';
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
      debug: {
        hasAt: !!at, hasRt: !!rt,
        rawCookieHeader: req.headers.get('cookie'),
      },
    }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Number(searchParams.get('limit') || 20);
  const offset = Number(searchParams.get('offset') || 0);

  try {
    const data = await getUserPlaylists(token, limit, offset);
    return NextResponse.json(data);
  } catch (err) {
    console.error('Playlists error:', err);
    return NextResponse.json({ error: 'Failed to fetch playlists' }, { status: 500 });
  }
}
