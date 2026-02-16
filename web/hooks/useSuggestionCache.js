/**
 * useSuggestionCache - Manages local caching of AI-generated goal/action suggestions
 * Allows Prev/Next browsing without re-calling AI APIs
 * 
 * V2: Properly scoped by track (goals) or goal (actions)
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  buildGoalCacheKey,
  buildActionCacheKey,
  loadCache,
  saveCache,
  initCache,
  appendBatch,
  navigateToBatch,
  getCurrentItems,
  getCurrentBatch,
  canNavigatePrev,
  canNavigateNext,
  getBatchCount,
  clearCache as clearCacheHelper,
  migrateOldCache
} from '../lib/aiSuggestionCache'

export function useSuggestionCache(userId, scopeId, type = 'goals') {
  // Track the current scope to detect changes
  const currentScopeRef = useRef({ userId, scopeId, type })
  const [cache, setCache] = useState(null)
  const [storageKey, setStorageKey] = useState(null)
  
  // Initialize or reinitialize cache when scope changes
  useEffect(() => {
    // Check if scope has changed
    const scopeChanged = 
      currentScopeRef.current.userId !== userId ||
      currentScopeRef.current.scopeId !== scopeId ||
      currentScopeRef.current.type !== type
    
    if (scopeChanged) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Cache] Scope changed: ${type} ${scopeId}`)
      }
      currentScopeRef.current = { userId, scopeId, type }
    }
    
    // Skip if no userId or scopeId
    if (!userId || !scopeId) {
      setCache(null)
      setStorageKey(null)
      return
    }
    
    try {
      // Build storage key based on type
      const key = type === 'goals'
        ? buildGoalCacheKey(userId, scopeId)
        : buildActionCacheKey(userId, scopeId)
      
      setStorageKey(key)
      
      // Load from localStorage
      let loaded = loadCache(key, scopeId)
      
      // Try migrating old cache if not found
      if (!loaded && scopeChanged) {
        loaded = migrateOldCache(userId, scopeId, type)
        if (loaded) {
          saveCache(key, loaded)
        }
      }
      
      // Initialize empty if not found
      if (!loaded) {
        loaded = initCache(scopeId, type === 'goals' ? 'track' : 'goal')
      }
      
      setCache(loaded)
    } catch (error) {
      console.error('[Cache] Error initializing cache:', error)
      setCache(initCache(scopeId || 'unknown', type === 'goals' ? 'track' : 'goal'))
    }
  }, [userId, scopeId, type])
  
  // Save to localStorage whenever cache changes
  useEffect(() => {
    if (cache && storageKey && cache.batches.length > 0) {
      saveCache(storageKey, cache)
    }
  }, [cache, storageKey])
  
  // Add a new batch and jump to it
  const addBatch = useCallback((items) => {
    if (!cache) {
      console.error('[Cache] Cannot add batch: cache not initialized')
      return
    }
    
    const updated = appendBatch(cache, items)
    setCache(updated)
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Cache] Added batch ${updated.batches.length} for ${cache.scopeKey}`)
    }
  }, [cache])
  
  // Navigate to previous batch
  const goToPrevBatch = useCallback(() => {
    if (!cache || !canNavigatePrev(cache)) return
    
    const updated = navigateToBatch(cache, cache.activeBatchIndex - 1)
    setCache(updated)
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Cache] Navigate to batch ${updated.activeBatchIndex + 1}/${updated.batches.length}`)
    }
  }, [cache])
  
  // Navigate to next batch
  const goToNextBatch = useCallback(() => {
    if (!cache || !canNavigateNext(cache)) return
    
    const updated = navigateToBatch(cache, cache.activeBatchIndex + 1)
    setCache(updated)
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Cache] Navigate to batch ${updated.activeBatchIndex + 1}/${updated.batches.length}`)
    }
  }, [cache])
  
  // Clear all cached batches
  const clearCache = useCallback(() => {
    if (!storageKey) return
    
    clearCacheHelper(storageKey)
    setCache(initCache(scopeId || 'unknown', type === 'goals' ? 'track' : 'goal'))
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Cache] Cleared cache for ${scopeId}`)
    }
  }, [storageKey, scopeId, type])
  
  // Get current batch items
  const currentItems = getCurrentItems(cache)
  const currentBatch = getCurrentBatch(cache)
  const totalBatches = getBatchCount(cache)
  const currentBatchIndex = cache?.activeBatchIndex || 0
  
  return {
    // State
    batches: cache?.batches || [],
    currentBatchIndex,
    currentItems,
    currentBatch,
    totalBatches,
    
    // Actions
    addBatch,
    goToPrevBatch,
    goToNextBatch,
    clearCache,
    
    // Helpers
    hasPrev: canNavigatePrev(cache),
    hasNext: canNavigateNext(cache),
    isEmpty: totalBatches === 0,
    isLoading: !cache && !!userId && !!scopeId
  }
}

