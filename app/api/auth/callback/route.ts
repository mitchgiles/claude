import { exchangeCodeForTokens } from '@/lib/spotify';
import { NextRequest, NextResponse } from 'next/server';

const COOKIE_OPTS = (maxAge: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge,
});

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

    const redirectUrl = process.env.NEXTAUTH_URL
      ? `${process.env.NEXTAUTH_URL}/dashboard`
      : new URL('/dashboard', req.url).toString();

    const response = NextResponse.redirect(redirectUrl);
    response.cookies.set('spotify_access_token', tokens.access_token, COOKIE_OPTS(tokens.expires_in));
    response.cookies.set('spotify_refresh_token', tokens.refresh_token, COOKIE_OPTS(60 * 60 * 24 * 30));
    response.cookies.set('spotify_expires_at', String(expiresAt), COOKIE_OPTS(60 * 60 * 24 * 30));

    return response;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Auth callback error:', msg);
    const url = new URL('/', req.url);
    url.searchParams.set('error', 'auth_failed');
    url.searchParams.set('detail', msg);
    return NextResponse.redirect(url);
  }
}
