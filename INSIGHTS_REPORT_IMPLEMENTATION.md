# Insights Report  Implementation Reference

> **Last updated:** Post Phase 3 — v3 stable schema, schema guard, compare confidence gating, deterministic weekly pipeline.
> Previous versions of this document described bugs and proposed fixes. Those fixes are now **implemented and live**. This document describes the **current, working** system.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Two Insight Pipelines](#2-two-insight-pipelines)
3. [Data Sources](#3-data-sources)
4. [getInsightMetrics  The Core Algorithm](#4-getinsightmetrics--the-core-algorithm)
5. [Completeness Scoring Algorithm](#5-completeness-scoring-algorithm)
6. [AI Prompt Strategy](#6-ai-prompt-strategy)
7. [Weekly Insights Pipeline](#7-weekly-insights-pipeline)
8. [Caching Strategy](#8-caching-strategy)
9. [Slip Events Integration](#9-slip-events-integration)
10. [Output Schema](#10-output-schema)
11. [Recent Changes Summary](#11-recent-changes-summary)

---

## 1. System Overview

The insights system answers one question: **"What did this user actually DO during this period, and what worked?"**

It drives two surfaces:
- **Weekly Insights card**  quick 7-day summary with 3 insight bullets + next experiment
- **Detailed Insights Report**  full 5-section report with completeness score, compare period, and structured AI findings

Both surfaces share the same underlying `getInsightMetrics()` aggregation function and the same GPT-4o-mini model. Prompts differ in verbosity and output schema.

---

## 2. Two Insight Pipelines

### Pipeline A  Weekly (`/api/coach/insights`)

```
getInsightMetrics()     (context.ts)    Full 11-section aggregation
        
deriveWeeklyBullets()   (prompts.ts)    DETERMINISTIC — no model call
        
Weekly card response    (challenge_id, timeframe_days, low_confidence, insufficient_data, insights, next_week_plan)
```

Used for the weekly summary card. **No AI model call** — insights are derived deterministically from `InsightMetrics` by `deriveWeeklyBullets()`. Zero token cost. Outputs: `risk_window`, `best_tool`, `best_lever`, `next_week_plan.keep/change/try`, plus `low_confidence` and `insufficient_data` flags for UI display.

### Pipeline B  Detailed (`/api/coach/insights-detailed`)

```
getInsightMetrics()          (context.ts)    Heavy 11-section aggregation
        
buildCompactInsightPrompt()  (prompts.ts)    Compact JSON payload
        
GPT-4o-mini
        
DetailedInsightDataSchema    (risk_window, best_tool, best_lever, insights[], next_experiment)
        
computeReportCompleteness()  (completeness.ts)  5-section weighted score
        
Cache write + response
```

Optionally runs a **compare period** (previous equal-length window) in parallel for delta calculations.

---

## 3. Data Sources

`getInsightMetrics()` performs fetches across 11 data sources:

| # | Table | Purpose |
|---|-------|---------|
| 1 | `action_plans` | Actions active during period (`is_active=true`, `created_at  endDate`) |
| 2 | `action_deletions` | Removal dates  used to cap action active window |
| 3 | `user_action_events` (type=remove) | Alternative removal event source |
| 4 | `user_wellness_goals` | Goals active during period |
| 5 | `user_goal_events` | Goal swap events  used to reconstruct which goals were active |
| 6 | `action_completions` | Completion logs with `completion_status`, `completion_percent`, urge before/after |
| 7 | `user_track_baselines` | Track-level baseline (self-assessment) |
| 8 | `user_goal_baselines` | Goal-level baseline |
| 9 | `progress` | Legacy slip logs (slip_count, status=slip/relapse) |
| 10 | `slip_events` | Structured slip logs with `slipped_at`, `trigger_label`, `urge_level` |
| 11 | `support_sessions` | Support Now sessions with pre/post urge ratings |

### Key Design Decision: Temporal Queries

Actions are fetched with:
```sql
is_active = true AND created_at <= endDate
```
Then cross-referenced against `action_deletions` + `user_action_events(remove)` to find when each action was removed. Only actions whose existence window **overlaps** the report period are included.

Completions are fetched using `logged_at` (not `created_at`) as the range filter  `logged_at` is explicitly set by `log-action.ts` and is indexed.

---

## 4. getInsightMetrics  The Core Algorithm

### Section 1: Temporal Action Filtering

```typescript
// Fetch all active actions created before endDate
allActions = action_plans WHERE is_active=true AND created_at <= endDate

// Build removal map from action_deletions + user_action_events(remove)
removalDateMap: action_id  earliest removal date

// Keep only actions whose window overlaps [startDate, endDate]
activeActions = allActions.filter(a =>
  existsDuringRange(a.created_at, removedAt, startDate, endDate)
)

// Further restrict to currently active goals
activeActions = activeActions.filter(a => activeCoachGoalIds.has(a.goal_id))
```

### Section 2: Action Days Available

For each action, calculate how many days it was active **within the report period**:

```typescript
actionStart = max(action.created_at, startDate)
actionEnd   = removedAt ? min(removedAt, endDate) : endDate
daysActive  = ceil((actionEnd - actionStart) / dayMs)  // minimum 1

totalActionDaysAvailable = sum of all daysActive
```

This enables **opportunity-based completion rate**: `completionRate = log_count / totalActionDaysAvailable` (capped at 1.0).

### Section 3: Completions

```typescript
completions = action_completions WHERE logged_at IN [startDate, endDate]

doneCount    = completions WHERE status !== 'partial'
partialCount = completions WHERE status === 'partial'
actionsLogged = completions.length

completionQualityAvg = avg(
  completion_percent ?? (status === 'partial' ? 50 : 100)
)

completionRate = min(1.0, actionsLogged / totalActionDaysAvailable)
```

### Section 4: Urge Metrics

Only completions with **both** `urge_before_0_10` and `urge_after_0_10` populated count as "urge pairs":

```typescript
avgBefore = mean(urge_before_0_10)
avgAfter  = mean(urge_after_0_10)
avgDrop   = avgBefore - avgAfter
```

Urge confidence tiers:
- `high`:  10 pairs
- `medium`: 59 pairs
- `low`: 14 pairs
- `none`: 0 pairs

### Section 5: Urge Drop by Category

For each action completion, the action's category is extracted from `coach_metadata.category` (JSONB). Urge drops are grouped by category:

```typescript
avgDrop       = mean(urge_before - urge_after) per category
completionRate = category_completions / category_total_actions
```

Only categories with at least 1 urge pair are included.

### Section 6: Risk Window

Top 3 hours by completion frequency become `top_hours`. The peak 2-hour window is reported as `risk_window_label` (e.g. `"10pm12am"`). If a completion had `urge_before >= 7`, its hour is flagged as `urge_spike`.

Risk window confidence uses constants `RISK_LOGS_HIGH_MIN` and `RISK_LOGS_MEDIUM_MIN`:
- `high`:  HIGH_MIN timestamped logs
- `medium`:  MEDIUM_MIN
- `low`:  1
- `none`: 0

### Section 7: Best Tools (Category Scoring)

Each category gets a composite score:
```typescript
dropScore  = min(avgDrop / 10, 1)    // normalized to 01
toolScore  = (dropScore  0.5) + (completionRate  0.5)
```

- `why` text: e.g. "drops urge by 3.2pt avg" or "78% completion rate"
- Top 3 categories returned sorted by score descending

### Section 8: Track & Goal Baselines

Parallel fetches from `user_track_baselines` and `user_goal_baselines`. Used to enrich the prompt and add bonus points to completeness score.

### Section 9: Slip Data (Dual Source)

Slips are merged from two tables:

```typescript
// Legacy: progress table
progressLogs  slipCount += slip_count OR (status === 'slip'|'relapse' ? 1 : 0)

// New: slip_events table (structured, with slipped_at set by user)
slipEventRows = slip_events WHERE slipped_at IN [startDate, endDate] ORDER BY slipped_at DESC

slipCount += slipEventRows.length
lastSlipAt = slipEventRows[0].slipped_at  // most recent structured slip

// Both sources merged into calendar-day map
slipDays: Map<date, count>  // key = YYYY-MM-DD

totalSlipDays  = slipDays.size
multiSlipDays  = days where count > 1
secondSessionRate = (multiSlipDays / totalSlipDays)  100
  // computed only when totalSlipDays >= 3, otherwise null
```

### Section 10: Confidence & Metadata

```typescript
hasEnoughData = actionsLogged >= 3 && actionsPlanned >= 1
```

### Section 11: Support Sessions

```typescript
sessionRows = support_sessions WHERE created_at IN [startDate, endDate]

supportAvgPre  = mean(pre_urge_intensity)
supportAvgPost = mean(post_urge_rating)
supportAvgDrop = supportAvgPre - supportAvgPost
// only computed when rows have both fields populated
```

---

## 5. Completeness Scoring Algorithm

`computeReportCompleteness(metrics)` in `completeness.ts` returns a weighted 0100 score and lists of missing/improvement items.

### Five Weighted Sections

| Section | Weight | Key Inputs |
|---------|--------|-----------|
| Activity | 35% | `actions_planned`, `completion_rate`, `completion_quality_avg` |
| Completions | 20% | `actions_logged`, `done_count`, `partial_count` |
| Urge Tracking | 20% | `urge_pairs` count, `urge.confidence` |
| Risk Window | 15% | `top_hours.length`, `timestamped_logs`, `risk_window.confidence` |
| Tools | 10% | `best_categories.length`, sample drop counts |

### Overall Score Formula

```typescript
overallScore = (
  activity_score     0.35 +
  completions_score  0.20 +
  urge_score         0.20 +
  risk_score         0.15 +
  tools_score        0.10
)

// Baseline bonuses
if (hasTrackBaseline) overallScore += 5
if (hasGoalBaseline)  overallScore += 5

overallScore = min(100, overallScore)
```

### Section Formulas

**Activity (0100):**
```typescript
if (actions_planned === 0)  0  // hard missing
else:
  score = 40                                       // planned base
  score += min(40, completionRate  40)            // rate contribution
  score += min(20, (completionQualityAvg/100)  20) // quality bonus
```

**Completions (0100):**
```typescript
if (logs === 0)   0
if (logs < 3)     30 + (logs/3)  30    // 3060
if (logs >= 3):
  score = 60
  score += (doneCount > 0 && partialCount > 0) ? 20 : 10  // mixed type bonus
  score += min(20, (min(logs, 10) / 10)  20)              // volume bonus
```

**Urge Tracking (0100):**
```typescript
if (pairs === 0)             0    // missing item generated
if (pairs < 5)               30 + (pairs/5)  50   // improvement item
if (confidence === 'low')    60   // improvement item
if (confidence === 'medium') 80
if (confidence === 'high')   100
```

**Risk Window (0100):**
```typescript
if (top_hours.length === 0)         0
if (confidence === 'low')           25
if (confidence === 'medium')        70
if (confidence === 'high')          100
```

**Tools (0100):**
```typescript
if (toolCategories === 0)  0
else:
  score = 40
  score += min(30, toolCategories  15)    // category breadth
  score += min(30, min(totalDrops, 10)  3) // drop sample depth
```

### Missing vs Improvement Items

- **Missing**  data entirely absent; shown prominently with CTA button (e.g. "Add 3 actions to Playbook")
- **Improvement**  data present but below threshold; shown as tips (e.g. "Log 3 more actions with urge ratings")

---

## 6. AI Prompt Strategy

### buildCompactInsightPrompt

Constructs a compact JSON metrics payload targeting < 1200 chars AI output:

```typescript
compact = {
  period,
  actions_planned, actions_logged, done, partial,
  completion_rate, action_days_available, completion_quality_avg,
  urge_avg_before, urge_avg_after, urge_avg_drop, urge_confidence,
  risk_window_label, risk_window_confidence, top_hours: [3],
  best_tools: [{ cat, score, why, n }],
  support_sessions, support_avg_pre_urge, support_avg_post_urge, support_avg_urge_drop,
  samples: { actions, completions, urge_pairs, timestamped_logs, goals_active, drops }
}
```

**Slip suppression rule (Rule 9):**
Slip fields (`slips`, `last_slip_at`, `second_session_rate`) are **only added when `slip_count > 0`**. This prevents AI from generating "0 slips" filler. Rule in prompt: *"If 'slips' field is absent from METRICS, do NOT mention slips anywhere in your output."*

**Compare period:** When a prior-period `compareMetrics` is provided, a compact delta blob is appended and the AI includes a `compare_summary` field (12 sentences on delta). Slips are also conditionally included in the compare delta.

### AI Output Schema (Detailed) — v3 stable

```typescript
{
  summary_paragraph: string      // coaching overview, no stat dump
  whats_working:     string[]    // 2-4 bullets: Observation→Meaning→Next step
  where_vulnerable:  string[]    // 2-4 bullets: risk areas
  patterns_triggers: string[]    // 2-4 bullets: patterns + risk window
  slip_analysis:     {           // null when slip_count == 0
    pattern:         string
    anti_binge_rule: string
    repair_step:     string
  } | null
  one_experiment: {
    title: string
    why:   string
    steps: string[]  // 3-5 steps
  }
  compare_section: {             // ALWAYS present
    label:   string              // "Compared to previous period" | "No comparison selected" | …
    bullets: string[]            // 0-3 bullets; empty when compare data is absent or low-confidence
  }
}
```

### Prompt Rules Summary (v3)

1. Every bullet: Observation → Meaning → Next step — all in one sentence.
2. Never list raw numbers as a standalone bullet.
3. `whats_working`, `where_vulnerable`, `patterns_triggers`: exactly 2 bullets each.
4. `one_experiment.steps`: exactly 3 steps.
5. **Category translation**: raw codes (e.g. `DEVICE_FRICTION`) are translated to plain English (`Phone barriers`) in the METRICS blob before sending. Model never sees raw codes.
6. `urge_confidence = low|none` → prefix urge bullet with `[low urge data]` and suggest 5+ action urge logs.
7. If 'slips' absent from METRICS → `slip_analysis` MUST be `null`. Do NOT mention slips anywhere.
8. If 'slips' present → `slip_analysis` MUST be a valid object.
9. `compare_section` ALWAYS present. `bullets = []` when compare data is absent or low-confidence.
10. No token cost text anywhere in output.

---

## 7. Weekly Insights Pipeline

The weekly endpoint calls `getInsightMetrics()` then passes the result to `deriveWeeklyBullets()` — a **deterministic function with no model call**.

`deriveWeeklyBullets(metrics, challengeId)` returns:
```typescript
{
  challenge_id:      string
  timeframe_days:    7
  low_confidence:    boolean  // true when data exists but sparse (urge pairs < 3, no best category)
  insufficient_data: boolean  // true when no actions planned or logged
  insights: {
    risk_window: string   // labels include confidence tier
    best_tool:   string
    best_lever:  string
  }
  next_week_plan: {
    keep:   string[]    // exactly 2
    change: string[]    // exactly 2
    try:    string[]    // exactly 2
  }
}
```

`low_confidence = true` → yellow "low confidence" pill in Playbook weekly card.  
`insufficient_data = true` → "See what's missing" link in Playbook weekly card.  
**Zero token cost for weekly insights.** `INSIGHT_GENERATION_TOKEN_COST` is only charged by the detailed endpoint.

---

## 8. Caching Strategy

Detailed insights are cached in `user_insight_snapshots`. Cache invalidation checks **9 data sources** in parallel:

```typescript
Promise.all([
  action_completions (created_at),
  action_completions (logged_at),   // explicit check catches sub-second gaps
  user_track_baselines,
  user_goal_baselines,
  user_action_events,
  user_goal_events,
  support_sessions,
  slip_events,
  action_plans
])
```

**TTL:** 4 hours  
**Cache key:** `userId:trackId:range_key:compare_mode` (stable string, no timestamps)  
**Stale:** any source has a row with `created_at` or `updated_at` newer than `cached_at`  
**Gap check:** completions between `end_at` and `created_at` of snapshot also invalidate the cache.

### Schema versioning in cache

Cached snapshots may contain v1 (old flat), v2, or v3 schema data. The UI renderer detects the version at render time:
- **v3**: `Array.isArray(ins.whats_working)` → true
- **v2**: `Array.isArray(ins.what_is_working)` → true  
- **v1**: `Array.isArray(ins.insights)` → true

`applySchemaGuard` only runs on fresh AI generations, not cached reads. Stale cached snapshots will be re-generated when the cache TTL expires or new data arrives.

---

## 9. Slip Events Integration

### Database Schema

```sql
CREATE TABLE slip_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  slipped_at    TIMESTAMPTZ NOT NULL,   -- user-specified time, supports retroactive logging
  trigger_label TEXT,                   -- stress|boredom|loneliness|late_night|anxiety|conflict|celebration|other
  urge_level    INT CHECK (urge_level BETWEEN 1 AND 10),
  notes         TEXT,
  recovery_note TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
-- RLS: users read/write only their own rows
```

### Retroactive Logging (Slip Modal)

The Playbook slip modal captures:
- **Date picker** (`max = today`): allows logging slips that happened days ago
- **Time of day select**: maps to midpoint UTC hours for `slipped_at` construction

| Selection | Midpoint Hour | Meaning |
|-----------|--------------|---------|
| Early morning (59am) | 06:00 | Night-to-morning transition |
| Morning (9am12pm) | 10:00 | Late morning |
| Afternoon (125pm) | 14:00 | Midday |
| Evening (59pm) | 19:00 | After-work hours |
| Late night (9pm5am) | 23:00 | Classic high-risk window |

**Construction logic:**
```javascript
const TOD_HOURS = { early_morning: 6, morning: 10, afternoon: 14, evening: 19, late_night: 23 }
const hour = TOD_HOURS[slipTimeOfDay] ?? 12
const slippedAt = new Date(`${slipOccurredAt}T${String(hour).padStart(2,'0')}:00:00`).toISOString()
// Falls back to new Date().toISOString() if date field is empty
```

### InsightMetrics.slips Shape

```typescript
slips: {
  slip_count:          number         // merged from progress + slip_events
  days_with_slips:     number         // unique calendar days
  last_slip_at:        string | null  // ISO from slip_events (most recent)
  second_session_rate: number | null  // % days with 2+ slips (null when days_with_slips < 3)
}
```

---

## 10. Output Schema

### InsightMetrics (full shape)

```typescript
{
  range: { start: string, end: string, label: string, days: number }
  activity: {
    actions_planned:         number
    actions_logged:          number
    done_count:              number
    partial_count:           number
    completion_rate:         number    // 01, opportunity-based
    action_days_available:   number    // sum of per-action active days
    completion_quality_avg:  number | null   // 0100 avg of completion_percent
  }
  urge: {
    avg_before:           number | null
    avg_after:            number | null
    avg_drop:             number | null
    drops_by_category:    [{ category, avg_drop, count, completion_rate }]
    confidence:           'high' | 'medium' | 'low' | 'none'
  }
  risk_window: {
    label:      string | null    // e.g. "10pm12am"
    top_hours:  [{ hour, count, signal }]
    confidence: 'high' | 'medium' | 'low' | 'none'
  }
  tools: {
    best_categories: [{ category, score, why, sample_size }]
  }
  baselines: {
    track: UserTrackBaseline | null
    goal:  UserGoalBaseline | null
  }
  slips: {
    slip_count:          number
    days_with_slips:     number
    last_slip_at:        string | null
    second_session_rate: number | null
  }
  support_sessions: {
    count:          number
    avg_pre_urge:   number | null
    avg_post_urge:  number | null
    avg_urge_drop:  number | null
  }
  meta: {
    has_enough_data: boolean
    sample_sizes: {
      actions: number, completions: number, urge_pairs: number,
      timestamped_logs: number, goals_active: number, drops: number
    }
  }
}
```

### ReportCompleteness

```typescript
{
  overall: number    // 0100 weighted score
  coverage: {
    activity:       { available: boolean, pct: number, reasons: string[] }
    completions:    { available: boolean, pct: number, reasons: string[] }
    urge_tracking:  { available: boolean, pct: number, reasons: string[] }
    risk_window:    { available: boolean, pct: number, reasons: string[] }
    tools:          { available: boolean, pct: number, reasons: string[] }
  }
  missing:      MissingMetric[]       // hard blockers with CTA
  improvements: ImprovementItem[]     // "X more logs to unlock Y"
}
```

---

## 11. Recent Changes Summary

### Phase 3 — v3 Schema + Schema Guard + Compare Confidence gating (current)
- **New AI output schema v3**: `summary_paragraph`, `whats_working`, `where_vulnerable`, `patterns_triggers`, `slip_analysis` (null | object), `one_experiment`, `compare_section` (always present). Old fields (`summary`, `what_is_working`, etc.) deprecated but still handled by UI renderer for cached snapshots.
- **`applySchemaGuard(data, compareMode, compareMetrics)`**: normalises AI output before saving/returning; fills all missing keys with safe human-readable defaults; overrides `compare_section` based on compare_mode + confidence; server logs on missing keys.
- **`deriveCompareConfidence(compareMetrics)`**: classifies compare data as `high/medium/low/none` from `completions`, `urge_pairs`, `timestamped_logs`; low/none → no compare bullets in prompt or response.
- **`translateCategoryCode(code)`** in prompt builder: METRICS blob uses plain-English tool names. Model never outputs raw codes like `DEVICE_FRICTION`. Translation map covers all 8 canonical categories + legacy codes.
- **`buildCompactInsightPrompt` accepts `compareMode` arg** (4th param): determines compare_section label in prompt.
- **Weekly pipeline fully deterministic**: `deriveWeeklyBullets()` replaced AI model calls. Zero token cost.
- **UI renderer v3**: `renderRecoveryInsights(ins)` detects v1/v2/v3 schema; renders `slip_analysis` from `slips_section` (v2) or `slip_analysis` (v3); renders experiment from `next_experiment` (v1/v2) or `one_experiment` (v3); each section always renders with "Not enough data yet" fallback when empty.
- **`compare_section` UI block**: always shown in "What changed" card when delta exists; displays label + bullets or "log more data" prompt when bullets empty; v2 fallback `compare_summary` string still supported.
- **Tests**: `prompt-builder.test.js` (30 assertions covering deriveCompareConfidence, translateCategoryCode, prompt keys, compare gating); `schema-guard.test.js` (36 assertions covering all compare modes, slip handling, null input, renderable contract).

### Phase 0+2 Temporal Rewrite
- **Fixed:** Actions only counted if `created_at` fell within period  now `created_at  endDate` + removal map overlap
- **Fixed:** Completions used `created_at` range filter  switched to `logged_at`
- **Fixed:** `completion_percent` column ignored  now used for `completionQualityAvg`
- **Fixed:** `category` was queried as a direct column  now extracted from `coach_metadata.category` JSONB
- **Added:** `action_days_available` as opportunity-based completion rate denominator
- **Added:** `completion_quality_avg` as Activity section bonus input

### Slip Events Integration
- Migration `20250618_add_slip_events.sql`: `slip_events` table with RLS
- `getInsightMetrics` Section 9: parallel fetch of `progress` + `slip_events`, merged into `slips` block
- `buildCompactInsightPrompt`: slip fields conditionally included; suppressed when `slip_count = 0`
- `insights-detailed.ts` cache invalidation: `slip_events` added to 8-way parallel staleness check
- Playbook slip modal: date picker + time-of-day select for retroactive logging
- `handleSaveSlip`: constructs `slipped_at` from date + TOD midpoint hours

### Urge Toggle in Log Modal
- Urge before/after sliders hidden by default (`logTrackUrge = false`)
- Toggle resets to OFF on each modal open  reduces friction for quick logs
- Sliders appear only when toggle is ON

### Completions Bug Fix (Detailed Insights)
- Removed `truncateToHour` call that was collapsing `logged_at` timestamps and causing 0-completion reports
- Cache invalidation gap-check now uses raw ISO string comparison

### Token Grant
- `grant_profile_tokens(uid)` RPC: atomic `UPDATE WHERE welcome_tokens_granted_at IS NULL`
- Idempotent  safe to call multiple times; grants 5,000 tokens only once per user

---

*Source files:*
- *`web/lib/coach-ai/context.ts`  `getInsightMetrics()`*
- *`web/lib/coach-ai/completeness.ts`  `computeReportCompleteness()`*
- *`web/lib/coach-ai/prompts.ts`  `buildCompactInsightPrompt()`, `buildInsightPrompt()`*
- *`web/lib/coach-ai/schema.ts`  TypeScript types*
- *`web/pages/api/coach/insights-detailed.ts`  Detailed report endpoint*
- *`web/pages/api/coach/insights.ts`  Weekly card endpoint*
