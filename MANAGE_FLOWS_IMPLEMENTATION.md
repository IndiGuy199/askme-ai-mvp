# Manage Flows Implementation Summary

## Changes Implemented ✅

### 1. Create Goal Modal - Better Messaging

**Added guidance tip box** at the top of Create Goal modal:
- Blue info box with "How this works" heading
- 4 bullet points explaining:
  - Pick suggested OR create own
  - Max 2 active goals
  - Extras saved to Library
  - AI Suggest Goals for browsing options

**Added empty state guidance** when no suggested goals in dropdown:
- Yellow tip showing "No suggested goals loaded yet. Tap 'AI Suggest Goals' below or create your own."

**Location:** [playbook.js](c:\\opt\\mvp\\web\\pages\\playbook.js) lines ~3066-3085

---

### 2. AI Suggestions - Local Caching + Prev/Next Navigation

**Created new hook:** [useSuggestionCache.js](c:\\opt\\mvp\\web\\hooks\\useSuggestionCache.js)
- Manages localStorage caching of suggestion batches
- Separate caches for goals and actions
- Persistent across modal close/reopen
- Storage keys: `askme_ai_suggestions_v1:{userId}:{type}:{challengeOrGoalId}`

**Updated Goals:**
- `generateGoalWithAI()` now calls `goalCache.addBatch()` instead of replacing
- Added `loadGoalBatch()` function to navigate cached batches
- Added Prev/Next buttons with "Batch X of Y" label
- Buttons disabled appropriately based on `goalCache.hasPrev/hasNext`

**Updated Actions:**
- `generateActionWithAI()` now calls `actionCache.addBatch()` after filtering active actions
- Added `loadActionBatch()` function to navigate cached batches
- Added Prev/Next buttons with "Batch X of Y" label
- Filters out already-active actions before caching

**UI Pattern:**
```
[← Prev] Batch 2 of 4 [Next →]
```

**Location:** 
- Hook: [useSuggestionCache.js](c:\\opt\\mvp\\web\\hooks\\useSuggestionCache.js)
- Goals integration: [playbook.js](c:\\opt\\mvp\\web\\pages\\playbook.js) lines ~1829-1880, 3195-3260
- Actions integration: [playbook.js](c:\\opt\\mvp\\web\\pages\\playbook.js) lines ~1900-1970, 3665-3730

---

### 3. Swap Goal - Show ALL Inactive Library Goals

**Fixed filter logic:**
- Changed from checking `goal.is_active` field (unreliable)
- Now builds `activeGoalIds` array from `trackGoal` and `wellnessGoal` state
- Filters out goals in `activeGoalIds` array (safer approach)
- Properly shows ALL goals not in the 2 active slots

**Added debugging logs:**
- Logs active goal IDs
- Logs all user goals count
- Logs each goal as excluded or included
- Logs final filtered count

**Updated empty state:**
- Changed from "No inactive goals in your library yet"
- To: "No other goals in your library yet. Create one to swap in."

**Location:** [playbook.js](c:\\opt\\mvp\\web\\pages\\playbook.js) lines ~3350-3410

---

## Testing Checklist

### Goals Caching
- [ ] Click "AI Suggest Goals" → Batch 1 created
- [ ] Click "Generate More Options" → Batch 2 created
- [ ] Click Prev → Shows Batch 1 again without API call
- [ ] Close modal, reopen → Batches still there in localStorage

### Actions Caching
- [ ] Generate actions for goal → Batch 1 created
- [ ] Click "Generate Different Actions" → Batch 2 created
- [ ] Click Prev/Next → Navigation works without API calls
- [ ] Active actions do NOT appear in suggestion list

### Swap Goal
- [ ] With 2 active goals and 3 total goals → Swap list shows 1 goal
- [ ] With 2 active goals and 5 total goals → Swap list shows 3 goals
- [ ] If only 2 goals total (both active) → Shows empty state + create CTA
- [ ] Check browser console for debug logs (activeGoalIds, filtered count)

### Create Goal Guidance
- [ ] Open Create Goal modal → See blue "How this works" tip box
- [ ] If no suggested goals → See yellow "No suggested goals loaded yet" tip
- [ ] Guidance is concise, not overwhelming

---

## Technical Details

### Cache Storage Keys
```javascript
// Goals
`askme_ai_suggestions_v1:${userId}:goals:${primaryTrack}`

// Actions
`askme_ai_suggestions_v1:${userId}:actions:${goalId}`
```

### Cache Data Structure
```javascript
{
  batches: [
    {
      batchId: 1708012345678,
      createdAt: "2026-02-13T...",
      items: [/* goal/action objects */]
    },
    ...
  ],
  currentBatchIndex: 2
}
```

### Swap Goal Filter Logic
```javascript
// OLD (unreliable)
if (goal.is_active) return false

// NEW (safer)
const activeGoalIds = [trackGoal?.id, wellnessGoal?.id].filter(Boolean)
if (activeGoalIds.includes(goal.id)) return false
```

---

## Files Modified

1. **c:\\opt\\mvp\\web\\hooks\\useSuggestionCache.js** - NEW FILE
   - Manages localStorage caching with Prev/Next navigation

2. **c:\\opt\\mvp\\web\\pages\\playbook.js** - MODIFIED
   - Added import for useSuggestionCache hook
   - Added goalCache and actionCache state hooks
   - Added guidance tip box to Create Goal modal
   - Added empty state tip when no suggested goals
   - Updated generateGoalWithAI() to use cache
   - Updated generateActionWithAI() to use cache + filter active
   - Added loadGoalBatch() and loadActionBatch() functions
   - Added Prev/Next UI for both goals and actions
   - Fixed swap goal filter to use activeGoalIds array
   - Added debug logging for swap goal filtering

---

## Build Status

✅ **Build Successful** - No TypeScript errors, all changes compile correctly.

```
✓ Compiled successfully
Route /playbook: 21.2 kB (+1.2 kB from cache hook)
```

---

## Notes

- **No token cost increase** - Caching reduces API calls, actually saves tokens
- **Backward compatible** - Old suggestions work, cache is additive
- **Cache cleanup** - Could add "Clear suggestions" link if needed (not implemented yet)
- **Active action filtering** - Prevents duplicate actions in suggestions
- **Swap goal debugging** - Console logs help diagnose filter issues

---

**Implementation Date:** February 13, 2026  
**Status:** ✅ Complete - All 3 issues fixed  
**Build:** ✅ Verified  
**Ready for:** Testing
