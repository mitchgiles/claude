import { NextRequest, NextResponse } from 'next/server';

function unauthorized() {
  return new NextResponse('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Scourr Trade Show", charset="UTF-8"' },
  });
}

// Gates the whole app behind a single shared password (HTTP Basic Auth) when
// TRADE_SHOW_PASSWORD is set. Left unset, the app is publicly accessible as before.
export function proxy(req: NextRequest) {
  const password = process.env.TRADE_SHOW_PASSWORD?.trim();
  if (!password) return NextResponse.next();

  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Basic ')) return unauthorized();

  const decoded = atob(auth.slice(6));
  const suppliedPassword = decoded.slice(decoded.indexOf(':') + 1);
  if (suppliedPassword !== password) return unauthorized();

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
