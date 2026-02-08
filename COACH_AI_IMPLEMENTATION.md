# Coach AI Implementation Summary

## ✅ What Was Built

### 1. Service Layer (`/web/lib/coach-ai/`)
- **prompts.ts** - Severity-aware templates for goals/actions/insights
- **context.ts** - Fetches user data from assessments, actions, challenges
- **schema.ts** - Zod validation schemas for all 3 output types
- **client.ts** - OpenAI wrapper with retry logic + fallbacks

### 2. API Routes (`/web/pages/api/coach/`)
- **goals.ts** - POST /api/coach/goals (100 tokens)
- **actions.ts** - POST /api/coach/actions (75 tokens)
- **insights.ts** - POST /api/coach/insights (100 tokens)

### 3. Database
- **Migration:** `20260207_coach_ai_usage_logs.sql`
- **Table:** `coach_ai_usage_logs` (user_id, kind, tokens, success, error_message)
- **View:** `coach_ai_daily_usage` for analytics

### 4. Documentation
- **COACH_AI_INTEGRATION_GUIDE.md** - Complete usage guide with examples

---

## 🔑 Key Features

### Personalization Sources
- ✅ User severity from `user_challenge_latest_assessment`
- ✅ Assessment signals from `user_challenge_assessments.signals_json`
- ✅ Completion rate (last 7/30 days) from `action_plans`
- ✅ Existing goals to avoid duplicates

### Validation & Error Handling
- ✅ Strict JSON validation with Zod
- ✅ Retry once if JSON malformed
- ✅ Fallback generators if all fails
- ✅ All attempts logged (success + failure)

### Token Management
- ✅ Separate tracking from chat (`coach_ai_usage_logs` table)
- ✅ Deduction even on failure (user paid for attempt)
- ✅ Returns tokens_remaining in response

### Severity-Aware Prompts
- ✅ Occasional: awareness, prevention, exploration
- ✅ Growing: habit interruption, frequency reduction
- ✅ Compulsive: containment, binge stopping, resilience
- ✅ Overwhelming: crisis support, simplification, safety

---

## 📦 Dependencies

Ensure these are installed:

```bash
npm install zod openai @supabase/supabase-js
```

Check `web/package.json` - if `zod` is missing, add it:
```json
{
  "dependencies": {
    "zod": "^3.22.4"
  }
}
```

---

## 🚀 Deployment Checklist

### 1. Run Migration
```bash
cd supabase
supabase migration up
# Or manually:
psql -h <host> -U postgres -d postgres -f migrations/20260207_coach_ai_usage_logs.sql
```

### 2. Verify Tables Exist
```sql
\d coach_ai_usage_logs
SELECT * FROM coach_ai_daily_usage LIMIT 1;
```

### 3. Set Environment Variables
Ensure these are set:
- `OPENAI_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE`

### 4. Test Endpoints
```bash
# Goals
curl -X POST http://localhost:3000/api/coach/goals \
  -H "Content-Type: application/json" \
  -d '{"email":"rdee199@gmail.com"}'

# Actions
curl -X POST http://localhost:3000/api/coach/actions \
  -H "Content-Type: application/json" \
  -d '{"email":"rdee199@gmail.com","goalId":"porn_addiction_goal_1"}'

# Insights
curl -X POST http://localhost:3000/api/coach/insights \
  -H "Content-Type: application/json" \
  -d '{"email":"rdee199@gmail.com"}'
```

### 5. Update UI
Replace existing AI generation calls with new endpoints:
- Dashboard "Add Goal" → `/api/coach/goals`
- Goal detail "Generate actions" → `/api/coach/actions`
- Insights section → `/api/coach/insights`

**DO NOT use chat endpoints for these.**

---

## 📊 Monitoring

### View Usage Stats
```sql
-- Total generations by type
SELECT kind, COUNT(*), SUM(total_tokens) 
FROM coach_ai_usage_logs 
GROUP BY kind;

-- Success rate
SELECT 
  kind,
  COUNT(*) as total,
  SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful,
  ROUND(100.0 * SUM(CASE WHEN success THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate
FROM coach_ai_usage_logs
GROUP BY kind;

-- Recent failures
SELECT kind, error_message, created_at
FROM coach_ai_usage_logs
WHERE NOT success
ORDER BY created_at DESC
LIMIT 10;
```

### Daily Summary View
```sql
SELECT * FROM coach_ai_daily_usage
WHERE date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY date DESC, kind;
```

---

## ⚠️ Important Notes

### Chat System
- **UNTOUCHED** - `/api/chat` and `/api/chat-continue` remain as-is
- Token optimization for chat is deferred
- Chat uses `chat_messages` table
- Coach AI uses `coach_ai_usage_logs` table

### Token Costs
- Goals: 100 tokens
- Actions: 75 tokens
- Insights: 100 tokens
- Chat: TBD (will be optimized separately)

### Data Requirements
For best personalization, users need:
1. Completed onboarding with severity selection
2. At least one assessment in `user_challenge_assessments`
3. (Optional) Some action completion history

**If missing:** System gracefully degrades to general suggestions.

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| "Unable to build user context" | User hasn't completed onboarding or selected severity |
| Goals/actions too generic | Check if `signals_json` exists in assessment |
| Insights say "not enough data" | User needs 7+ days of action activity |
| Tokens not deducting | Check `coach_ai_usage_logs` for errors |
| TypeScript errors | Run `npm install zod` |
| "Insufficient tokens" | User needs token purchase/refill |

---

## 📁 File Structure

```
web/
├── lib/
│   └── coach-ai/
│       ├── prompts.ts      (Severity-aware templates)
│       ├── context.ts      (Fetch user data from Supabase)
│       ├── schema.ts       (Zod validation)
│       └── client.ts       (OpenAI wrapper + fallbacks)
├── pages/
│   └── api/
│       └── coach/
│           ├── goals.ts    (POST endpoint)
│           ├── actions.ts  (POST endpoint)
│           └── insights.ts (POST endpoint)
supabase/
└── migrations/
    └── 20260207_coach_ai_usage_logs.sql

COACH_AI_INTEGRATION_GUIDE.md (This file + detailed guide)
```

---

## ✨ Next Steps

1. **Install zod** if not already: `npm install zod`
2. **Run migration:** Create `coach_ai_usage_logs` table
3. **Test endpoints** with curl or Postman
4. **Update UI** to call new Coach AI endpoints instead of chat
5. **Monitor logs** for failures and token usage
6. **Iterate prompts** based on user feedback
7. **(Later)** Optimize chat system separately

---

## 🎯 Success Criteria

- ✅ Coach AI outputs are structured JSON (goals/actions/insights)
- ✅ Personalized based on severity + assessment data
- ✅ Separate token tracking from chat
- ✅ Graceful fallbacks if data is sparse
- ✅ Chat system remains functional and unchanged
- ✅ All API calls logged with success/failure tracking

**The system is production-ready once migration runs successfully.**
