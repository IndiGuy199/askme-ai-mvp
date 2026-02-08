# Coach AI Integration Guide

## Overview
Complete separation of Coach AI (goals/actions/insights) from Chat AI system.

**Why separate?**
- Chat is unoptimized and expensive (will be fixed later)
- Coach outputs need structured JSON and personalized context
- Separate token accounting and usage tracking
- Different prompt strategies and validation

---

## Architecture

### Service Layer: `/web/lib/coach-ai/`

1. **prompts.ts** - Severity-aware prompt templates with user context
2. **context.ts** - Builds personalized context from Supabase (assessments, completion rates, etc.)
3. **schema.ts** - Zod schemas for strict JSON validation
4. **client.ts** - OpenAI wrapper with retry logic and fallback generators

### API Routes: `/web/pages/api/coach/`

1. **POST /api/coach/goals** - Generate 3-4 personalized recovery goals
2. **POST /api/coach/actions** - Generate 4-6 micro-actions for a goal
3. **POST /api/coach/insights** - Generate weekly insights + next-week plan

### Database

**New table:** `coach_ai_usage_logs`
- Tracks token usage per generation type (goals/actions/insights)
- Separate from chat_messages table
- Includes success/failure tracking

**Migration:** `supabase/migrations/20260207_coach_ai_usage_logs.sql`

---

## Token Costs

| Generation Type | Token Cost | Typical Use Case |
|----------------|-----------|------------------|
| Goals          | 100       | Onboarding or adding new goal |
| Actions        | 75        | Generating action plan for goal |
| Insights       | 100       | Weekly dashboard summary |

**Chat remains separate** (costs TBD, will be optimized later)

---

## API Usage

### 1. Generate Goals

**Endpoint:** `POST /api/coach/goals`

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "challenge_id": "porn_addiction",
  "severity": "growing",
  "goals": [
    {
      "label": "Cut frequency by 50%",
      "description": "Reduce porn sessions by half over 30 days using structured replacement + tracking.",
      "goal_type": "track",
      "suggested_duration_days": 30,
      "why_this_now": "Your assessment shows a growing pattern that needs interruption before it becomes compulsive."
    }
  ],
  "tokens_used": 100,
  "tokens_remaining": 900
}
```

**Personalization:**
- Uses user's latest severity assessment
- Considers completion rate (last 30 days)
- Avoids suggesting duplicate goals
- Severity-specific tone and complexity

---

### 2. Generate Actions

**Endpoint:** `POST /api/coach/actions`

**Request:**
```json
{
  "email": "user@example.com",
  "goalId": "porn_addiction_goal_3"
}
```

**Response:**
```json
{
  "goal_id": "porn_addiction_goal_3",
  "actions": [
    {
      "title": "Put phone in another room before 10pm",
      "duration_minutes": 2,
      "difficulty": "easy",
      "category": "environment",
      "success_criteria": "Phone charging outside bedroom by 10pm every night",
      "when_to_do": "9:50pm as part of wind-down routine",
      "why_this": "Removes access during your identified risk window (10pm-1am)."
    }
  ],
  "tokens_used": 75,
  "tokens_remaining": 825
}
```

**Personalization:**
- Tied to specific goal context
- Considers user's severity level
- Actions are 2-5 minutes only
- Includes "when_to_do" timing suggestions

---

### 3. Generate Insights

**Endpoint:** `POST /api/coach/insights`

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "challenge_id": "porn_addiction",
  "timeframe_days": 7,
  "insights": {
    "risk_window": "10:30pm–12:30am",
    "best_tool": "Environment changes (removed access points)",
    "best_lever": "environment"
  },
  "next_week_plan": {
    "keep": [
      "Continue phone-out-of-bedroom rule",
      "Evening walks before risk window"
    ],
    "change": [
      "Start wind-down routine 30min earlier",
      "Add accountability check-in"
    ],
    "try": [
      "One new grounding technique when urges hit",
      "Morning routine to set daily intention"
    ]
  },
  "tokens_used": 100,
  "tokens_remaining": 725
}
```

**Personalization:**
- Analyzes last 7 days of action completion
- Identifies patterns (if enough data)
- Gracefully handles sparse data ("not enough data yet")
- Does NOT hallucinate specific numbers

---

## UI Integration

### Where to Call Coach AI Endpoints

| UI Component | Endpoint | Trigger |
|-------------|----------|---------|
| **Onboarding** (after severity selection) | `/api/coach/goals` | Auto-suggest initial goals |
| **Dashboard "Add Goal" button** | `/api/coach/goals` | User clicks "Suggest goals" |
| **Goal detail "Generate actions" button** | `/api/coach/actions` | User wants AI-suggested actions |
| **Dashboard insights section** | `/api/coach/insights` | Weekly refresh or user clicks "Get insights" |
| **Chat interface** | `/api/chat` *(unchanged)* | Normal chat conversation |

### Example: Dashboard Integration

```typescript
// In playbook.js or dashboard component

const generateGoals = async () => {
  setLoading(true);
  try {
    const response = await fetch('/api/coach/goals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      setCoachGoals(data.goals);
      setTokensRemaining(data.tokens_remaining);
    } else {
      // Handle insufficient tokens or other errors
      alert(data.error);
    }
  } catch (error) {
    console.error('Goal generation failed:', error);
  } finally {
    setLoading(false);
  }
};
```

---

## Data Sources (Personalization)

Coach AI builds context from:

1. **user_challenge_latest_assessment**
   - Current severity level (occasional/growing/compulsive/overwhelming)
   - Timeframe (30 or 90 days)

2. **user_challenge_assessments**
   - Historical severity tracking
   - signals_json (frequency, binge patterns, craving intensity, etc.)

3. **action_plans**
   - Completion rate (last 7/30 days)
   - Recent activity patterns

4. **user_wellness_goals**
   - Existing goals (to avoid duplicates)

**If data is missing:**
- Context builder returns safe defaults
- Prompts include "if no data, acknowledge it"
- Fallback generators provide generic but valid outputs

---

## Error Handling

### Validation Flow
1. OpenAI generates JSON
2. Zod validates structure
3. **If invalid:** Retry once with "fix JSON" prompt
4. **If still invalid:** Return fallback (non-personalized but valid)
5. **Always log** success/failure to `coach_ai_usage_logs`

### Fallbacks
- **Goals:** Generic awareness/tracking goal
- **Actions:** Basic breath work or environment action
- **Insights:** "Not enough data yet" + general suggestions

### Token Deduction
- Tokens are deducted **even if generation fails**
- User paid for the API call attempt
- Fallback prevents zero value return

---

## Testing Locally

### 1. Run Migration
```bash
# Via Supabase CLI
supabase migration up

# Or manually via psql
psql -h localhost -U postgres -d postgres -f supabase/migrations/20260207_coach_ai_usage_logs.sql
```

### 2. Test Endpoints

**Test Goals:**
```bash
curl -X POST http://localhost:3000/api/coach/goals \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

**Test Actions:**
```bash
curl -X POST http://localhost:3000/api/coach/actions \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com", "goalId":"porn_addiction_goal_1"}'
```

**Test Insights:**
```bash
curl -X POST http://localhost:3000/api/coach/insights \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

### 3. Check Usage Logs
```sql
SELECT 
  kind,
  success,
  total_tokens,
  error_message,
  created_at
FROM coach_ai_usage_logs
WHERE user_id = '<your-user-uuid>'
ORDER BY created_at DESC
LIMIT 10;
```

---

## Important Constraints

### Do NOT Break Chat
- Chat system (`/api/chat`, `/api/chat-continue`) remains unchanged
- Chat token optimization is deferred
- Chat uses `chat_messages` table; Coach AI uses `coach_ai_usage_logs`

### Token Accounting
- **Chat tokens:** Tracked separately (existing system)
- **Coach AI tokens:** New `coach_ai_usage_logs` table
- **User balance:** Single `users.tokens` field (deducted by both)

### Separation Checklist
- ✅ Separate API routes (`/api/coach/*` vs `/api/chat`)
- ✅ Separate service layer (`lib/coach-ai/*`)
- ✅ Separate database tables (`coach_ai_usage_logs`)
- ✅ Separate prompts (severity-aware vs chat persona)
- ✅ Separate validation (zod schemas vs raw text)

---

## Next Steps

1. **Update UI components** to call new endpoints (see "UI Integration" above)
2. **Test with real users** who have completed onboarding + severity assessment
3. **Monitor usage logs** for failures and token costs
4. **Iterate prompts** based on user feedback
5. **Later:** Optimize chat system separately (different project)

---

## Questions?

- Goals not personalized enough? → Check if `user_challenge_latest_assessment` exists
- Actions too generic? → Verify `signals_json` in assessment contains data
- Insights say "not enough data"? → User needs 7+ days of action completion
- Tokens not deducting? → Check `coach_ai_usage_logs` for error messages
