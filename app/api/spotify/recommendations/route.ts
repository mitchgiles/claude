import { getRecommendations } from '@/lib/spotify';
import { getAccessToken } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const token = await getAccessToken();
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const genres = searchParams.get('genres')?.split(',').filter(Boolean) ?? [];
  if (genres.length === 0) return NextResponse.json({ error: 'Missing genres' }, { status: 400 });

  try {
    const data = await getRecommendations(token, genres);
    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch recommendations';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
