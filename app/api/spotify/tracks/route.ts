import { getPlaylistTracks } from '@/lib/spotify';
import { getAccessToken } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const token = await getAccessToken();
  if (!token) {
    return NextResponse.json({
      error: 'Unauthorized',
      debug: {
        hasAt: !!req.cookies.get('spotify_access_token')?.value,
        hasRt: !!req.cookies.get('spotify_refresh_token')?.value,
        hasEa: !!req.cookies.get('spotify_expires_at')?.value,
        ea: req.cookies.get('spotify_expires_at')?.value,
        dateNow: Date.now(),
        rawCookieHeader: req.headers.get('cookie'),
        allCookieNames: req.cookies.getAll().map(c => c.name),
      },
    }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const playlistId = searchParams.get('playlistId');
  if (!playlistId) {
    return NextResponse.json({ error: 'playlistId required' }, { status: 400 });
  }

  // How many tracks to fetch — caller passes needed count, we paginate up to 200.
  const needed = Math.min(parseInt(searchParams.get('needed') ?? '50', 10) || 50, 200);

  try {
    // Fetch up to `needed` tracks across multiple pages (Spotify max 50/page).
    const allItems: unknown[] = [];
    let offset = 0;
    while (allItems.length < needed) {
      const pageLimit = Math.min(50, needed - allItems.length);
      const page = await getPlaylistTracks(token, playlistId, pageLimit, offset);
      const items: unknown[] = page.items ?? [];
      allItems.push(...items);
      if (!page.next || items.length === 0) break;
      offset += items.length;
    }
    const data = { items: allItems };
    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Tracks error:', msg);
    const status = msg.includes('403') ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
