import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const authToken = request.cookies.get('auth_token')?.value;
  const isLoginPage = request.nextUrl.pathname.startsWith('/login');
  const isProtectedPage = request.nextUrl.pathname.startsWith('/dashboard') || request.nextUrl.pathname.startsWith('/inbox');

  // If user is not logged in and tries to access protected pages, redirect to login
  if (!authToken && isProtectedPage) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // If user is logged in and tries to access login page, redirect to dashboard
  if (authToken && isLoginPage) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/inbox/:path*', '/login'],
};
