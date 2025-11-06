import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { invalidateIngredientCaches } from '@/lib/ingredient-cache';
import { logger } from '@/lib/logger';

/**
 * POST /api/admin/invalidate-cache
 *
 * Manually invalidates all ingredient caches (GRAS, NDI, ODI).
 * Useful after running database migrations that update ingredient data.
 *
 * Requires: Admin role in Clerk
 */
export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // TODO: Add admin role check when we have role-based access
    // For now, any authenticated user can invalidate cache
    // In production, add: if (userRole !== 'admin') return 403

    logger.info('Cache invalidation requested', { userId });

    // Invalidate all caches
    invalidateIngredientCaches();

    logger.info('All ingredient caches invalidated successfully', { userId });

    return NextResponse.json({
      success: true,
      message: 'All ingredient caches (GRAS, NDI, ODI) have been invalidated',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to invalidate caches', { error });
    return NextResponse.json(
      {
        error: 'Failed to invalidate caches',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/invalidate-cache
 *
 * Returns current cache statistics without invalidating.
 * Useful for monitoring cache health.
 */
export async function GET(req: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { getIngredientCacheStats } = await import('@/lib/ingredient-cache');
    const stats = getIngredientCacheStats();

    logger.debug('Cache stats requested', { userId, stats });

    return NextResponse.json({
      success: true,
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get cache stats', { error });
    return NextResponse.json(
      {
        error: 'Failed to get cache stats',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
