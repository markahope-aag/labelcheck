import { RegulatoryDocument } from './supabase';
import { supabase } from './supabase';

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
    console.log(`📦 Cache expired (age: ${Math.round(age / 1000 / 60)} minutes)`);
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
    console.log(`✅ Cache hit: Returning ${documentCache.documents.length} cached documents`);
    return documentCache.documents;
  }

  // Cache miss or expired - fetch from database
  console.log('📥 Cache miss: Fetching documents from database...');

  const { data, error } = await supabase
    .from('regulatory_documents')
    .select('*')
    .eq('is_active', true)
    .limit(50);

  if (error) {
    console.error('Error fetching regulatory documents:', error);
    return [];
  }

  const documents = data || [];

  // Update cache
  documentCache = {
    documents,
    timestamp: Date.now(),
  };

  console.log(`💾 Cached ${documents.length} documents`);

  return documents;
}

/**
 * Manually invalidate the cache
 * Call this when documents are created, updated, or deleted
 */
export function invalidateDocumentCache(): void {
  console.log('🗑️  Cache invalidated manually');
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
  console.log('🔥 Warming up document cache...');
  await getCachedRegulatoryDocuments();
  console.log('✅ Cache warmed up');
}
