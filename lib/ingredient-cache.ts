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

  // Cache miss - fetch from database with pagination
  logger.info('GRAS cache miss - fetching from database');

  let allData: GRASIngredient[] = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabaseAdmin
      .from('gras_ingredients')
      .select('*')
      .eq('is_active', true)
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      logger.error('Failed to fetch GRAS ingredients', { error, page });
      // Return what we have so far, or stale cache if available
      return allData.length > 0 ? allData : grasCache?.data || [];
    }

    if (data && data.length > 0) {
      allData = allData.concat(data as GRASIngredient[]);
      hasMore = data.length === pageSize;
      page++;
    } else {
      hasMore = false;
    }
  }

  // Update cache
  grasCache = {
    data: allData,
    timestamp: now,
  };

  logger.info('GRAS cache refreshed', {
    count: grasCache.data.length,
    pages: page,
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

  // Cache miss - fetch from database with pagination
  logger.info('NDI cache miss - fetching from database');

  let allData: NDIIngredient[] = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabaseAdmin
      .from('ndi_ingredients')
      .select('*')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      logger.error('Failed to fetch NDI ingredients', { error, page });
      return allData.length > 0 ? allData : ndiCache?.data || [];
    }

    if (data && data.length > 0) {
      allData = allData.concat(data as NDIIngredient[]);
      hasMore = data.length === pageSize;
      page++;
    } else {
      hasMore = false;
    }
  }

  // Update cache
  ndiCache = {
    data: allData,
    timestamp: now,
  };

  logger.info('NDI cache refreshed', {
    count: ndiCache.data.length,
    pages: page,
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

  // Cache miss - fetch from database with pagination
  logger.info('ODI cache miss - fetching from database');

  let allData: OldDietaryIngredient[] = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabaseAdmin
      .from('old_dietary_ingredients')
      .select('*')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      logger.error('Failed to fetch ODI ingredients', { error, page });
      return allData.length > 0 ? allData : odiCache?.data || [];
    }

    if (data && data.length > 0) {
      allData = allData.concat(data as OldDietaryIngredient[]);
      hasMore = data.length === pageSize;
      page++;
    } else {
      hasMore = false;
    }
  }

  // Update cache
  odiCache = {
    data: allData,
    timestamp: now,
  };

  logger.info('ODI cache refreshed', {
    count: odiCache.data.length,
    pages: page,
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
