# Seed-Based AI Generation Implementation

## Overview

The AI generation system now supports "seeding" where user-entered text guides AI suggestions to be semantically aligned with the user's intent, preventing generic or irrelevant responses.

## What Changed

### 1. Frontend Updates ([playbook.js](c:\opt\mvp\web\pages\playbook.js))

**Goal Generation:**
- Now passes `seedGoalTitle` and `seedGoalDescription` from the form fields to `/api/coach/goals`
- If user types "abstain from porn 30 days", AI will generate abstinence-focused goals

**Action Generation:**
- Now passes `seedActionText` from the action input field to `/api/coach/actions`
- If user types "do cardio for few minutes", AI will generate cardio-adjacent actions

### 2. Backend API Routes

**[/api/coach/goals](c:\opt\mvp\web\pages\api\coach\goals.ts):**
- Accepts `seedGoalTitle` and `seedGoalDescription` parameters
- Checks alignment between seed and generated goals
- Retries once with stricter prompt if alignment fails

**[/api/coach/actions](c:\opt\mvp\web\pages\api\coach\actions.ts):**
- Accepts `seedActionText` parameter
- Checks alignment between seed and generated actions
- Retries once with stricter prompt if alignment fails

### 3. Prompt Builders ([prompts.ts](c:\opt\mvp\web\lib\coach-ai\prompts.ts))

**Updated Interfaces:**
- `GoalContext`: Added `seedGoalTitle?` and `seedGoalDescription?`
- `ActionContext`: Added `seedActionText?`

**Updated Prompts:**
- `buildGoalPrompt()`: Includes "USER INTENT SEED" section with alignment rules when seed exists
- `buildActionPrompt()`: Includes "USER INTENT SEED" section with alignment rules when seed exists

**Alignment Rules Enforced:**
- All generated items must be semantically aligned to the seed
- Generic defaults ("breathe", "drink water") are banned unless seed is explicitly generic
- Each output must be a close variant of what the user typed

### 4. Alignment Checker ([alignment.ts](c:\opt\mvp\web\lib\coach-ai\alignment.ts))

New utility module with:
- `checkGoalAlignment()`: Validates 2+ out of 3 goals match seed intent
- `checkActionAlignment()`: Validates 2+ out of 3 actions match seed intent  
- `buildRetryPrompt()`: Builds enhanced prompt for retry attempts
- Keyword-based similarity matching (30% overlap or 2+ keyword matches)

## How It Works

### Goal Flow

1. User opens "Create Goal" modal
2. User types: "I want to abstain from porn for 30 days"
3. User clicks "AI Suggest Goals"
4. Frontend sends:
   ```json
   {
     "email": "user@example.com",
     "seedGoalTitle": "I want to abstain from porn for 30 days",
     "seedGoalDescription": ""
   }
   ```
5. Backend builds prompt with USER INTENT SEED section
6. AI generates 3 goals (e.g., "30-day abstinence streak", "Zero sessions this month", "Complete porn-free month")
7. Backend checks alignment: Do 2+ goals contain keywords like "abstain", "30", "days"?
8. If no: Retry with stricter prompt saying "Your last output didn't match. Try again."
9. Return aligned goals to user

### Action Flow

1. User is in "Create Action" modal for a goal
2. User types: "do cardio for few minutes"
3. User clicks "Generate Actions with AI"
4. Frontend sends:
   ```json
   {
     "email": "user@example.com",
     "goalLabel": "Break bedtime porn habit",
     "goalType": "track",
     "seedActionText": "do cardio for few minutes"
   }
   ```
5. Backend builds prompt with USER INTENT SEED section
6. AI generates 3 actions (e.g., "Walk outside 15 min", "Easy jog 10 min", "Stairs/pace indoors 8 min")
7. Backend checks alignment: Do 2+ actions contain movement/exercise keywords?
8. If no: Retry once with "Your outputs must be CARDIO variants, not breathing exercises"
9. Return aligned actions to user

## Testing Guide

### Test Case 1: Goal Seed Alignment

**Input:** "abstain from porn 30 days"

**Expected Output:**
✅ "30-day abstinence challenge"
✅ "Zero sessions this month"
✅ "Complete porn-free 30 days"

❌ NOT: "Practice mindfulness daily", "Journal feelings weekly"

**How to Test:**
1. Open Playbook modal → Create Goal
2. Type "abstain from porn 30 days" in the description field
3. Click "AI Suggest Goals"
4. Verify all 3 suggestions are abstinence/containment focused

### Test Case 2: Action Seed Alignment (Movement)

**Input:** "do cardio for few minutes"

**Expected Output:**
✅ "Walk outside 15 min"
✅ "Easy jog 10 min"
✅ "Stairs/pace indoors 8 min"

❌ NOT: "Take deep breaths", "Drink water", "Leave the room"

**How to Test:**
1. Open Playbook modal → Select a goal → Create Action
2. Type "do cardio for few minutes" in the action text field
3. Click "Generate Actions with AI"
4. Verify all 3 suggestions are cardio/movement variants

### Test Case 3: Action Seed Alignment (Device Control)

**Input:** "block social media at night"

**Expected Output:**
✅ "Enable Screen Time for Instagram/TikTok 9pm-7am"
✅ "Move social apps to folder '10pm access'"
✅ "Set Digital Wellbeing limit 15min after 9pm"

❌ NOT: "Take a walk", "Call a friend", "Breathe deeply"

**How to Test:**
1. Create Action modal
2. Type "block social media at night"
3. Click Generate
4. Verify device friction / app blocking focus

### Test Case 4: No Seed (Baseline Behavior)

**Input:** Leave fields empty, click generate

**Expected Output:**
- Normal AI generation based on severity + goals
- No alignment check performed
- Standard archetype-based suggestions

**How to Test:**
1. Open Create Goal modal, leave fields empty
2. Click "AI Suggest Goals"
3. Should work normally without seed logic

### Test Case 5: Weak Seed That Should Be Rejected

**Input:** "exercise" → generates "breathe deeply"

**Expected Behavior:**
- First attempt may include generic action
- Alignment check should FAIL (no keyword match)
- Retry should produce better aligned actions
- Check console logs for "⚠️ Action alignment failed, retrying"

**How to Test:**
1. Type "exercise" as action seed
2. Watch browser console (F12)
3. Look for retry logs
4. Verify final output is exercise-focused

## Debugging

### Console Logs to Watch For

**Success Path:**
```
🎯 Generating goals for: { userId: "...", hasSeed: true }
🎯 Goal alignment check: { aligned: true, matchCount: 3 }
```

**Retry Path:**
```
🎯 Goal alignment check: { aligned: false, matchCount: 1, reason: "..." }
⚠️ Goal alignment failed, retrying with stricter prompt
🎯 Retry alignment check: { aligned: true, matchCount: 2 }
```

### API Request Inspection

Open browser DevTools → Network tab → Look for:

**Goals Request:**
```json
{
  "email": "user@example.com",
  "seedGoalTitle": "abstain from porn 30 days",
  "seedGoalDescription": ""
}
```

**Actions Request:**
```json
{
  "email": "user@example.com",
  "goalLabel": "Break bedtime habit",
  "seedActionText": "do cardio"
}
```

## Technical Details

### Alignment Algorithm

The system uses keyword-based similarity:
1. Extract significant words (3+ chars, excluding stop words)
2. Compare seed keywords to output keywords
3. Require 30% overlap OR 2+ matching keywords
4. For goal alignment: Need 2/3 goals to match
5. For action alignment: Need 2/3 actions to match

**Example:**
- Seed: "do cardio few minutes"
- Keywords: ["cardio", "few", "minutes"]
- Action: "Walk outside 15 min"
- Keywords: ["walk", "outside", "min"]
- Match: "min" matches "minutes" → PASS (1/3 keywords)
- But this is weak, so better to have more semantic overlap

### Token Cost

- Each generation still costs the same tokens
- Retry adds extra tokens (only if alignment fails)
- User is charged once regardless of retry
- Total token usage is logged in `coach_ai_usage_logs`

## Files Modified

1. **Frontend:**
   - [web/pages/playbook.js](c:\opt\mvp\web\pages\playbook.js) - Added seed fields to API requests

2. **Backend:**
   - [web/pages/api/coach/goals.ts](c:\opt\mvp\web\pages\api\coach\goals.ts) - Added seed acceptance + alignment check
   - [web/pages/api/coach/actions.ts](c:\opt\mvp\web\pages\api\coach\actions.ts) - Added seed acceptance + alignment check

3. **Prompt System:**
   - [web/lib/coach-ai/prompts.ts](c:\opt\mvp\web\lib\coach-ai\prompts.ts) - Updated interfaces + prompt builders

4. **New Module:**
   - [web/lib/coach-ai/alignment.ts](c:\opt\mvp\web\lib\coach-ai\alignment.ts) - Alignment checking utilities

## Notes

- The alignment check is **heuristic-based** and may have false positives/negatives
- Consider upgrading to embedding-based similarity for production
- Retry logic is limited to **1 retry** to avoid excessive token usage
- Empty seed fields = no alignment check (normal behavior)
- Seed text is trimmed and normalized before checking
