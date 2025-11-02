import { RegulatoryDocument } from './supabase';
import { supabase } from './supabase';
import { logger } from './logger';

/**
 * In-memory cache for regulatory documents
 *
 * Performance benefit: 2-3 second savings per analysis
 * Cache is invalidated after 1 hour or when documents are updated
 */

interface CacheEntry {
  documents: RegulatoryDocument[];
  timestamp: number;
}

// Cache storage
let documentCache: CacheEntry | null = null;

// Cache configuration
const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour (can adjust as needed)

/**
 * Check if cache is still valid based on TTL
 */
function isCacheValid(): boolean {
  if (!documentCache) return false;

  const age = Date.now() - documentCache.timestamp;
  const isValid = age < CACHE_TTL_MS;

  if (!isValid) {
    logger.debug('Regulatory document cache expired', {
      ageMinutes: Math.round(age / 1000 / 60),
      ttlMinutes: CACHE_TTL_MS / 1000 / 60,
    });
  }

  return isValid;
}

/**
 * Get cached regulatory documents or fetch from database
 * This is the main function that should be used instead of direct DB calls
 */
export async function getCachedRegulatoryDocuments(): Promise<RegulatoryDocument[]> {
  // Return cached documents if valid
  if (isCacheValid() && documentCache) {
    logger.debug('Regulatory document cache hit', {
      documentCount: documentCache.documents.length,
    });
    return documentCache.documents;
  }

  // Cache miss or expired - fetch from database
  logger.debug('Regulatory document cache miss, fetching from database');

  const { data, error } = await supabase
    .from('regulatory_documents')
    .select('*')
    .eq('is_active', true)
    .limit(50);

  if (error) {
    logger.error('Failed to fetch regulatory documents', { error });
    return [];
  }

  const documents = data || [];

  // Update cache
  documentCache = {
    documents,
    timestamp: Date.now(),
  };

  logger.info('Regulatory documents cached', { documentCount: documents.length });

  return documents;
}

/**
 * Manually invalidate the cache
 * Call this when documents are created, updated, or deleted
 */
export function invalidateDocumentCache(): void {
  logger.info('Regulatory document cache invalidated manually');
  documentCache = null;
}

/**
 * Get cache statistics for monitoring
 */
export function getCacheStats(): {
  isCached: boolean;
  documentCount: number;
  age: number;
  ttl: number;
} {
  if (!documentCache) {
    return {
      isCached: false,
      documentCount: 0,
      age: 0,
      ttl: CACHE_TTL_MS,
    };
  }

  return {
    isCached: true,
    documentCount: documentCache.documents.length,
    age: Date.now() - documentCache.timestamp,
    ttl: CACHE_TTL_MS,
  };
}

/**
 * Warm up the cache (optional - call on server startup)
 * This ensures first request doesn't have to wait for DB fetch
 */
export async function warmUpCache(): Promise<void> {
  logger.info('Warming up regulatory document cache');
  await getCachedRegulatoryDocuments();
  logger.info('Regulatory document cache warmed up');
}
