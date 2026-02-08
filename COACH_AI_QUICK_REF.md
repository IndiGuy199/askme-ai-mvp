# Coach AI - Quick Reference

## 🎯 Three Endpoints

```
POST /api/coach/goals      → Generate recovery goals (100 tokens)
POST /api/coach/actions    → Generate micro-actions (75 tokens)
POST /api/coach/insights   → Weekly insights + plan (100 tokens)
```

---

## 📤 Request Format

### Goals
```json
POST /api/coach/goals
{ "email": "user@example.com" }
```

### Actions
```json
POST /api/coach/actions
{ 
  "email": "user@example.com",
  "goalId": "porn_addiction_goal_1" 
}
```

### Insights
```json
POST /api/coach/insights
{ "email": "user@example.com" }
```

---

## 📥 Response Format

### Goals Response
```json
{
  "challenge_id": "porn_addiction",
  "severity": "growing",
  "goals": [
    {
      "label": "Goal name",
      "description": "Success criteria",
      "goal_type": "track",
      "suggested_duration_days": 30,
      "why_this_now": "Personalized reasoning"
    }
  ],
  "tokens_used": 100,
  "tokens_remaining": 900
}
```

### Actions Response
```json
{
  "goal_id": "porn_addiction_goal_1",
  "actions": [
    {
      "title": "Specific action",
      "duration_minutes": 2,
      "difficulty": "easy",
      "category": "environment",
      "success_criteria": "What done means",
      "when_to_do": "Timing suggestion",
      "why_this": "Why now"
    }
  ],
  "tokens_used": 75,
  "tokens_remaining": 825
}
```

### Insights Response
```json
{
  "challenge_id": "porn_addiction",
  "timeframe_days": 7,
  "insights": {
    "risk_window": "10:30pm–12:30am",
    "best_tool": "Environment changes",
    "best_lever": "environment"
  },
  "next_week_plan": {
    "keep": ["Item 1", "Item 2"],
    "change": ["Item 1", "Item 2"],
    "try": ["Item 1", "Item 2"]
  },
  "tokens_used": 100,
  "tokens_remaining": 725
}
```

---

## 🔐 Authentication

All endpoints use **email** for user lookup (not JWT).
User is resolved via Supabase service role.

---

## ⚠️ Error Responses

### Insufficient Tokens
```json
{
  "error": "Insufficient tokens",
  "required": 100,
  "available": 50
}
```

### User Not Found
```json
{
  "error": "User not found"
}
```

### Missing Context
```json
{
  "error": "Unable to build user context. Complete onboarding first."
}
```

---

## 📊 Personalization Data

Coach AI pulls from:
- `user_challenge_latest_assessment` → severity level
- `user_challenge_assessments` → signals_json
- `action_plans` → completion rate
- `user_wellness_goals` → existing goals

---

## 🛠️ Testing

```bash
# Quick test all endpoints
node test-coach-ai.js test@example.com

# Or manually
curl -X POST http://localhost:3000/api/coach/goals \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

---

## 📈 Monitor Usage

```sql
-- Recent generations
SELECT kind, success, total_tokens, created_at
FROM coach_ai_usage_logs
ORDER BY created_at DESC
LIMIT 10;

-- Success rate by type
SELECT 
  kind,
  COUNT(*) as total,
  SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful
FROM coach_ai_usage_logs
GROUP BY kind;
```

---

## 🚀 Deployment Steps

1. **Install dependencies**
   ```bash
   npm install zod
   ```

2. **Run migration**
   ```bash
   supabase migration up
   # Or manually run 20260207_coach_ai_usage_logs.sql
   ```

3. **Verify table exists**
   ```sql
   \d coach_ai_usage_logs
   ```

4. **Test endpoints**
   ```bash
   node test-coach-ai.js
   ```

5. **Update UI** to call new endpoints

---

## 💡 UI Integration Examples

### Dashboard - Generate Goals
```javascript
const response = await fetch('/api/coach/goals', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: user.email })
});
const data = await response.json();
setCoachGoals(data.goals);
```

### Goal Detail - Generate Actions
```javascript
const response = await fetch('/api/coach/actions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    email: user.email,
    goalId: selectedGoal.goal_id 
  })
});
const data = await response.json();
setActions(data.actions);
```

### Dashboard - Load Insights
```javascript
const response = await fetch('/api/coach/insights', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: user.email })
});
const data = await response.json();
setInsights(data.insights);
setNextWeekPlan(data.next_week_plan);
```

---

## ✅ Quick Checklist

- [ ] Migration run successfully
- [ ] `coach_ai_usage_logs` table exists
- [ ] Zod installed (`npm install zod`)
- [ ] Environment variables set (OPENAI_API_KEY, SUPABASE_*)
- [ ] Test script passes (`node test-coach-ai.js`)
- [ ] UI updated to call new endpoints
- [ ] Token balance monitored
- [ ] Usage logs reviewed

---

## 📚 Full Documentation

- **COACH_AI_INTEGRATION_GUIDE.md** - Complete guide with examples
- **COACH_AI_IMPLEMENTATION.md** - Implementation summary
- **COACH_VS_CHAT_SEPARATION.md** - Architecture comparison

---

## 🆘 Troubleshooting

| Issue | Fix |
|-------|-----|
| TypeScript errors | `npm install zod` |
| "User not found" | Check email is correct |
| "Unable to build context" | User needs to complete onboarding |
| Tokens not deducting | Check logs for errors |
| Generic outputs | User needs assessment data |
| "not enough data" | User needs 7+ days activity |

---

**Questions?** Check COACH_AI_INTEGRATION_GUIDE.md or review coach_ai_usage_logs for errors.
