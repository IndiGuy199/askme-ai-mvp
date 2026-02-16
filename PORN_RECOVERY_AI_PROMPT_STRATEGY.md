# Porn Recovery AI Prompt Strategy
**Last Updated:** February 13, 2026

This document defines the complete AI generation strategy for porn recovery goals and actions in AskMe AI. It addresses the repetition problem by using archetype-based routing, strict anti-generic rules, and variety enforcement.

---

## 1. Goal Archetype Map (Code-Side Classification)

These archetypes are NOT sent to the AI prompt directly—they're used in your code to:
- Classify generated goals
- Rotate which archetypes to request per generation call
- Filter existing goals to ensure variety

### Archetype Definitions

| Archetype | Focus | Typical Keywords |
|-----------|-------|------------------|
| `POST_SLIP_CONTAINMENT` | Stop binge cycles, prevent "second session", rapid recovery | second session, binge, after slip, spiral, recover, containment |
| `BEDTIME_RISK_WINDOW` | Late-night access control (10pm–1am), phone-in-bed protocols | night, bed, sleep, 10pm, late, evening, bedroom |
| `ACCESS_PATHWAY_BLOCK` | Block search/social/incognito pathways | block, filter, safesearch, reddit, twitter, ig, search, incognito, apps |
| `BORED_ALONE_LOOP` | Isolation triggers, idle time, lunch breaks | bored, alone, lunch, idle, isolation, nothing to do |
| `STRESS_ESCAPE` | Post-work stress, anxiety escape patterns | stress, anxiety, overwhelmed, after work, escape |
| `FANTASY_SPIRAL` | Mental rehearsal loops, fantasy containment | fantasy, rehearse, loop in mind, mental, visualization |
| `ACCOUNTABILITY_BUILD` | Support systems, check-ins, tracking | accountability, support, check-in, partner, sponsor, group |

### Classification Rules (Starter Logic)

```javascript
function classifyGoalArchetype(goalLabel) {
  const lower = goalLabel.toLowerCase();
  
  if (/second session|binge|after slip|spiral|recover|containment/i.test(lower)) {
    return 'POST_SLIP_CONTAINMENT';
  }
  if (/night|bed|sleep|10pm|late|evening|bedroom/i.test(lower)) {
    return 'BEDTIME_RISK_WINDOW';
  }
  if (/block|filter|safesearch|reddit|twitter|ig|search|incognito|apps/i.test(lower)) {
    return 'ACCESS_PATHWAY_BLOCK';
  }
  if (/bored|alone|lunch|idle|isolation/i.test(lower)) {
    return 'BORED_ALONE_LOOP';
  }
  if (/stress|anxiety|overwhelmed|after work|escape/i.test(lower)) {
    return 'STRESS_ESCAPE';
  }
  if (/fantasy|rehearse|loop in mind|mental|visualization/i.test(lower)) {
    return 'FANTASY_SPIRAL';
  }
  return 'ACCOUNTABILITY_BUILD';
}
```

### Archetype Rotation Strategy

**Problem:** If you always request the same 3 archetypes, you get the same goals.

**Solution:** Rotate which 3 archetypes you request per generation call.

```javascript
const ALL_ARCHETYPES = [
  'POST_SLIP_CONTAINMENT',
  'BEDTIME_RISK_WINDOW', 
  'ACCESS_PATHWAY_BLOCK',
  'BORED_ALONE_LOOP',
  'STRESS_ESCAPE',
  'FANTASY_SPIRAL',
  'ACCOUNTABILITY_BUILD'
];

function selectArchetypesForGeneration(existingGoals, userMetrics) {
  // Get archetypes already in library
  const existingArchetypes = existingGoals.map(g => g.archetype || classifyGoalArchetype(g.label));
  
  // Priority rules based on user state
  let priorities = [];
  
  if (userMetrics.second_session_rate_30d > 0.5) {
    priorities.push('POST_SLIP_CONTAINMENT');
  }
  if (userMetrics.common_risk_window?.includes('pm') || userMetrics.common_location === 'bed') {
    priorities.push('BEDTIME_RISK_WINDOW');
  }
  if (userMetrics.common_pathway?.length > 0) {
    priorities.push('ACCESS_PATHWAY_BLOCK');
  }
  if (userMetrics.top_trigger === 'bored_alone') {
    priorities.push('BORED_ALONE_LOOP');
  }
  if (userMetrics.top_trigger === 'stress' || userMetrics.top_trigger === 'anxiety') {
    priorities.push('STRESS_ESCAPE');
  }
  
  // Shuffle and pick 3 different archetypes
  const availableArchetypes = ALL_ARCHETYPES.filter(a => 
    !existingArchetypes.includes(a) || 
    existingArchetypes.filter(ea => ea === a).length < 2
  );
  
  // Combine priorities + random selection
  const selected = [...new Set([...priorities, ...shuffleArray(availableArchetypes)])].slice(0, 3);
  
  return selected.length === 3 ? selected : ALL_ARCHETYPES.slice(0, 3);
}
```

---

## 2. System Prompt (Shared by Goal + Action Generation)

Use this as the `systemPrompt` parameter for both `/api/coach/goals` and `/api/coach/actions` endpoints.

```
You are AskMe AI's Porn Recovery Coach — a specialist in pornography addiction behavior change.
Your job is to generate practical, non-fluffy recovery goals and actions that reduce porn use and prevent binges.

NON-NEGOTIABLE RULES
- Never output generic filler ("take deep breaths", "drink water", "leave the room", "be mindful") unless:
  (a) it is NOT action #1, AND
  (b) it is tailored to the user's specific risk window/location/pathway, AND
  (c) intensity < 5 (if intensity is provided).
- Do not tell the user to "turn off your phone" or "close the device" if they are using this app on that device.
  Instead, use micro-friction compatible with staying in-app (face-down, Focus mode allowing AskMe AI, move to brighter area while keeping app open, etc.).
- All outputs must be specific, measurable, and achievable in real life.
- Use the user's severity + history metrics to decide what matters most.
- Never repeat existing goals/actions or close paraphrases. If a similar item exists, create a genuinely different mechanism.

STYLE
- Direct, practical, behavior-focused.
- Short titles. Concrete steps. Clear success definition.
- Assume shame sensitivity: avoid moralizing. Focus on containment + next rep.

OUTPUT FORMAT
- Always output STRICT JSON matching the schema requested in the user prompt.
- No markdown. No commentary. No extra keys.
```

---

## 3. Goal Generation User Prompt Template

### Input Variables

```typescript
interface GoalGenerationContext {
  severity: 'occasional' | 'growing' | 'compulsive' | 'overwhelming';
  user_metrics_compact: string; // JSON string, see format below
  existing_goals: Array<{ label: string; archetype?: string }>;
  allowed_goal_archetypes: string[]; // Exactly 3 archetypes
}
```

### User Metrics Compact Format

Keep it small and consistent (under 500 chars):

```json
{
  "streak_days": 2,
  "slips_7d": 3,
  "slips_30d": 14,
  "binge_days_30d": 4,
  "common_risk_window": "10:30pm-12:30am",
  "common_location": "bed",
  "common_pathway": ["reddit", "search", "incognito"],
  "second_session_rate_30d": 0.6,
  "post_slip_shame_1_5": 4,
  "top_trigger": "bored_alone",
  "primary_device": "phone"
}
```

### Prompt Template

```
Generate exactly 3 porn recovery goals for this user.

USER_METRICS (compact JSON):
{{user_metrics_compact}}

SEVERITY: {{severity}}

EXISTING_GOALS (do not repeat or paraphrase):
{{existing_goals}}

ALLOWED_GOAL_ARCHETYPES (must use 3 DIFFERENT archetypes, one each):
{{allowed_goal_archetypes}}

GOAL QUALITY RULES
1) Each goal MUST be a real recovery goal an actual porn user would find relieving.
2) Each goal MUST have:
   - clear success criteria (binary or count-based)
   - realistic duration_days (7, 14, or 30 only)
   - a baseline_capture prompt: 1 short question to record "where the user is right now" for that goal
3) Goals must match severity:
   - occasional: awareness + prevention + boundaries (lightweight)
   - growing: pattern interruption + risk-window routines + frequency reduction
   - compulsive: lockdown + anti-binge containment + accountability scaffolding
   - overwhelming: stabilization + crisis friction + "today only" containment + external support push
4) BAN these weak goal styles:
   - "be mindful", "practice gratitude", "reduce stress" (unless tied to porn loop with measurable success)
5) Do NOT include actions here. Only goals.

RETURN STRICT JSON ONLY:
{
  "challenge": "porn",
  "severity": "{{severity}}",
  "goals": [
    {
      "label": "under 60 chars",
      "archetype": "ONE OF: POST_SLIP_CONTAINMENT | BEDTIME_RISK_WINDOW | ACCESS_PATHWAY_BLOCK | BORED_ALONE_LOOP | STRESS_ESCAPE | FANTASY_SPIRAL | ACCOUNTABILITY_BUILD",
      "description": "1–2 sentences, include success criteria",
      "duration_days": 7|14|30,
      "baseline_capture_question": "1 short question to capture starting point",
      "baseline_capture_type": "ONE OF: count_7d | count_30d | yes_no | scale_1_5 | minutes | checklist",
      "why_this_now": "1 sentence, personalized to metrics + severity"
    }
  ]
}
```

### Implementation Example

```typescript
// web/pages/api/coach/goals.ts
export async function generatePornRecoveryGoals(context: GoalGenerationContext) {
  const systemPrompt = PORN_RECOVERY_SYSTEM_PROMPT; // From section 2
  
  const userPrompt = `Generate exactly 3 porn recovery goals for this user.

USER_METRICS (compact JSON):
${context.user_metrics_compact}

SEVERITY: ${context.severity}

EXISTING_GOALS (do not repeat or paraphrase):
${context.existing_goals.map(g => `- ${g.label} (${g.archetype || 'unknown'})`).join('\n')}

ALLOWED_GOAL_ARCHETYPES (must use 3 DIFFERENT archetypes, one each):
${context.allowed_goal_archetypes.join(', ')}

... [rest of template from above]
`;

  const result = await generateStructuredOutput(
    systemPrompt,
    userPrompt,
    GoalResponseSchema,
    'gpt-4o-mini',
    2 // max retries
  );
  
  return result;
}
```

---

## 4. Action Generation User Prompt Template

### Input Variables

```typescript
interface ActionGenerationContext {
  severity: 'occasional' | 'growing' | 'compulsive' | 'overwhelming';
  user_metrics_compact: string;
  goal_label: string;
  goal_archetype: string;
  existing_active_actions_for_goal: string[]; // Action titles already active
  existing_library_actions_for_goal: string[]; // All actions in library for this goal
  allowed_action_categories: string[]; // Exactly 3 categories
  intensity_1_10?: number; // Optional, from Support Now
  location?: string; // Optional context
}
```

### Action Categories

```
DEVICE_FRICTION       - Physical barriers, app blocks, device location changes
ENVIRONMENT_SHIFT     - Room changes, lighting, physical space modifications
ACCOUNTABILITY_PING   - Texts, calls, check-ins, logging
TIME_PROTOCOL         - Scheduled delays, timed routines, calendar blocks
ANTI_BINGE_LOCK       - Post-slip containment, binge prevention, lockdown
RECOVERY_REPAIR       - Post-slip recovery steps, getting back on track
SHAME_REPAIR          - Self-compassion scripts, shame interruption
URGE_INTERRUPT        - Grounding, sensory redirect, physical movement
```

### Prompt Template

```
Generate exactly 3 actions for the goal below. The goal is for pornography addiction recovery.

USER_METRICS (compact JSON):
{{user_metrics_compact}}

SEVERITY: {{severity}}

GOAL:
{
  "label": "{{goal_label}}",
  "archetype": "{{goal_archetype}}"
}

EXISTING ACTIONS (do not repeat or paraphrase)
ACTIVE_ACTIONS_FOR_GOAL:
{{existing_active_actions_for_goal}}

LIBRARY_ACTIONS_FOR_GOAL:
{{existing_library_actions_for_goal}}

CONTEXT (may be empty):
{
  "intensity_1_10": {{intensity_or_null}},
  "location": "{{location_or_null}}"
}

ALLOWED_ACTION_CATEGORIES (must output exactly one per category, in any order):
{{allowed_action_categories}}

ARCHETYPE GATING (mandatory)
- POST_SLIP_CONTAINMENT must include:
  (1) ANTI_BINGE_LOCK action (close loop + prevent "second session")
  (2) SHAME_REPAIR or RECOVERY_REPAIR action (break justification spiral)
  (3) DEVICE_FRICTION or ACCOUNTABILITY_PING action (prevent easy relapse)
  
- BEDTIME_RISK_WINDOW must include:
  (1) DEVICE_FRICTION tailored to the risk window
  (2) ROUTINE_ANCHOR or TIME_PROTOCOL
  (3) ENVIRONMENT_SHIFT compatible with staying in-app
  
- ACCESS_PATHWAY_BLOCK must include:
  (1) friction targeting the actual pathway (apps/search/incognito)
  (2) a "replacement default" for risk window (what to do instead)
  (3) accountability or logging action

ANTI-GENERIC RULES (hard bans)
- If intensity >= 5: action #1 cannot be breathing/grounding.
- No "turn off phone", "close device", "stop using your phone".
- No vague actions like "be mindful", "take a walk", "distract yourself" unless you specify when/how/for how long and what success looks like.
- Every action must have a concrete trigger condition ("When X happens…") and success definition.

ACTION CONTENT REQUIREMENTS
Each action must include:
- title: concrete and time/trigger-specific (e.g., "After any slip: close tabs + lock for 10 min")
- duration_seconds: realistic (60–900)
- when_to_use: short trigger statement
- success_criteria: measurable
- logging_prompt: what user should record (supports done/partial + percent + notes)
- ai_notes_read_only:
   * what to do (step-by-step, 2–4 bullets)
   * why it works (1 line)
   * common failure mode + workaround (1 line)
   * what to log (1 line)

RETURN STRICT JSON ONLY:
{
  "challenge": "porn",
  "goal_label": "{{goal_label}}",
  "goal_archetype": "{{goal_archetype}}",
  "actions": [
    {
      "title": "under 70 chars",
      "category": "ONE OF: DEVICE_FRICTION | ENVIRONMENT_SHIFT | ACCOUNTABILITY_PING | TIME_PROTOCOL | ANTI_BINGE_LOCK | RECOVERY_REPAIR | SHAME_REPAIR | URGE_INTERRUPT",
      "duration_seconds": 60-900,
      "difficulty": "easy|medium|hard",
      "when_to_use": "1 sentence trigger",
      "success_criteria": "1 sentence measurable",
      "logging_prompt": "1 short prompt",
      "ai_notes_read_only": {
        "steps": ["...", "..."],
        "why_it_works": "1 line",
        "failure_mode_fix": "1 line",
        "what_to_log": "1 line"
      }
    }
  ]
}
```

---

## 5. Example: "Good" Output Quality Reference

### Goal Example (POST_SLIP_CONTAINMENT)

**GOOD:**
```json
{
  "label": "No 'second session' after any slip (30-day goal)",
  "archetype": "POST_SLIP_CONTAINMENT",
  "description": "After any slip, complete containment protocol and lock access for 10 minutes. Success = zero second sessions in 30 days.",
  "duration_days": 30,
  "baseline_capture_question": "In the past 30 days, how many times did you have a second session after the first slip?",
  "baseline_capture_type": "count_30d",
  "why_this_now": "Your second-session rate is 60%—breaking this loop is your fastest path to longer streaks."
}
```

**BAD:**
```json
{
  "label": "Daily recovery reps",
  "description": "Do recovery practices every day",
  "duration_days": 30,
  ...
}
```

### Action Examples (for POST_SLIP_CONTAINMENT goal)

**Action #1 (ANTI_BINGE_LOCK) — GOOD:**
```json
{
  "title": "After any slip: Close + Lock for 10 minutes (stay in app)",
  "category": "ANTI_BINGE_LOCK",
  "duration_seconds": 600,
  "difficulty": "easy",
  "when_to_use": "Immediately after any slip, before any second thought",
  "success_criteria": "All tabs/apps closed + blocker enabled + 10-minute timer completed",
  "logging_prompt": "Did you complete the lockdown and wait the full 10 minutes?",
  "ai_notes_read_only": {
    "steps": [
      "Close all browser tabs and apps (except AskMe AI)",
      "Enable blocker/filter for 10 minutes",
      "Set timer, stay in AskMe AI or walk to different room",
      "When timer ends, decide: continue containment or move on with day"
    ],
    "why_it_works": "Creates forced pause that breaks automatic 'second session' pattern",
    "failure_mode_fix": "If you skip lockdown: set 5-minute timer instead of 10, just to start the habit",
    "what_to_log": "Done/partial + note if you extended the lockdown beyond 10 min"
  }
}
```

**Action #2 (SHAME_REPAIR) — GOOD:**
```json
{
  "title": "30-second 'Not continuing' script + 1-line recommit",
  "category": "SHAME_REPAIR",
  "duration_seconds": 30,
  "difficulty": "easy",
  "when_to_use": "Right after the slip, before shame spiral starts",
  "success_criteria": "Script read aloud + recommit statement logged",
  "logging_prompt": "What's your recommit statement for today?",
  "ai_notes_read_only": {
    "steps": [
      "Say out loud: 'I slipped. I'm not continuing. This is one moment, not my whole day.'",
      "Write 1 line: 'My next step is: [specific next action]'",
      "Log it in app"
    ],
    "why_it_works": "Interrupts shame → justification → second session loop",
    "failure_mode_fix": "If saying out loud feels weird: text it to yourself or write it on paper",
    "what_to_log": "Your recommit statement + whether you stayed stopped"
  }
}
```

**Action #3 (DEVICE_FRICTION) — GOOD:**
```json
{
  "title": "Move device to bright room + timer for 5 min (stay in app)",
  "category": "DEVICE_FRICTION",
  "duration_seconds": 300,
  "difficulty": "easy",
  "when_to_use": "After containment protocol, before resuming normal phone use",
  "success_criteria": "Device moved to kitchen/living room + 5-minute reset completed",
  "logging_prompt": "Did you complete the location change + 5-min reset?",
  "ai_notes_read_only": {
    "steps": [
      "Take device to brightest room in house (kitchen/living room)",
      "Set 5-minute timer in AskMe AI",
      "Stand or sit in bright light, device visible (not hidden)",
      "When timer ends, decide next activity with device in hand"
    ],
    "why_it_works": "Light + public space reduces relapse risk without requiring you to abandon device",
    "failure_mode_fix": "If 5 min feels too long: start with 2 minutes, just to build the habit",
    "what_to_log": "Done/partial + note if you felt urge during the 5 min"
  }
}
```

**BAD Examples (DO NOT GENERATE):**
- "Take 3 deep breaths"
- "Leave the room"
- "Distract yourself"
- "Be mindful of your feelings"
- "Turn off your phone"

---

## 6. Implementation Checklist

### Backend Changes Needed

- [ ] Update `/api/coach/goals` to use new system prompt + user prompt template
- [ ] Update `/api/coach/actions` to use new system prompt + user prompt template
- [ ] Add `archetype` field to goal schema (Zod + DB)
- [ ] Add `category` field to action schema (already exists as `mechanism_type`—map or rename)
- [ ] Implement archetype rotation logic in goal generation
- [ ] Implement category rotation logic in action generation
- [ ] Build `user_metrics_compact` JSON from existing context functions
- [ ] Add archetype classification function (keyword-based)
- [ ] Increase OpenAI temperature to 0.9 for more variety
- [ ] Add archetype-based gating validation (reject responses that don't follow archetype rules)

### Schema Changes

```sql
-- Add archetype to coach_wellness_goals
ALTER TABLE coach_wellness_goals 
ADD COLUMN IF NOT EXISTS archetype TEXT CHECK (archetype IN (
  'POST_SLIP_CONTAINMENT',
  'BEDTIME_RISK_WINDOW',
  'ACCESS_PATHWAY_BLOCK',
  'BORED_ALONE_LOOP',
  'STRESS_ESCAPE',
  'FANTASY_SPIRAL',
  'ACCOUNTABILITY_BUILD'
));

-- Add baseline capture fields
ALTER TABLE coach_wellness_goals
ADD COLUMN IF NOT EXISTS baseline_capture_question TEXT,
ADD COLUMN IF NOT EXISTS baseline_capture_type TEXT CHECK (baseline_capture_type IN (
  'count_7d', 'count_30d', 'yes_no', 'scale_1_5', 'minutes', 'checklist'
));

-- Rename or map mechanism_type → category for actions
-- (Or keep as-is and map in code)
```

### Frontend Changes

- [ ] Display goal archetype as a badge/tag in UI
- [ ] Display action category as a badge/tag in UI
- [ ] Update create goal flow to show baseline capture question
- [ ] Store baseline capture responses in `user_goal_baselines` table

### Testing

- [ ] Generate goals 5 times in a row → verify all 5 sets are different
- [ ] Generate actions for same goal 5 times → verify variety
- [ ] Test POST_SLIP_CONTAINMENT archetype → verify mandatory action types included
- [ ] Test BEDTIME_RISK_WINDOW archetype → verify risk-window-specific actions
- [ ] Verify no generic "take deep breaths" actions unless intensity < 5 and position > 1

---

## 7. Migration Path

### Phase 1: Backend (Week 1)
1. Add archetype field to DB
2. Update goal generation endpoint with new prompts
3. Update action generation endpoint with new prompts
4. Test in staging

### Phase 2: Classification (Week 1)
1. Add archetype classification function
2. Run batch classification on existing goals
3. Update existing library goals with archetypes

### Phase 3: Rotation (Week 2)
1. Implement archetype rotation logic
2. Implement category rotation logic
3. A/B test old vs new generation

### Phase 4: Frontend (Week 2)
1. Display archetypes/categories in UI
2. Add baseline capture flow
3. Update action cards to show new metadata

---

## 8. Success Metrics

**Goal Variety:**
- Target: <30% overlap in goal labels across 5 consecutive generations
- Measure: Cosine similarity of goal titles

**Action Variety:**
- Target: All 3 actions use different categories per generation
- Target: <20% exact title matches across 5 consecutive generations for same goal

**Quality:**
- Target: 0 instances of banned generic actions in production
- Target: 100% of goals have measurable success criteria
- Target: 100% of actions have concrete trigger conditions

---

## 9. Maintenance

### Monthly Review
- Check for new generic patterns emerging
- Update banned phrase list
- Review user feedback on action quality
- Adjust archetype weights based on user recovery metrics

### Quarterly Refinement
- Add new archetypes as patterns emerge
- Refine archetype gating rules
- Update action categories if needed
- Re-train classification if accuracy drops

---

**End of Document**
