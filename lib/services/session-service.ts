/**
 * Session Service
 *
 * Handles session access control and ownership verification.
 * Centralizes common session-related operations used across analysis routes.
 */

import { supabaseAdmin } from '@/lib/supabase';
import { getSessionWithIterations } from '@/lib/session-helpers';
import { logger } from '@/lib/logger';
import { NotFoundError } from '@/lib/error-handler';
import type {
  AnalysisSession,
  AnalysisIteration,
  Analysis,
  Organization,
  OrganizationMember,
} from '@/types';

export interface SessionAccessResult {
  session: AnalysisSession | null;
  iterations: AnalysisIteration[];
  hasAccess: boolean;
  error?: string;
}

/**
 * Get session and verify user has access to it
 * Common pattern used in chat and text analysis routes
 *
 * @param sessionId - The session ID to fetch
 * @param userId - The internal user ID to verify ownership
 * @param useAdmin - Whether to use admin client (for bypassing RLS)
 * @returns Session with access verification
 */
export async function getSessionWithAccess(
  sessionId: string,
  userId: string,
  useAdmin: boolean = true
): Promise<SessionAccessResult> {
  // Get session with all iterations
  const {
    session,
    iterations,
    error: sessionError,
  } = await getSessionWithIterations(sessionId, useAdmin);

  if (sessionError || !session) {
    logger.error('Session fetch failed', { error: sessionError, sessionId });
    return {
      session: null,
      iterations: [],
      hasAccess: false,
      error: 'Session not found',
    };
  }

  // Verify session belongs to user
  if (session.user_id !== userId) {
    logger.warn('Unauthorized session access attempt', {
      sessionId,
      userId,
      sessionOwnerId: session.user_id,
    });
    return {
      session,
      iterations,
      hasAccess: false,
      error: 'Access denied to this session',
    };
  }

  return {
    session,
    iterations,
    hasAccess: true,
  };
}

/**
 * Verify analysis ownership
 * Common pattern for routes that operate on analyses
 *
 * @param analysisId - The analysis ID
 * @param userId - Internal user ID
 * @returns Analysis data if owned by user, null if not found or unauthorized
 */
export async function verifyAnalysisOwnership(
  analysisId: string,
  userId: string
): Promise<{ owned: true; analysis: Analysis } | { owned: false; error: string }> {
  const { data: analysis } = await supabaseAdmin
    .from('analyses')
    .select('*')
    .eq('id', analysisId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!analysis) {
    return {
      owned: false,
      error: 'Analysis not found or access denied',
    };
  }

  return {
    owned: true,
    analysis,
  };
}

/**
 * Get organization and verify user membership
 * Common pattern for team/organization routes
 *
 * @param organizationId - The organization ID
 * @param userId - Internal user ID
 * @returns Organization with membership info
 */
export async function getOrganizationWithMembership(
  organizationId: string,
  userId: string
): Promise<{
  organization: Organization | null;
  membership: OrganizationMember | null;
  hasAccess: boolean;
  role?: string;
}> {
  // Get organization
  const { data: organization } = await supabaseAdmin
    .from('organizations')
    .select('*')
    .eq('id', organizationId)
    .maybeSingle();

  if (!organization) {
    return {
      organization: null,
      membership: null,
      hasAccess: false,
    };
  }

  // Get user's membership
  const { data: membership } = await supabaseAdmin
    .from('organization_members')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!membership) {
    return {
      organization,
      membership: null,
      hasAccess: false,
    };
  }

  return {
    organization,
    membership,
    hasAccess: true,
    role: membership.role,
  };
}
