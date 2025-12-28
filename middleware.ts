import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';

const protectedRoutes = '/dashboard';
const confirmationRoute = '/confirmation';

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isProtectedRoute = pathname.startsWith(protectedRoutes);
  const isConfirmationRoute = pathname === confirmationRoute;
  const session = req.auth;

  // Redirect to sign-in if accessing protected route without session
  if (isProtectedRoute && !session) {
    return NextResponse.redirect(new URL('/sign-in', req.url));
  }

  // Redirect to confirmation page if user is not confirmed
  if (isProtectedRoute && session && !session.user?.isConfirmed) {
    return NextResponse.redirect(new URL('/confirmation', req.url));
  }

  // Redirect confirmed users away from confirmation page
  if (isConfirmationRoute && session?.user?.isConfirmed) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
