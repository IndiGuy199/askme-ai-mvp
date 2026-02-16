# Playbook Create Action & Weekly Insights Implementation

## Overview
Comprehensive improvements to the create action flow and weekly insights generation on the playbook page.

## 1. Create Action Flow Improvements

### ✅ Auto-Select 2 AI Actions
**Location**: `web/pages/playbook.js` lines 1682-1729

**Changes**:
- Modified `generateActionWithAI()` function
- Changed from `setSelectedActionOptions([0])` to `setSelectedActionOptions([0, 1])`
- Now auto-selects first 2 actions instead of just 1
- Shows success notification: "✨ Generated 3 action suggestions!"

**Code**:
```javascript
if (response.ok && data.actions && data.actions.length > 0) {
  setGeneratedActionOptions(data.actions)
  setSelectedActionOptions([0, 1])  // Auto-select first TWO
  showNotification(`✨ Generated ${data.actions.length} action suggestions!`, 'success')
}
```

### ✅ Goal Name Display
**Location**: `web/pages/playbook.js` lines 3025-3170 (create action modal)

**Changes**:
- Added green badge showing goal name at top of modal
- Uses `selectedGoalForSwap.coach_wellness_goals?.label`
- Clear visual hierarchy with goal context

**UI Structure**:
```
┌─────────────────────────────────────┐
│  🎯 Track                           │  ← Goal name badge (green)
│                                     │
│  Choose your approach               │  ← Yellow info box
│  • AI suggestions (75 tokens)      │
│  • Manual entry                     │
│                                     │
│  ✓ Action 1 [checked]              │  ← Auto-selected
│  ✓ Action 2 [checked]              │  ← Auto-selected  
│  ☐ Action 3 [unchecked]            │
│                                     │
│  [Create (2) Actions]  [Cancel]    │  ← Dynamic count
└─────────────────────────────────────┘
```

### ✅ Improved Verbiage
**Changes**:
- "Choose your approach" section explaining AI vs manual
- Clear token costs displayed (75 tokens for AI suggestions)
- Action cards show full details: duration, difficulty, category, success criteria
- Dynamic button text: "Create (X) Actions" based on selection count
- Better color coding: green for AI suggestions, gray for info

### ✅ Duplicate Action Prevention
**Location**: `web/pages/playbook.js` lines 1043-1090

**Changes**:
- Added duplicate check in `createNewAction()` function
- Compares new action titles against existing actions (case-insensitive, trimmed)
- Shows warning notification if duplicate found: "⚠️ Action already exists"
- Prevents creating same action twice in a goal

**Code**:
```javascript
// Check for duplicates
const existingActions = await supabase
  .from('action_plans')
  .select('title')
  .eq('goal_id', selectedGoalForSwap.id)

const actionTexts = selectedActionOptions.map(idx => 
  generatedActionOptions[idx].title
)

for (const actionText of actionTexts) {
  const isDuplicate = existingActions.data?.some(
    action => action.title.toLowerCase().trim() === actionText.toLowerCase().trim()
  )
  if (isDuplicate) {
    showNotification(`⚠️ Action "${actionText}" already exists in this goal`, 'warning')
    continue // Skip this action
  }
  // Create action...
}
```

## 2. Weekly Insights Implementation

### ✅ Insights Generation API
**Endpoint**: `/api/coach/insights`
**Token Cost**: 100 tokens
**Model**: GPT-4o-mini

**Returns**:
```typescript
{
  challenge_id: string,
  timeframe_days: number,
  insights: {
    risk_window: string,     // e.g., "10:30pm-12:30am"
    best_tool: string,       // e.g., "5-min reset when intensity > 7"
    best_lever: string       // e.g., "phone charges outside bedroom"
  },
  next_week_plan: {
    keep: string[],    // 2 items
    change: string[],  // 2 items
    try: string[]      // 2 items
  },
  tokens_used: number,
  tokens_remaining: number
}
```

### ✅ State Management
**Location**: `web/pages/playbook.js` lines 83-86

**Added**:
```javascript
const [weeklyInsights, setWeeklyInsights] = useState(null)
const [generatingInsights, setGeneratingInsights] = useState(false)
```

### ✅ Generate Insights Function
**Location**: `web/pages/playbook.js` lines 1754-1798

**Features**:
- Calls `/api/coach/insights` endpoint
- Stores insights in state
- Shows success/error notifications
- Updates user token count
- Handles insufficient tokens error

**Code**:
```javascript
const generateWeeklyInsights = async () => {
  if (!user) return
  setGeneratingInsights(true)
  
  try {
    const response = await fetch('/api/coach/insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email })
    })
    
    const data = await response.json()
    
    if (response.ok) {
      setWeeklyInsights({
        risk_window: data.insights.risk_window,
        best_tool: data.insights.best_tool,
        best_lever: data.insights.best_lever,
        keep: data.next_week_plan.keep,
        change: data.next_week_plan.change,
        try: data.next_week_plan.try
      })
      
      showNotification('✨ Weekly insights generated!', 'success')
      setUser(prev => ({ ...prev, tokens: data.tokens_remaining }))
    }
  } catch (error) {
    showNotification('Failed to generate insights. Please try again.', 'error')
  } finally {
    setGeneratingInsights(false)
  }
}
```

### ✅ Apply Next Week Plan
**Location**: `web/pages/playbook.js` lines 1800-1876

**Features**:
- Takes all 6 recommendations (2 keep + 2 change + 2 try)
- Creates actions from recommendations
- Applies to first active goal
- Checks for duplicates before creating
- Shows success count notification
- Refreshes goals and actions data

**Code**:
```javascript
const applyNextWeekPlan = async () => {
  if (!weeklyInsights) {
    showNotification('Generate insights first before applying plan.', 'warning')
    return
  }
  
  try {
    setSavingData(true)
    
    // Combine all recommendations (2+2+2 = 6 actions)
    const allRecommendations = [
      ...weeklyInsights.keep.map(text => ({ text, type: 'keep' })),
      ...weeklyInsights.change.map(text => ({ text, type: 'change' })),
      ...weeklyInsights.try.map(text => ({ text, type: 'try' }))
    ]
    
    const targetGoal = coachGoals[0]
    let successCount = 0
    
    for (const rec of allRecommendations) {
      // Check duplicates...
      if (!isDuplicate) {
        await supabase.from('action_plans').insert({
          goal_id: targetGoal.id,
          title: rec.text,
          when_to_use: 'anytime',
          is_coach_generated: true,
          coach_metadata: { source: 'weekly_insights', type: rec.type }
        })
        successCount++
      }
    }
    
    showNotification(`✅ Added ${successCount} actions to "${targetGoal.label}"!`, 'success')
    await fetchUserGoalsAndActions()
  } finally {
    setSavingData(false)
  }
}
```

### ✅ Weekly Patterns Card UI
**Location**: `web/pages/playbook.js` lines 2092-2165

**Before insights generated**:
- Shows explanation: "Get AI-powered insights from your past week's actions..."
- Primary button: "Generate insights (100 tokens)"

**After insights generated**:
- Shows 3 insights (risk_window, best_tool, best_lever)
- "Apply next-week plan (600)" button
- "Refresh insights (100)" secondary button

**UI**:
```
┌─────────────────────────────────────┐
│  Weekly patterns                    │
│  3 quick insights (opt-in)          │
│                                     │
│  • Risk window: 10:30pm-12:30am    │
│  • Best tool: 5-min reset (>7)     │
│  • Best lever: phone outside room  │
│                                     │
│  [Apply next-week plan (600)]      │
│  [Refresh insights (100)]          │
└─────────────────────────────────────┘
```

## 3. Token Costs Summary

| Feature | Cost | What It Does |
|---------|------|--------------|
| Generate AI Actions | 75 | Returns 3 personalized action suggestions |
| Generate Weekly Insights | 100 | Analyzes past week, returns 3 insights + 6 recommendations |
| Apply Next Week Plan | 600 | Creates 6 actions from keep/change/try recommendations |

## 4. Database Schema

### action_plans table
```sql
- id: uuid
- goal_id: uuid (FK to coach_wellness_goals)
- title: text
- when_to_use: text
- is_coach_generated: boolean
- coach_metadata: jsonb  -- NEW: stores {source, type}
```

**coach_metadata examples**:
- `{source: 'ai_generation'}` - from Coach AI action generator
- `{source: 'weekly_insights', type: 'keep'}` - from apply next week plan
- `{source: 'weekly_insights', type: 'change'}` - from apply next week plan
- `{source: 'weekly_insights', type: 'try'}` - from apply next week plan

## 5. Testing

### Automated Test
Run: `node test-playbook-improvements.js`

**Tests**:
1. ✅ AI action generation returns 3 actions
2. ✅ Duplicate detection works correctly
3. ✅ Weekly insights generation succeeds
4. ✅ Next week plan has correct structure (2+2+2)

### Manual Testing Checklist
1. Visit `/playbook` page
2. Click "+ Add action" button
3. Verify goal name shows in green badge
4. Verify "Choose your approach" section displays
5. Click "Generate AI suggestions (75 tokens)"
6. Verify 2 actions are pre-checked
7. Verify action cards show all details
8. Verify "Create (2) Actions" button text
9. Create actions, then try to create duplicate - should warn
10. Click "Generate insights (100 tokens)" in Weekly patterns
11. Verify 3 insights display correctly
12. Click "Apply next-week plan (600)"
13. Verify 6 actions added to first goal

## 6. Key Files Modified

| File | Lines | Changes |
|------|-------|---------|
| `web/pages/playbook.js` | 83-86 | Added weeklyInsights state |
| `web/pages/playbook.js` | 1043-1090 | Added duplicate prevention |
| `web/pages/playbook.js` | 1682-1729 | Auto-select 2 actions |
| `web/pages/playbook.js` | 1754-1876 | Added insights generation & apply functions |
| `web/pages/playbook.js` | 2092-2165 | Updated Weekly patterns card UI |
| `web/pages/playbook.js` | 3025-3170 | Redesigned create action modal |

## 7. Future Enhancements

### Potential Improvements:
1. **Progressive disclosure**: Show 2 actions initially, "Generate 2 more" button
2. **Action history**: Track which actions were applied from which insights
3. **Insights history**: Show past weeks' insights, compare trends
4. **Custom recommendations**: Let users specify areas for AI to focus on
5. **Batch apply**: Select specific recommendations to apply (not all 6)
6. **Goal targeting**: Choose which goal to apply recommendations to

### Analytics to Track:
- Insights generation frequency
- Apply plan adoption rate
- Action completion rate (AI vs manual vs insights)
- Duplicate prevention effectiveness
- Token spend by feature

## 8. Error Handling

### Insufficient Tokens
```javascript
if (data.error === 'Insufficient tokens') {
  showNotification(`Need ${data.required} tokens. You have ${data.available}.`, 'warning')
}
```

### Network Errors
- Shows generic "Failed to generate..." error
- Logs full error to console for debugging

### Invalid Data
- Falls back to placeholder insights if AI fails
- Skips duplicate actions without failing entire batch

## 9. Success Metrics

### Implementation Success:
✅ Auto-selects 2 AI actions by default  
✅ Goal name prominently displayed  
✅ Clear AI vs manual explanation  
✅ Duplicate prevention working  
✅ Weekly insights integration complete  
✅ Apply plan creates 6 actions correctly  
✅ Token costs clearly displayed  
✅ Comprehensive error handling  

### User Experience:
- Reduced clicks: Auto-select saves 1 click per action
- Clear context: Goal name always visible
- No confusion: AI vs manual clearly explained
- No duplicates: System prevents user errors
- Actionable insights: 6 concrete recommendations weekly
- Transparent costs: All token costs shown upfront
