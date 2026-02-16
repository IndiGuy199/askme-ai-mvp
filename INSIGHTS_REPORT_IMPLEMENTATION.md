# Insights Report Implementation Summary

## Overview
Implemented comprehensive improvements to the Insights Report with data completeness tracking, transparent missing metrics display, and improved UI matching the AskMe AI theme.

## Files Changed

### 1. **New File: web/lib/coach-ai/completeness.ts**
   - **Purpose**: Compute report completeness score and track missing metrics
   - **Key Functions**:
     - `computeReportCompleteness(metrics)`: Returns completeness % and structured list of missing metrics
     - `getToolConfidence(sampleSize)`: Determines confidence level (high/medium/low) for tool effectiveness
     - `formatRiskWindowLabel(topHours)`: Formats risk window display
   - **Completeness Logic**:
     - Activity section: 50% for actions planned, 50% for completions logged
     - Urge tracking: 100% if urge ratings present
     - Risk window: 100% if pattern detected, 50% if partial data
     - Tools: Variable based on sample size (100% for 10+ samples)
     - Baselines: 70% for track baseline, 30% for goal baseline

### 2. **Updated: web/lib/coach-ai/schema.ts**
   - Added TypeScript types for detailed insights response
   - New schemas:
     - `DetailedInsightDataSchema`: Zod schema for AI-generated insights
     - `DetailedInsightsResponse`: Interface for full API response
     - `RangeKey` and `CompareMode` types for filtering

### 3. **Updated: web/pages/api/coach/insights-detailed.ts**
   - **Changes**:
     - Import `computeReportCompleteness` function
     - Compute completeness for both cached and fresh responses
     - Include `report_completeness` in API response
   - **Response Structure**:
     ```typescript
     {
       report_completeness: {
         percent_complete: number,
         missing_metrics: MissingMetric[],
         coverage: { [section]: SectionCoverage }
       },
       snapshot: { metrics, insights },
       compare_snapshot?: { metrics, insights },
       delta?: { ... },
       cached: boolean
     }
     ```

### 4. **Updated: web/pages/playbook/insights.js**
   - **Authentication Fix**: Changed from localStorage to Supabase `getSession()` (matches playbook.js pattern)
   - **New UI Components**:
     - Report Completeness indicator with progress bar
     - "What's missing" collapsible panel
     - Missing metrics cards with CTAs
     - Empty states for sections without data
     - Coverage indicators on each section
     - Confidence labels for tool effectiveness
   - **State Management**:
     - Added `showMissing` toggle for missing metrics panel
     - Added `user` state for authentication
   - **Styling**: Matches AskMe AI theme (purple gradient header, white cards, soft shadows)

### 5. **Updated: web/pages/playbook.js**
   - Added "View detailed report" button to Weekly Patterns card
   - Button appears in both states (with/without insights)
   - Routes to `/playbook/insights`

### 6. **New File: web/lib/coach-ai/__tests__/completeness.test.js**
   - Unit tests for completeness computation
   - Test scenarios:
     - Empty data (~20% completeness)
     - Partial data (~50% completeness)
     - Near-complete data (~90% completeness)
     - Complete data (100% completeness)
   - Run with: `node web/lib/coach-ai/__tests__/completeness.test.js`

## Key Features Implemented

### 1. Report Completeness Score (0-100%)
- Calculated from 5 sections: activity, urge tracking, risk window, tools, baselines
- Visual progress bar with color coding:
  - Green (80-100%): Complete data
  - Yellow (50-79%): Partial data
  - Red (0-49%): Insufficient data

### 2. Missing Metrics Tracking
- Structured list of what's missing
- Each metric includes:
  - Label (e.g., "Action Plans", "Urge Before/After Ratings")
  - Why it matters
  - How to fix it
  - CTA button with deep link to relevant page

### 3. Section-Level Coverage
- Each section (snapshot, risk window, tools) shows coverage %
- Empty states with friendly guidance when data insufficient
- "Unlock this by doing X" instructions
- Direct links to Playbook for action

### 4. Transparent Data Display
- Confidence indicators for tool effectiveness (high/medium/low based on sample size)
- Sample counts displayed ("Confidence: medium • 7 samples")
- Coverage reasons shown when sections are partial
- No guessing or hallucination - only displays what's backed by data

### 5. Improved UI/UX
- Matches AskMe AI design system:
  - Purple gradient header
  - White rounded cards
  - Soft shadows (0 1px 3px rgba(0,0,0,0.1))
  - Consistent typography
  - Same button styles as Playbook
- Responsive layout
- Smooth transitions and hover states
- Color-coded deltas (green for improvements, red for regressions)

## API Changes

### Request Parameters (unchanged)
```json
{
  "email": "user@example.com",
  "range_key": "last_7_days | last_30_days | last_90_days | since_beginning",
  "compare_mode": "previous_period | baseline | none",
  "track_id": "porn"
}
```

### Response Structure (enhanced)
```json
{
  "report_completeness": {
    "percent_complete": 65,
    "missing_metrics": [
      {
        "key": "urge_data",
        "label": "Urge Before/After Ratings",
        "why_it_matters": "Urge ratings show which tools actually drop your urge level",
        "how_to_fix": "When logging completions, rate urge before (0-10) and after",
        "cta": { "label": "Learn how", "href": "/playbook" }
      }
    ],
    "coverage": {
      "activity": { "available": true, "pct": 100, "reasons": [] },
      "urge_tracking": { "available": false, "pct": 0, "reasons": ["No urge ratings logged"] },
      "risk_window": { "available": true, "pct": 50, "reasons": ["Need more completion timestamps"] },
      "tools": { "available": false, "pct": 0, "reasons": ["No tool usage data"] },
      "baselines": { "available": true, "pct": 70, "reasons": ["Goal baseline not set"] }
    }
  },
  "snapshot": { "metrics": {...}, "insights": {...} },
  "compare_snapshot": null,
  "delta": null,
  "cached": false
}
```

## Testing

### Manual Testing Steps
1. **Empty State**: Visit `/playbook/insights` with new user (no data)
   - Should show 0-20% completeness
   - All sections show empty states with CTAs
   - Missing metrics panel shows 5+ missing items

2. **Partial Data**: Create 3 actions, mark 1 complete (no urge ratings)
   - Should show ~40-50% completeness
   - Activity section shows data
   - Other sections show empty states
   - Missing metrics reduced to 4 items

3. **Good Data**: Complete 10 actions with urge ratings in various categories
   - Should show 80-95% completeness
   - All sections show data
   - Tool effectiveness shows confidence levels
   - Risk window heatmap populates

4. **Complete Data**: Add track + goal baselines, continue logging
   - Should show 100% completeness
   - Green checkmark message
   - No missing metrics panel

### Automated Tests
Run: `node web/lib/coach-ai/__tests__/completeness.test.js`

Expected output:
```
✓ Scenario 1: Empty data - 20% - ✓ PASS
✓ Scenario 2: Partial data - 50% - ✓ PASS
✓ Scenario 3: Near-complete - 90% - ✓ PASS
✓ Scenario 4: Complete - 100% - ✓ PASS
```

## Migration Required

Run the insights snapshots migration:
```sql
-- Location: supabase/migrations/20260214_user_insight_snapshots.sql
-- Creates user_insight_snapshots table for caching
```

## Next Steps / Future Enhancements

1. **Add more granular tool categories**: Break down DEVICE_FRICTION into sub-types
2. **Track completion context**: Add location/time-of-day to completions for richer patterns
3. **Personalized recommendations**: Use completeness gaps to suggest specific actions
4. **Progress timeline**: Show completeness improvements over time
5. **Shareable reports**: Export insights as PDF or image
6. **Benchmark comparisons**: Anonymous aggregate data for "you vs. similar users"

## Known Limitations

1. **Cache invalidation**: Currently based on 6-hour TTL + new events check. Could be more sophisticated.
2. **CommonJS/ESModules**: The TypeScript completeness module may need compilation for the test file. Consider using ts-node or jest for tests.
3. **No slip timestamp tracking**: Risk window currently based on action completion times. Adding slip event timestamps would improve accuracy.
4. **Tool categories**: Currently based on action metadata. If categories aren't set on all actions, tool effectiveness may be incomplete.

## Code Review Checklist

- [x] Authentication fixed (uses Supabase session)
- [x] Completeness computation logic implemented
- [x] API returns enhanced structure with completeness
- [x] UI shows completeness indicator
- [x] Missing metrics shown with CTAs
- [x] Empty states for all sections
- [x] Coverage indicators added
- [x] Tests created
- [x] Matches AskMe AI design system
- [x] No data guessing/hallucination
- [x] Responsive layout
- [x] TypeScript types added

## Files to Review

**Backend**:
- `web/lib/coach-ai/completeness.ts` - Core completeness logic
- `web/lib/coach-ai/schema.ts` - TypeScript types
- `web/pages/api/coach/insights-detailed.ts` - API endpoint

**Frontend**:
- `web/pages/playbook/insights.js` - Main insights report page
- `web/pages/playbook.js` - Added "View report" button

**Tests**:
- `web/lib/coach-ai/__tests__/completeness.test.js` - Unit tests

**Database**:
- `supabase/migrations/20260214_user_insight_snapshots.sql` - Already exists, needs to be run
