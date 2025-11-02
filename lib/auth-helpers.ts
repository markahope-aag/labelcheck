/**
 * Authentication and Authorization Helpers
 *
 * Centralized auth checks to ensure consistent security across the application.
 */

import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabase';
import { logger } from './logger';

/**
 * Check if the current user is a system administrator
 *
 * @returns Object with userId and isAdmin boolean
 * @throws Error if user is not authenticated
 */
export async function checkAdminAuth(): Promise<{
  userId: string;
  userInternalId: string;
  isAdmin: boolean;
}> {
  const { userId } = await auth();

  if (!userId) {
    throw new Error('Unauthorized');
  }

  // Check database for system admin status (single source of truth)
  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('id, is_system_admin')
    .eq('clerk_user_id', userId)
    .maybeSingle();

  if (error) {
    logger.error('Failed to check admin status', { error, userId });
    throw new Error('Failed to verify admin status');
  }

  if (!user) {
    throw new Error('User not found in database');
  }

  return {
    userId,
    userInternalId: user.id,
    isAdmin: user.is_system_admin === true,
  };
}

/**
 * Require admin access or throw error
 *
 * @throws Error if user is not authenticated or not an admin
 */
export async function requireAdmin(): Promise<{
  userId: string;
  userInternalId: string;
}> {
  const { userId, userInternalId, isAdmin } = await checkAdminAuth();

  if (!isAdmin) {
    throw new Error('Forbidden: Admin access required');
  }

  return { userId, userInternalId };
}

/**
 * Check if user is admin in analyze route
 * Used to bypass usage limits for admins
 */
export async function isUserAdmin(userId: string): Promise<boolean> {
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('is_system_admin')
    .eq('clerk_user_id', userId)
    .maybeSingle();

  return user?.is_system_admin === true;
}

/**
 * Get authenticated user from database
 *
 * Common pattern for protected routes that need user data:
 * 1. Verify Clerk authentication
 * 2. Lookup user in database
 * 3. Return user data or throw appropriate error
 *
 * @returns User data from database
 * @throws Error with appropriate message for 401 or 404
 */
export async function getAuthenticatedUser(): Promise<{
  userId: string;
  userInternalId: string;
  userEmail: string;
}> {
  const { userId } = await auth();

  if (!userId) {
    throw new Error('Unauthorized');
  }

  // Get user from database
  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('id, email')
    .eq('clerk_user_id', userId)
    .maybeSingle();

  if (error) {
    logger.error('Failed to fetch authenticated user', { error, userId });
    throw new Error('Failed to fetch user data');
  }

  if (!user) {
    throw new Error('User not found');
  }

  return {
    userId,
    userInternalId: user.id,
    userEmail: user.email,
  };
}
