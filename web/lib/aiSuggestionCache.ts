/**
 * AI Suggestion Cache - Scoped caching for goal and action suggestions
 * 
 * Goal cache: Keyed by userId + trackId (e.g., "porn", "food")
 * Action cache: Keyed by userId + goalId (specific user_wellness_goals.id)
 * 
 * Features:
 * - Multi-batch storage with Prev/Next navigation
 * - TTL eviction (7 days default)
 * - Size limits (10 batches per scope)
 * - No token spend on navigation (cache-only)
 */

const STORAGE_KEY_PREFIX = 'askme_ai_suggestions_v2'
const MAX_BATCHES_PER_SCOPE = 10
const TTL_DAYS = 7
const TTL_MS = TTL_DAYS * 24 * 60 * 60 * 1000

export type BatchItem = {
  label?: string
  description?: string
  action_text?: string
  title?: string
  why_this_works?: string
  [key: string]: any
}

export type CachedBatch<T = BatchItem> = {
  batchId: string
  createdAt: number
  items: T[]
}

export type CachedBatches<T = BatchItem> = {
  scopeKey: string
  scopeType: 'track' | 'goal'
  createdAt: number
  batches: CachedBatch<T>[]
  activeBatchIndex: number
}

/**
 * Build storage key for goal suggestions cache
 */
export function buildGoalCacheKey(userId: string, trackId: string): string {
  if (!userId || !trackId) {
    throw new Error('Goal cache requires both userId and trackId')
  }
  return `${STORAGE_KEY_PREFIX}:goals:${userId}:${trackId}`
}

/**
 * Build storage key for action suggestions cache
 */
export function buildActionCacheKey(userId: string, goalId: string | number): string {
  if (!userId || !goalId) {
    throw new Error('Action cache requires both userId and goalId')
  }
  return `${STORAGE_KEY_PREFIX}:actions:${userId}:${goalId}`
}

/**
 * Load cached batches from localStorage
 */
export function loadCache<T = BatchItem>(
  storageKey: string,
  scopeKey: string
): CachedBatches<T> | null {
  if (typeof window === 'undefined') return null
  
  try {
    const stored = localStorage.getItem(storageKey)
    if (!stored) return null
    
    const parsed: CachedBatches<T> = JSON.parse(stored)
    
    // Validate structure
    if (!parsed.batches || !Array.isArray(parsed.batches)) {
      console.warn('Invalid cache structure, clearing')
      localStorage.removeItem(storageKey)
      return null
    }
    
    // Check TTL
    const age = Date.now() - parsed.createdAt
    if (age > TTL_MS) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Cache] TTL expired for ${storageKey} (${Math.round(age / 1000 / 60 / 60 / 24)} days old)`)
      }
      localStorage.removeItem(storageKey)
      return null
    }
    
    // Check scope match (safety check)
    if (parsed.scopeKey !== scopeKey) {
      console.warn(`[Cache] Scope mismatch: expected ${scopeKey}, got ${parsed.scopeKey}`)
      localStorage.removeItem(storageKey)
      return null
    }
    
    return parsed
  } catch (error) {
    console.error('[Cache] Error loading cache:', error)
    return null
  }
}

/**
 * Save cached batches to localStorage
 */
export function saveCache<T = BatchItem>(
  storageKey: string,
  cache: CachedBatches<T>
): void {
  if (typeof window === 'undefined') return
  
  try {
    // Enforce size limit
    if (cache.batches.length > MAX_BATCHES_PER_SCOPE) {
      cache.batches = cache.batches.slice(-MAX_BATCHES_PER_SCOPE)
      // Adjust activeBatchIndex if needed
      if (cache.activeBatchIndex >= cache.batches.length) {
        cache.activeBatchIndex = Math.max(0, cache.batches.length - 1)
      }
    }
    
    localStorage.setItem(storageKey, JSON.stringify(cache))
  } catch (error) {
    console.error('[Cache] Error saving cache:', error)
  }
}

/**
 * Initialize empty cache for a scope
 */
export function initCache<T = BatchItem>(
  scopeKey: string,
  scopeType: 'track' | 'goal'
): CachedBatches<T> {
  return {
    scopeKey,
    scopeType,
    createdAt: Date.now(),
    batches: [],
    activeBatchIndex: 0
  }
}

/**
 * Append a new batch to cache
 */
export function appendBatch<T = BatchItem>(
  cache: CachedBatches<T>,
  items: T[]
): CachedBatches<T> {
  const newBatch: CachedBatch<T> = {
    batchId: `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: Date.now(),
    items
  }
  
  const updatedBatches = [...cache.batches, newBatch]
  
  // Enforce size limit
  const trimmedBatches = updatedBatches.length > MAX_BATCHES_PER_SCOPE
    ? updatedBatches.slice(-MAX_BATCHES_PER_SCOPE)
    : updatedBatches
  
  return {
    ...cache,
    batches: trimmedBatches,
    activeBatchIndex: trimmedBatches.length - 1 // Jump to new batch
  }
}

/**
 * Navigate to a different batch index
 */
export function navigateToBatch<T = BatchItem>(
  cache: CachedBatches<T>,
  newIndex: number
): CachedBatches<T> {
  const clampedIndex = Math.max(0, Math.min(cache.batches.length - 1, newIndex))
  
  return {
    ...cache,
    activeBatchIndex: clampedIndex
  }
}

/**
 * Get current batch items
 */
export function getCurrentItems<T = BatchItem>(
  cache: CachedBatches<T> | null
): T[] {
  if (!cache || !cache.batches.length) return []
  
  const batch = cache.batches[cache.activeBatchIndex]
  return batch?.items || []
}

/**
 * Get current batch info
 */
export function getCurrentBatch<T = BatchItem>(
  cache: CachedBatches<T> | null
): CachedBatch<T> | null {
  if (!cache || !cache.batches.length) return null
  
  return cache.batches[cache.activeBatchIndex] || null
}

/**
 * Check if can navigate to previous batch
 */
export function canNavigatePrev(cache: CachedBatches | null): boolean {
  return cache ? cache.activeBatchIndex > 0 : false
}

/**
 * Check if can navigate to next batch
 */
export function canNavigateNext(cache: CachedBatches | null): boolean {
  return cache ? cache.activeBatchIndex < cache.batches.length - 1 : false
}

/**
 * Get batch count
 */
export function getBatchCount(cache: CachedBatches | null): number {
  return cache?.batches.length || 0
}

/**
 * Clear cache for a specific storage key
 */
export function clearCache(storageKey: string): void {
  if (typeof window === 'undefined') return
  
  try {
    localStorage.removeItem(storageKey)
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Cache] Cleared cache: ${storageKey}`)
    }
  } catch (error) {
    console.error('[Cache] Error clearing cache:', error)
  }
}

/**
 * Migrate old cache format if exists (safe migration)
 * Returns null if no old cache or if can't be safely migrated
 */
export function migrateOldCache(
  userId: string,
  scopeId: string,
  type: 'goals' | 'actions'
): CachedBatches | null {
  if (typeof window === 'undefined') return null
  
  try {
    // Old format: askme_ai_suggestions_v1:${userId}:${type}:${scopeId}
    const oldKey = `askme_ai_suggestions_v1:${userId}:${type}:${scopeId}`
    const stored = localStorage.getItem(oldKey)
    
    if (!stored) return null
    
    const parsed = JSON.parse(stored)
    
    // Check if it has expected structure
    if (!parsed.batches || !Array.isArray(parsed.batches)) return null
    
    // Convert to new format
    const migrated: CachedBatches = {
      scopeKey: scopeId,
      scopeType: type === 'goals' ? 'track' : 'goal',
      createdAt: Date.now(),
      batches: parsed.batches.map((b: any) => ({
        batchId: b.batchId || `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: typeof b.createdAt === 'string' ? new Date(b.createdAt).getTime() : Date.now(),
        items: b.items || []
      })),
      activeBatchIndex: parsed.currentBatchIndex || 0
    }
    
    // Remove old cache
    localStorage.removeItem(oldKey)
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Cache] Migrated old cache: ${oldKey}`)
    }
    
    return migrated
  } catch (error) {
    console.error('[Cache] Error migrating old cache:', error)
    return null
  }
}
