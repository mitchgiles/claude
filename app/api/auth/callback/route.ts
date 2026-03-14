import { exchangeCodeForTokens } from '@/lib/spotify';
import { NextRequest, NextResponse } from 'next/server';

function setCookie(name: string, value: string, maxAge: number, secure: boolean) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error || !code) {
    return NextResponse.redirect(
      new URL(`/?error=${error || 'no_code'}`, req.url)
    );
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const expiresAt = Date.now() + tokens.expires_in * 1000;
    const secure = process.env.NODE_ENV === 'production';

    const origin = process.env.NEXTAUTH_URL || `${new URL(req.url).origin}`;
    const headers = new Headers({
      'Location': `${origin}/dashboard`,
    });
    headers.append('Set-Cookie', setCookie('spotify_access_token', tokens.access_token, tokens.expires_in, secure));
    headers.append('Set-Cookie', setCookie('spotify_refresh_token', tokens.refresh_token, 60 * 60 * 24 * 30, secure));
    headers.append('Set-Cookie', setCookie('spotify_expires_at', String(expiresAt), 60 * 60 * 24 * 30, secure));

    return new Response(null, { status: 302, headers });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Auth callback error:', msg);
    const url = new URL('/', req.url);
    url.searchParams.set('error', 'auth_failed');
    url.searchParams.set('detail', msg);
    return NextResponse.redirect(url);
  }
}
