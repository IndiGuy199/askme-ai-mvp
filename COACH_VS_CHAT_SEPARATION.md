# Coach AI vs Chat AI - System Separation

## Architecture Comparison

| Aspect | Chat AI (Existing) | Coach AI (New) |
|--------|-------------------|----------------|
| **Purpose** | Conversational therapy/coaching | Structured goal/action/insight generation |
| **API Routes** | `/api/chat`, `/api/chat-continue` | `/api/coach/goals`, `/api/coach/actions`, `/api/coach/insights` |
| **Service Layer** | Inline in API routes | `/lib/coach-ai/*` (prompts, context, schema, client) |
| **Output Format** | Streaming text | Strict JSON (validated by Zod) |
| **Prompts** | Coach persona prompts | Severity-aware structured prompts |
| **Validation** | None (raw text) | Zod schemas + retry logic |
| **Personalization** | Chat history + profile | Assessment data + completion metrics |
| **Database Tables** | `chat_messages` (stores full conversation) | `coach_ai_usage_logs` (usage tracking only) |
| **Token Tracking** | Via `chat_messages.token_count` | Via `coach_ai_usage_logs.total_tokens` |
| **Fallback Strategy** | Return error or generic response | Validated fallback JSON generators |
| **Cost** | TBD (currently unoptimized) | Goals: 100, Actions: 75, Insights: 100 |
| **Token Deduction** | Per message | Per generation (even if failed) |
| **Status** | Existing, will be optimized later | **NEW, production-ready** |

---

## When to Use Each System

### Use Chat AI (`/api/chat`)
- User wants to have a conversation with the coach
- Open-ended questions: "Why do I feel this way?"
- Emotional support and encouragement
- Explaining concepts or strategies
- Processing feelings or experiences

**Example interactions:**
- "I'm struggling tonight, help me"
- "Why do I keep relapsing?"
- "Explain urge surfing to me"

---

### Use Coach AI (`/api/coach/*`)

#### Goals Endpoint
- User completes onboarding (initial goal suggestions)
- User clicks "Add Goal" and wants AI suggestions
- System needs structured goal objects for database insert
- Want severity-specific goal recommendations

**Example triggers:**
- After onboarding severity selection
- "Suggest goals" button click
- Dashboard refresh showing recommended goals

#### Actions Endpoint
- User selects a goal and wants action suggestions
- "Generate actions" button clicked
- Need structured micro-actions with timing/category
- Want actions tied to specific goal context

**Example triggers:**
- Goal detail view "Generate actions" button
- Empty action list with "Get started" prompt
- Weekly action refresh

#### Insights Endpoint
- Weekly dashboard refresh
- User clicks "See my progress"
- Need structured weekly insights + next-week plan
- Want data-driven pattern analysis

**Example triggers:**
- Dashboard insights card on load
- "Refresh insights" button
- Weekly scheduled generation

---

## Data Flow Comparison

### Chat AI Flow
```
User sends message
    ↓
/api/chat receives message
    ↓
Fetch chat history from chat_messages
    ↓
Build prompt with history + persona
    ↓
Call OpenAI (streaming)
    ↓
Store message in chat_messages
    ↓
Stream response to user
```

### Coach AI Flow (Goals Example)
```
User requests goals
    ↓
/api/coach/goals receives email
    ↓
lib/coach-ai/context fetches:
  - Latest severity assessment
  - Action completion rate
  - Existing goals
    ↓
lib/coach-ai/prompts builds severity-aware prompt
    ↓
lib/coach-ai/client calls OpenAI (JSON mode)
    ↓
Zod validates response structure
    ↓
If invalid: retry once or use fallback
    ↓
Log to coach_ai_usage_logs
    ↓
Deduct tokens from users.tokens
    ↓
Return structured JSON to UI
```

---

## Token Accounting Separation

### Chat Token Tracking
```sql
-- Chat messages table stores each message with token count
SELECT 
  role, 
  token_count, 
  created_at 
FROM chat_messages 
WHERE user_id = '<uuid>'
ORDER BY created_at DESC;

-- Total chat tokens used
SELECT SUM(token_count) as total_chat_tokens
FROM chat_messages
WHERE user_id = '<uuid>';
```

### Coach AI Token Tracking
```sql
-- Coach AI logs table stores each generation attempt
SELECT 
  kind,              -- 'goals', 'actions', or 'insights'
  total_tokens,
  success,
  error_message,
  created_at
FROM coach_ai_usage_logs
WHERE user_id = '<uuid>'
ORDER BY created_at DESC;

-- Total coach AI tokens by type
SELECT 
  kind,
  SUM(total_tokens) as tokens_used,
  COUNT(*) as generations
FROM coach_ai_usage_logs
WHERE user_id = '<uuid>'
GROUP BY kind;
```

### Combined View (Optional Enhancement)
```sql
-- See all token usage in one view
SELECT 
  'chat' as source,
  SUM(token_count) as tokens,
  COUNT(*) as count
FROM chat_messages
WHERE user_id = '<uuid>'

UNION ALL

SELECT 
  'coach_' || kind as source,
  SUM(total_tokens) as tokens,
  COUNT(*) as count
FROM coach_ai_usage_logs
WHERE user_id = '<uuid>'
GROUP BY kind;
```

---

## UI Integration Guide

### Current UI (Chat)
```javascript
// pages/chat.js - UNCHANGED
const sendMessage = async (message) => {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      email: user.email,
      message: message 
    })
  });
  // Handle streaming response...
};
```

### New UI (Coach AI)
```javascript
// pages/playbook.js - NEW
const generateGoals = async () => {
  const response = await fetch('/api/coach/goals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: user.email })
  });
  
  const data = await response.json();
  
  if (response.ok) {
    setCoachGoals(data.goals); // Array of structured goal objects
    setTokensRemaining(data.tokens_remaining);
  }
};

const generateActions = async (goalId) => {
  const response = await fetch('/api/coach/actions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      email: user.email,
      goalId: goalId 
    })
  });
  
  const data = await response.json();
  
  if (response.ok) {
    setActions(data.actions); // Array of structured action objects
  }
};

const loadInsights = async () => {
  const response = await fetch('/api/coach/insights', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: user.email })
  });
  
  const data = await response.json();
  
  if (response.ok) {
    setInsights(data.insights);
    setNextWeekPlan(data.next_week_plan);
  }
};
```

---

## Migration Path

### Phase 1: Deploy Coach AI (Now)
1. ✅ Run `20260207_coach_ai_usage_logs.sql` migration
2. ✅ Deploy new API routes (`/api/coach/*`)
3. ✅ Update UI to call Coach AI endpoints
4. ✅ Test with real users
5. ✅ Monitor `coach_ai_usage_logs` for issues

### Phase 2: Optimize Chat (Later)
1. Analyze `chat_messages` token usage
2. Implement message chunking/summarization
3. Add chat-specific token optimization
4. Update chat prompts for efficiency
5. **(Chat AI and Coach AI remain separate)**

### Phase 3: Combined Analytics (Future)
1. Build unified token usage dashboard
2. Show chat vs coach AI costs
3. Optimize pricing based on actual usage
4. Add user-facing token transparency

---

## Testing Strategy

### Chat AI Testing (Existing)
```bash
# Test chat conversation
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "message": "I'm struggling tonight"
  }'
```

### Coach AI Testing (New)
```bash
# Test all three endpoints
node test-coach-ai.js test@example.com
```

Or manually:
```bash
# Goals
curl -X POST http://localhost:3000/api/coach/goals \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# Actions
curl -X POST http://localhost:3000/api/coach/actions \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","goalId":"porn_addiction_goal_1"}'

# Insights
curl -X POST http://localhost:3000/api/coach/insights \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

---

## Success Metrics

### Chat AI Metrics (Existing)
- Average tokens per message
- Messages per session
- User satisfaction (if tracked)

### Coach AI Metrics (New)
- Success rate per endpoint (from `coach_ai_usage_logs.success`)
- Average tokens per generation type
- User adoption (generations per user)
- Fallback usage rate (indicates model issues)

---

## Summary

| System | Purpose | Status | Next Steps |
|--------|---------|--------|------------|
| **Chat AI** | Conversational support | Existing, needs optimization later | Continue using, will optimize separately |
| **Coach AI** | Structured outputs | **NEW, ready for production** | Deploy, test, monitor usage logs |

**Key Principle:** These systems are completely separate. Chat optimization will happen independently without affecting Coach AI.
