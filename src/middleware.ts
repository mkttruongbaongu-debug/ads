// src/middleware.ts
// Route protection: redirect based on authentication status

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Get the session token
    const token = await getToken({
        req: request,
        secret: process.env.NEXTAUTH_SECRET
    });

    const isAuthenticated = !!token;

    // Define protected routes
    const protectedRoutes = ['/dashboard'];
    const authRoutes = ['/']; // Landing page - only for non-authenticated users

    // Check if current path is protected
    const isProtectedRoute = protectedRoutes.some(route =>
        pathname.startsWith(route)
    );

    // Check if current path is auth-only (landing)
    const isAuthRoute = authRoutes.includes(pathname);

    // Not authenticated trying to access protected route → redirect to landing
    if (isProtectedRoute && !isAuthenticated) {
        const url = request.nextUrl.clone();
        url.pathname = '/';
        url.searchParams.set('callbackUrl', pathname);
        return NextResponse.redirect(url);
    }

    // Authenticated trying to access landing page → redirect to dashboard
    if (isAuthRoute && isAuthenticated) {
        const url = request.nextUrl.clone();
        url.pathname = '/dashboard';
        return NextResponse.redirect(url);
    }

    return NextResponse.next();
}

// Configure which routes to run middleware on
export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - api routes
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico
         * - public files
         */
        '/((?!api|_next/static|_next/image|favicon.ico|.*\\..*|_next).*)',
    ],
};
