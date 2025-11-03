import { supabaseAdmin } from './supabase';
import type { GRASIngredient, NDIIngredient, OldDietaryIngredient } from '@/types';
import { logger } from './logger';

// Cache TTL: 24 hours (static data rarely changes)
const CACHE_TTL_MS = 1000 * 60 * 60 * 24;

interface IngredientCache<T> {
  data: T[];
  timestamp: number;
}

// In-memory caches
let grasCache: IngredientCache<GRASIngredient> | null = null;
let ndiCache: IngredientCache<NDIIngredient> | null = null;
let odiCache: IngredientCache<OldDietaryIngredient> | null = null;

/**
 * Get all GRAS ingredients with 24-hour in-memory caching
 * Reduces database queries from 100+ per analysis to 1 per day
 */
export async function getCachedGRASIngredients(): Promise<GRASIngredient[]> {
  const now = Date.now();

  // Check cache validity
  if (grasCache && now - grasCache.timestamp < CACHE_TTL_MS) {
    logger.debug('GRAS cache hit', {
      count: grasCache.data.length,
      age_ms: now - grasCache.timestamp,
    });
    return grasCache.data;
  }

  // Cache miss - fetch from database
  logger.info('GRAS cache miss - fetching from database');
  const { data, error } = await supabaseAdmin
    .from('gras_ingredients')
    .select('*')
    .eq('is_active', true);

  if (error) {
    logger.error('Failed to fetch GRAS ingredients', { error });
    // Return stale cache if available, otherwise empty array
    return grasCache?.data || [];
  }

  // Update cache
  grasCache = {
    data: (data as GRASIngredient[]) || [],
    timestamp: now,
  };

  logger.info('GRAS cache refreshed', {
    count: grasCache.data.length,
    timestamp: new Date(now).toISOString(),
  });

  return grasCache.data;
}

/**
 * Get all NDI ingredients with 24-hour in-memory caching
 * Eliminates pagination queries for every analysis
 */
export async function getCachedNDIIngredients(): Promise<NDIIngredient[]> {
  const now = Date.now();

  // Check cache validity
  if (ndiCache && now - ndiCache.timestamp < CACHE_TTL_MS) {
    logger.debug('NDI cache hit', {
      count: ndiCache.data.length,
      age_ms: now - ndiCache.timestamp,
    });
    return ndiCache.data;
  }

  // Cache miss - fetch from database
  logger.info('NDI cache miss - fetching from database');
  const { data, error } = await supabaseAdmin.from('ndi_ingredients').select('*');

  if (error) {
    logger.error('Failed to fetch NDI ingredients', { error });
    // Return stale cache if available, otherwise empty array
    return ndiCache?.data || [];
  }

  // Update cache
  ndiCache = {
    data: (data as NDIIngredient[]) || [],
    timestamp: now,
  };

  logger.info('NDI cache refreshed', {
    count: ndiCache.data.length,
    timestamp: new Date(now).toISOString(),
  });

  return ndiCache.data;
}

/**
 * Get all Old Dietary Ingredients with 24-hour in-memory caching
 * Replaces existing 1-hour cache with longer TTL
 */
export async function getCachedODIIngredients(): Promise<OldDietaryIngredient[]> {
  const now = Date.now();

  // Check cache validity
  if (odiCache && now - odiCache.timestamp < CACHE_TTL_MS) {
    logger.debug('ODI cache hit', {
      count: odiCache.data.length,
      age_ms: now - odiCache.timestamp,
    });
    return odiCache.data;
  }

  // Cache miss - fetch from database
  logger.info('ODI cache miss - fetching from database');
  const { data, error } = await supabaseAdmin.from('old_dietary_ingredients').select('*');

  if (error) {
    logger.error('Failed to fetch ODI ingredients', { error });
    // Return stale cache if available, otherwise empty array
    return odiCache?.data || [];
  }

  // Update cache
  odiCache = {
    data: (data as OldDietaryIngredient[]) || [],
    timestamp: now,
  };

  logger.info('ODI cache refreshed', {
    count: odiCache.data.length,
    timestamp: new Date(now).toISOString(),
  });

  return odiCache.data;
}

/**
 * Manually invalidate all caches (useful for testing or admin updates)
 */
export function invalidateIngredientCaches(): void {
  logger.info('Manually invalidating all ingredient caches');
  grasCache = null;
  ndiCache = null;
  odiCache = null;
}

/**
 * Get cache statistics for monitoring
 */
export function getIngredientCacheStats() {
  const now = Date.now();
  return {
    gras: grasCache
      ? {
          count: grasCache.data.length,
          age_ms: now - grasCache.timestamp,
          expires_in_ms: CACHE_TTL_MS - (now - grasCache.timestamp),
          is_valid: now - grasCache.timestamp < CACHE_TTL_MS,
        }
      : null,
    ndi: ndiCache
      ? {
          count: ndiCache.data.length,
          age_ms: now - ndiCache.timestamp,
          expires_in_ms: CACHE_TTL_MS - (now - ndiCache.timestamp),
          is_valid: now - ndiCache.timestamp < CACHE_TTL_MS,
        }
      : null,
    odi: odiCache
      ? {
          count: odiCache.data.length,
          age_ms: now - odiCache.timestamp,
          expires_in_ms: CACHE_TTL_MS - (now - odiCache.timestamp),
          is_valid: now - odiCache.timestamp < CACHE_TTL_MS,
        }
      : null,
  };
}
