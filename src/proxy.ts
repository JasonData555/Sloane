import { NextRequest, NextResponse } from 'next/server';

// Runs in the Next.js proxy/middleware runtime — Node.js crypto APIs are not
// available here. This layer only checks cookie presence for UX redirects.
// Full HMAC token validation happens inside each Node.js route handler.

const PUBLIC_PATHS = ['/login', '/signup', '/forgot-password', '/reset-password', '/api/auth'];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon')) {
    return NextResponse.next();
  }

  const hasSession = !!req.cookies.get('sloane_session')?.value;

  if (!hasSession) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
