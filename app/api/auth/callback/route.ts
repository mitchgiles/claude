import { exchangeCodeForTokens } from '@/lib/spotify';
import { NextRequest, NextResponse } from 'next/server';

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

    const response = NextResponse.redirect(new URL('/dashboard', req.url));

    // Store tokens in HTTP-only cookies
    response.cookies.set('spotify_access_token', tokens.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: tokens.expires_in,
      path: '/',
    });
    response.cookies.set('spotify_refresh_token', tokens.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    });
    response.cookies.set('spotify_expires_at', String(expiresAt), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    });

    return response;
  } catch (err) {
    console.error('Auth callback error:', err);
    return NextResponse.redirect(new URL('/?error=auth_failed', req.url));
  }
}
