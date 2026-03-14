import { NextRequest, NextResponse } from 'next/server';

const CUSTOM_DOMAIN = 'www.euroscrubby-wholesale.com';

export function middleware(req: NextRequest) {
  const host = req.headers.get('host') ?? '';
  if (host && host !== CUSTOM_DOMAIN && !host.startsWith('localhost')) {
    const url = req.nextUrl.clone();
    url.host = CUSTOM_DOMAIN;
    url.protocol = 'https:';
    url.port = '';
    return NextResponse.redirect(url, { status: 308 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
