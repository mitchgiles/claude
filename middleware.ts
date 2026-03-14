import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const refreshToken = req.cookies.get('spotify_refresh_token')?.value;
  if (!refreshToken) {
    return NextResponse.redirect(new URL('/', req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
