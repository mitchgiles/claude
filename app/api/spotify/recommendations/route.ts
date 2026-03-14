import { searchTracksByGenre } from '@/lib/spotify';
import { getAccessToken } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const token = await getAccessToken();
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const genre = searchParams.get('genres') ?? '';
  if (!genre) return NextResponse.json({ error: 'Missing genres' }, { status: 400 });

  try {
    const data = await searchTracksByGenre(token, genre.split(',')[0]);
    // Normalize to { tracks: SpotifyTrack[] } regardless of search response shape
    const tracks = data?.tracks?.items ?? [];
    return NextResponse.json({ tracks });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch tracks';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
