import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
  // Protect admin routes - require System Admin role from database
  if (isAdminRoute(request)) {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.redirect(new URL('/sign-in', request.url));
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
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  // Protect all other authenticated routes
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
