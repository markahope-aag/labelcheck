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

const isAdminRoute = createRouteMatcher(['/admin(.*)', '/api/admin(.*)']);

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
      return secureCookies(response);
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
      return secureCookies(response);
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

  return secureCookies(response);
});

/**
 * Ensures all cookies have Secure, HttpOnly, and SameSite flags
 * Works around Clerk test mode not setting Secure flag
 */
function secureCookies(response: NextResponse): NextResponse {
  // Get all Set-Cookie headers (there can be multiple)
  const cookieHeaders = response.headers.getSetCookie?.() || [];

  if (cookieHeaders.length > 0) {
    // Delete existing Set-Cookie headers
    response.headers.delete('set-cookie');

    // Add each cookie back with security flags
    for (const cookie of cookieHeaders) {
      let secureCookie = cookie;

      // Add Secure flag if not present
      if (!secureCookie.toLowerCase().includes('secure')) {
        secureCookie += '; Secure';
      }

      // Add HttpOnly flag if not present (unless it's a cookie that needs JS access)
      if (
        !secureCookie.toLowerCase().includes('httponly') &&
        !secureCookie.startsWith('__clerk_db')
      ) {
        secureCookie += '; HttpOnly';
      }

      // Add SameSite if not present
      if (!secureCookie.toLowerCase().includes('samesite')) {
        secureCookie += '; SameSite=Lax';
      }

      response.headers.append('set-cookie', secureCookie);
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
