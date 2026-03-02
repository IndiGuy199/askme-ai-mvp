# Goal & Action Tracking — Data Flow Reference

## Overview

This document describes exactly how goals and actions move through the system from suggestion to active to swapped-out, and which database tables are involved at each stage.

---

## Database Tables

| Table | Purpose |
|---|---|
| `coach_wellness_goals` | Catalogue of all pre-built goal templates (shared, not per-user) |
| `user_wellness_goals` | The user's personal goal instances — one row per goal the user has ever adopted |
| `action_plans` | Individual actions (reps) assigned to a goal — one row per action |
| `action_completions` | Every time a user taps "Log" — one row per log event |
| `action_deletions` | Soft-delete log: when an action is removed/swapped |
| `user_action_events` | Event log for action-level changes (add, remove, swap) |
| `user_goal_events` | Event log for goal-level changes (swap, deactivate) |
| `user_goal_baselines` | Baseline scores captured when a goal is first activated |
| `user_track_baselines` | Baseline for the primary track (e.g. porn recovery) |

---

## Goal Lifecycle

### 1. Suggested to the User

- The manage modal calls `GET /api/coach/goals` which generates goal options using AI.
- Options are sourced from `coach_wellness_goals` (pre-built) or AI can create custom ones.
- Custom goals are inserted into `coach_wellness_goals` with a `goal_id` like `custom_<slug>_<timestamp>`.
- Nothing is written to `user_wellness_goals` yet — user has only seen the suggestion.

### 2. User Selects a Goal → Active

When the user confirms a goal:

1. A new row is inserted into **`user_wellness_goals`**:
   - `user_id` = the user
   - `coach_wellness_goal_id` = FK to `coach_wellness_goals.id`
   - `is_active = true`
   - `goal_slot` = `'track'` (primary) or `'second'`
   - `selected_at` = now

2. AI generates 2–3 action suggestions for that goal.

3. Each accepted action is inserted into **`action_plans`**:
   - `user_id` = the user
   - `goal_id` = **`coach_wellness_goals.goal_id`** (TEXT field, NOT `user_wellness_goals.id`)
   - `action_text` = the action description
   - `is_complete = false`
   - `coach_metadata` = AI-enriched JSON (trigger, category, duration, etc.)

4. A baseline survey row is written to **`user_goal_baselines`** if baseline data was collected.

5. A `user_goal_events` row is inserted with `event_type = 'activate'`.

> ⚠️ **Critical**: `action_plans.goal_id` stores `coach_wellness_goals.goal_id` (a TEXT slug/UUID), NOT `user_wellness_goals.id`. These are different identifiers. This is the source of all "orphaned action" bugs.

### 3. Goal is Active — Daily Usage

- Playbook loads active goals via:
  ```
  user_wellness_goals WHERE user_id = X AND is_active = true
    JOIN coach_wellness_goals → get goal_id (TEXT)
  ```
- Then loads actions via:
  ```
  action_plans WHERE user_id = X AND is_complete = false AND goal_id IN (active coach goal_ids)
  ```
- UI caps displayed actions at **3 per goal** (`.slice(0, 3)` in `fetchActionsForGoals`).

- Each time user logs an action → insert into **`action_completions`**:
  - `user_id`, `action_id`, `logged_at`, `completion_status` (done/partial), `urge_before_0_10`, `urge_after_0_10`

### 4. Goal is Swapped Out

When the user swaps a goal for a new one:

1. Old `user_wellness_goals` row: `is_active = false`
2. New `user_wellness_goals` row inserted: `is_active = true`
3. Old `action_plans` rows: **NOT deleted, NOT marked `is_complete`** — they remain as orphaned rows with `is_complete = false`, just no longer under an active goal.
4. New actions inserted into `action_plans` with new `goal_id`.
5. A row written to **`user_goal_events`** with `event_type = 'swap'`, `swapped_out_goal_id`, `swapped_goal_id`.
6. Old actions may be logged to **`action_deletions`** or **`user_action_events`** (event_type='remove') depending on code path.

> ⚠️ **Orphaned actions**: Swapping a goal does NOT clean up old `action_plans`. They stay in the DB with `is_complete = false` forever unless explicitly deleted. This inflates action counts if filters are not applied correctly.

### 5. Action is Removed/Swapped (without swapping the goal)

1. Old `action_plans` row: deleted or `is_complete = true`
2. A row written to **`action_deletions`**: `original_action_id`, `deleted_at`
3. A row written to **`user_action_events`**: `event_type = 'remove'`, `from_action_id`
4. New action inserted into `action_plans` with same `goal_id`

---

## How AI Context Counts "Active Actions"

### Weekly Patterns Summary (`/api/coach/insights` → `buildInsightContext`)

```
1. Fetch user_wellness_goals WHERE user_id = X AND is_active = true
   JOIN coach_wellness_goals to get goal_id (TEXT)
   
2. Collect active coach goal_id values

3. Fetch action_plans WHERE user_id = X 
   AND is_complete = false 
   AND goal_id IN (active coach goal_id values)

4. Deduplicate by action_text per goal (removes DB duplicates)
   Cap at 3 per goal (matches playbook UI display limit)
   → last7DaysActions = deduplicated count

5. Fetch action_completions WHERE user_id = X
   AND logged_at >= 7 days ago
   → last7DaysCompletions = count
```

### Detailed Insights Report (`/api/coach/insights-detailed` → `getInsightMetrics`)

```
1. Fetch all action_plans created before endDate
   JOIN via: user_wellness_goals → coach_wellness_goals(goal_id)
   
2. Cross-reference action_deletions + user_action_events(remove)
   to build a removalDate map per action_id
   
3. Filter to actions ACTIVE during report period using existsDuringRange()

4. Further filter: only actions whose goal_id is in currently is_active 
   coach_wellness_goals.goal_id set
   
5. actionsPlanned = count of above filtered actions
```

---

## Known Data Integrity Issues

| Issue | Cause | Impact |
|---|---|---|
| Orphaned `action_plans` rows | Swapping a goal does not delete old plans | Old actions counted if goal filter is missing |
| Duplicate `action_plans` rows | User adds same action twice, or bug in add flow | Count inflated by 1+ per duplicate |
| `action_plans.goal_id` inconsistency | Some code paths write `user_wellness_goals.id`, others write `coach_wellness_goals.goal_id` | Goal-ID based filters may miss or double-count |

---

## Correct Filter Pattern — Always Use This

To get the actions a user is actively working on (matching what the playbook shows):

```typescript
// Step 1: get active coach goal_ids
const { data: activeGoals } = await supabase
  .from('user_wellness_goals')
  .select('id, coach_wellness_goals(goal_id)')
  .eq('user_id', userId)
  .eq('is_active', true);

const activeCoachGoalIds = activeGoals
  .map(g => g.coach_wellness_goals?.goal_id)
  .filter(Boolean);

// Step 2: fetch and deduplicate actions (cap 3/goal, same as UI)
const { data: plans } = await supabase
  .from('action_plans')
  .select('id, goal_id, action_text')
  .eq('user_id', userId)
  .eq('is_complete', false)
  .in('goal_id', activeCoachGoalIds);

// Deduplicate by action_text, cap 3 per goal
```
