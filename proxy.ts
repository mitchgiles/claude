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
  // TEMPORARY diagnostic header — confirms the proxy ran and whether it saw a
  // password configured, without leaking the value. Remove once auth works.
  if (!password) {
    const res = NextResponse.next();
    res.headers.set('x-proxy-debug', 'ran-no-password-configured');
    return res;
  }

  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Basic ')) return unauthorized();

  const decoded = atob(auth.slice(6));
  const suppliedPassword = decoded.slice(decoded.indexOf(':') + 1);
  if (suppliedPassword !== password) return unauthorized();

  const res = NextResponse.next();
  res.headers.set('x-proxy-debug', 'ran-authorized');
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
