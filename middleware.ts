import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateNonce, buildCSP } from '@/lib/csp';

const isPublicRoute = createRouteMatcher([
  '/',
  '/pricing',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/share/(.*)',
  '/accept-invitation(.*)',
  '/api/webhooks/clerk(.*)',
  '/api/webhooks/stripe(.*)',
]);

const isAdminRoute = createRouteMatcher([
  '/admin(.*)',
  '/api/admin(.*)',
]);

export default clerkMiddleware(async (auth, request) => {
  // Generate nonce for CSP
  const nonce = generateNonce();

  // Protect admin routes - require System Admin role from database
  if (isAdminRoute(request)) {
    const { userId } = await auth();

    if (!userId) {
      const response = NextResponse.redirect(new URL('/sign-in', request.url));
      response.headers.set('Content-Security-Policy', buildCSP(nonce));
      response.headers.set('X-Nonce', nonce);
      return response;
    }

    // Check if user is system admin in database
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: user } = await supabase
      .from('users')
      .select('is_system_admin')
      .eq('clerk_user_id', userId)
      .single();

    if (!user?.is_system_admin) {
      const response = NextResponse.redirect(new URL('/dashboard', request.url));
      response.headers.set('Content-Security-Policy', buildCSP(nonce));
      response.headers.set('X-Nonce', nonce);
      return response;
    }
  }

  // Protect all other authenticated routes
  if (!isPublicRoute(request)) {
    await auth.protect();
  }

  // Create response and set CSP headers
  const response = NextResponse.next();
  response.headers.set('Content-Security-Policy', buildCSP(nonce));
  response.headers.set('X-Nonce', nonce);

  // Ensure all cookies have Secure, HttpOnly, and SameSite flags
  // This fixes the Mozilla Observatory warning about missing Secure flags
  const setCookieHeader = response.headers.get('set-cookie');
  if (setCookieHeader) {
    const cookies = setCookieHeader.split(',').map(cookie => {
      let modifiedCookie = cookie.trim();

      // Add Secure flag if not present (for HTTPS)
      if (!modifiedCookie.includes('Secure')) {
        modifiedCookie += '; Secure';
      }

      // Add HttpOnly if not present (prevent XSS)
      if (!modifiedCookie.includes('HttpOnly')) {
        modifiedCookie += '; HttpOnly';
      }

      // Add SameSite if not present (prevent CSRF)
      if (!modifiedCookie.includes('SameSite')) {
        modifiedCookie += '; SameSite=Lax';
      }

      return modifiedCookie;
    });

    response.headers.set('set-cookie', cookies.join(', '));
  }

  return response;
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
