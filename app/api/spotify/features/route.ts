import { getAudioFeatures } from '@/lib/spotify';
import { getAccessToken } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const token = await getAccessToken({
    accessToken: req.cookies.get('spotify_access_token')?.value,
    refreshToken: req.cookies.get('spotify_refresh_token')?.value,
    expiresAt: req.cookies.get('spotify_expires_at')?.value,
  });
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const ids = searchParams.get('ids');
  if (!ids) {
    return NextResponse.json({ error: 'ids required' }, { status: 400 });
  }

  const trackIds = ids.split(',').filter(Boolean);
  if (trackIds.length === 0) {
    return NextResponse.json({ audio_features: [] });
  }

  try {
    // Spotify allows max 100 IDs per request
    const chunks: string[][] = [];
    for (let i = 0; i < trackIds.length; i += 100) {
      chunks.push(trackIds.slice(i, i + 100));
    }

    const results = await Promise.all(
      chunks.map((chunk) => getAudioFeatures(token, chunk))
    );

    const audio_features = results.flatMap((r) => r.audio_features);
    return NextResponse.json({ audio_features });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Features error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
