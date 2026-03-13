import { NextResponse } from 'next/server';

export async function GET() {
  const response = NextResponse.redirect(
    new URL('/', process.env.NEXTAUTH_URL || 'http://127.0.0.1:3000')
  );
  response.cookies.delete('spotify_access_token');
  response.cookies.delete('spotify_refresh_token');
  response.cookies.delete('spotify_expires_at');
  return response;
}
