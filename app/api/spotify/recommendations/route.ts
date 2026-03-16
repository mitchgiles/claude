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
    const g = genre.split(',')[0];
    // Spotify rejects explicit `limit` for new apps, so we paginate via offset.
    // 3 pages × 20 (default) = up to 60 tracks — enough for any workout length.
    const pages = await Promise.allSettled([
      searchTracksByGenre(token, g, 0),
      searchTracksByGenre(token, g, 20),
      searchTracksByGenre(token, g, 40),
    ]);

    const seen = new Set<string>();
    const tracks: unknown[] = [];
    for (const result of pages) {
      if (result.status !== 'fulfilled') continue;
      for (const item of result.value?.tracks?.items ?? []) {
        const id = (item as { id?: string }).id;
        if (id && !seen.has(id)) {
          seen.add(id);
          tracks.push(item);
        }
      }
    }

    if (tracks.length === 0) {
      // All pages failed — surface the first rejection as the error
      const first = pages.find((p) => p.status === 'rejected') as PromiseRejectedResult | undefined;
      throw new Error(first?.reason instanceof Error ? first.reason.message : 'No tracks found');
    }

    return NextResponse.json({ tracks });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch tracks';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
