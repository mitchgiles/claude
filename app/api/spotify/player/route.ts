import { startPlayback } from '@/lib/spotify';
import { getAccessToken } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const token = await getAccessToken();
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { uri } = await req.json().catch(() => ({}));
  if (!uri) return NextResponse.json({ error: 'Missing uri' }, { status: 400 });

  try {
    await startPlayback(token, uri);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Playback failed';
    // 404 from Spotify = no active device; surface it distinctly
    const status = msg.includes('404') ? 404 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
