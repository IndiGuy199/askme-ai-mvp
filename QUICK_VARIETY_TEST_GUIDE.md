# Quick Test Guide - Porn Recovery AI Variety

## 🚀 Quick Start Test (5 minutes)

### Test 1: Goal Variety
1. Open playbook at http://localhost:3000/playbook
2. Click "Generate Goals" button
3. Note the 3 goal labels
4. Click "Generate Goals" again
5. **EXPECTED:** Completely different goals (not repeated)
6. Repeat 3 more times - should see variety

**Console Log Check:**
```javascript
🎯 Generating goals for: {
  allowedArchetypes: ['POST_SLIP_CONTAINMENT', 'BEDTIME_RISK_WINDOW', 'STRESS_ESCAPE']
}
```

### Test 2: Action Specificity
1. Create a goal: "Set nightly phone shutdown by 10pm"
2. Click "Generate Actions"
3. **EXPECTED:** Specific actions like:
   - ✅ "Charge phone in bathroom with alarm clock in bedroom by 9:45pm"
   - ✅ "Set 10pm recurring iPhone alarm labeled 'Phone Shutdown Protocol'"
   - ❌ NOT: "Turn off your phone before bed"
   - ❌ NOT: "Practice mindfulness"

## 🔬 Detailed Testing (15 minutes)

### Test 3: Archetype Classification

Create these goals and verify actions match archetype:

| Goal Label | Expected Archetype | Required Action Categories |
|------------|-------------------|---------------------------|
| "Install 20-minute wait timer after any slip" | POST_SLIP_CONTAINMENT | ANTI_BINGE_LOCK, SHAME_REPAIR, DEVICE_FRICTION |
| "Charge phone outside bedroom by 10pm" | BEDTIME_RISK_WINDOW | DEVICE_FRICTION, TIME_PROTOCOL, ENVIRONMENT_SHIFT |
| "Remove Instagram from phone completely" | ACCESS_PATHWAY_BLOCK | DEVICE_FRICTION, ACCOUNTABILITY_PING, TIME_PROTOCOL |

**How to check:**
1. Generate actions for each goal
2. Open browser dev tools → Network tab
3. Find POST request to `/api/coach/actions`
4. Check response JSON for `goal_archetype` and `category` fields

### Test 4: Anti-Generic Check

**Generate 10 actions across different goals**

Count how many contain these BANNED phrases:
- ❌ "take a deep breath" / "breathe deeply"
- ❌ "practice mindfulness" (unless specific technique named)
- ❌ "drink water"
- ❌ "go for a walk" (unless specific: "Walk to Starbucks 3 blocks away")
- ❌ "call a friend" (unless specific: "Text John at 555-1234")

**Target:** 0 generic actions out of 10

### Test 5: Database Archetype Storage

Run this SQL query in Supabase:

```sql
SELECT 
  goal_id,
  label,
  archetype,
  baseline_capture_question,
  baseline_capture_type,
  created_at
FROM coach_wellness_goals
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 10;
```

**Verify:**
- ✅ `archetype` is populated (not NULL)
- ✅ `archetype` is valid enum value
- ✅ `baseline_capture_question` has a question (optional)

## 🐛 Troubleshooting

### Issue: Goals are still repetitive

**Check Console:**
```javascript
// Should see this log
🎯 Generating goals for: {
  allowedArchetypes: ['...', '...', '...']  // Should be different each time
}
```

**If allowedArchetypes is missing:**
- Check `web/pages/api/coach/goals.ts` line ~100
- Verify `selectArchetypesForGeneration()` is called

**If allowedArchetypes is same every time:**
- Check `web/lib/coach-ai/archetypes.ts` line ~95
- Verify `shuffleArray()` is working

### Issue: Actions are still generic

**Check System Prompt:**
1. Open browser dev tools → Network tab
2. Click "Generate Actions"
3. Find POST to `/api/coach/actions`
4. Check request payload → should have system prompt starting with:
   ```
   "You are a pornography addiction recovery intervention designer..."
   ```

**If system prompt is wrong:**
- Check `web/pages/api/coach/actions.ts` line ~88
- Should use `PORN_RECOVERY_SYSTEM_PROMPT` (not old string)

### Issue: TypeScript errors on build

```bash
cd c:\opt\mvp\web
npx next build
```

**Common errors:**
- `Cannot find name 'GoalArchetype'` → Import from `'./archetypes'`
- `Property 'goalArchetype' does not exist` → Check ActionContext interface
- `Type mismatch in selectArchetypesForGeneration` → Check UserMetrics mapping

### Issue: Database error "column archetype does not exist"

**Apply migration:**
```bash
cd c:\opt\mvp
supabase migration up
```

Or apply manually in Supabase dashboard:
1. Go to Database → Migrations
2. Paste contents of `supabase/migrations/20260214_add_archetype_to_goals.sql`
3. Run migration

## ✅ Success Criteria

**Goal Variety:** 5 generations = 15 unique goals (no duplicates)

**Action Specificity:** 0 generic actions in 10 generations

**Archetype Gating:** POST_SLIP_CONTAINMENT goals ALWAYS have ANTI_BINGE_LOCK action

**Database:** `archetype` field populated for all new goals

**Console Logs:** `allowedArchetypes` and `allowedCategories` appear in logs

## 📊 Example Good Output

### Goal Generation Output (3 goals)
```
1. "Install 20-minute forced wait timer after any slip"
   Archetype: POST_SLIP_CONTAINMENT
   
2. "Charge phone in bathroom starting 10pm nightly"
   Archetype: BEDTIME_RISK_WINDOW
   
3. "Block Reddit in Screen Time from 8pm-10pm"
   Archetype: ACCESS_PATHWAY_BLOCK
```

### Action Generation Output (3 actions for "Install 20-minute forced wait timer")
```
1. "Delete Safari immediately after logging slip, reinstall after 20-min timer expires"
   Category: DEVICE_FRICTION
   
2. "Force exit all social media apps and wait 20 minutes before reopening any app"
   Category: ANTI_BINGE_LOCK
   
3. "Text recovery partner 'Slipped once, resetting 20-min timer now' within 5 minutes"
   Category: SHAME_REPAIR
```

## 🎯 Next Steps After Testing

1. **If tests pass:** Deploy to production, monitor first 50 generations
2. **If generic actions appear:** Check system prompt is being used
3. **If archetypes don't rotate:** Check shuffleArray() in archetypes.ts
4. **If categories not enforced:** Check mandatory mappings in selectCategoriesForGeneration()

## 📞 Quick Commands

```bash
# Build
cd c:\opt\mvp\web && npx next build

# Run dev server
cd c:\opt\mvp\web && npm run dev

# Check errors
cd c:\opt\mvp\web && npx next lint

# Apply migration
cd c:\opt\mvp && supabase migration up

# Check database
# Go to Supabase dashboard → SQL Editor
SELECT * FROM coach_wellness_goals ORDER BY created_at DESC LIMIT 5;
```

---

**Last Updated:** February 14, 2026  
**Implementation Status:** ✅ Complete  
**Build Status:** ✅ Verified
