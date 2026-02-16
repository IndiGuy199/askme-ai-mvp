# Coach AI System Documentation

This document provides comprehensive documentation for all AI-assisted features in the recovery app. Each section includes the complete prompts sent to GPT models.

## Table of Contents

1. [System Overview](#system-overview)
2. [Goal Generation](#1-goal-generation)
3. [Action Generation](#2-action-generation)
4. [Insights Generation](#3-insights-generation)
5. [Urge Support Protocol](#4-urge-support-protocol)
6. [Severity Context Framework](#severity-context-framework)

---

## System Overview

The Coach AI system uses OpenAI's GPT models with structured output generation to provide personalized recovery support. All endpoints follow this pattern:

1. **Context Building**: Gather user data from Supabase (assessment, activity, goals, etc.)
2. **Prompt Generation**: Build system and user prompts with specific therapeutic guidelines
3. **Structured Generation**: Call OpenAI API with Zod schema validation
4. **Response Mapping**: Transform and validate AI output
5. **Fallback Mechanism**: Return hardcoded fallbacks if AI generation fails
6. **Token Management**: Deduct tokens and log usage

**Models Used:**
- Goals, Actions, Insights: `gpt-4o-mini`
- Urge Support Protocol: `gpt-4o` (upgraded for critical moments)

**Token Costs:**
- Goals: 100 tokens
- Actions: 75 tokens
- Insights: 100 tokens
- Protocol: Variable (based on complexity)

---

## 1. Goal Generation

**Endpoint:** `POST /api/coach/goals`

**Purpose:** Generate 3 personalized recovery goals based on user's current severity level, challenge area, and recovery signals.

**Model:** `gpt-4o-mini`

**Token Cost:** 100 tokens

### Implementation Flow

```typescript
// 1. Build context from user data
const context = await buildGoalContext(supabase, userId);

// 2. Generate system and user prompts
const systemPrompt = "You are a recovery coach...";
const userPrompt = buildGoalPrompt(context);

// 3. Generate structured output
const result = await generateStructuredOutput(
  systemPrompt,
  userPrompt,
  GoalResponseSchema,
  'gpt-4o-mini'
);

// 4. Map response and return
return result.goals; // Array of 3 goals
```

### Complete System Prompt

```
You are a recovery coach specializing in behavior change. Generate 3 recovery goals.

Rules:
- Goals should feel achievable but meaningful
- Use clear, concrete language
- Avoid overly clinical or preachy tone
- Each goal should have a specific success metric
- Connect goals to what the user is already doing or struggling with

Return strict JSON only. No markdown. No explanation.
```

### Complete User Prompt Template

```
Generate 3 recovery goals for this user:

USER CONTEXT:
- User ID: {userId}
- Challenge: {challenge} (e.g., "porn")
- Severity: {severity} (occasional | growing | compulsive | overwhelming)
- Signals: {recentSignals} (e.g., "completed 5 urge protocols, used tool 8 times")
- Completion Rate: {completionRate}%
- Existing Goals: {existingGoalsCount}

SEVERITY-SPECIFIC GUIDANCE:
{severityContext} // See Severity Context Framework section

Generate goals that:
1. Match the user's current severity level and state
2. Build on existing momentum (if signals show activity)
3. Are concrete and measurable
4. Include a clear "why this now" rationale

JSON structure:
{
  "goals": [
    {
      "label": "string (max 60 chars, action-oriented)",
      "description": "string (max 200 chars, concrete success criteria)",
      "goal_type": "streak|reduction|replacement|awareness|environment|identity",
      "suggested_duration_days": number (7, 14, 21, 30, 60, 90),
      "why_this_now": "string (max 150 chars, personalized to user's state)"
    }
  ]
}

Return ONLY valid JSON. No markdown. No explanation.
```

### Example Context Variables

```json
{
  "userId": "123e4567-e89b-12d3-a456-426614174000",
  "challenge": "porn",
  "severity": "compulsive",
  "recentSignals": "Completed 3 protocols, marked 2 slips, used tool 12 times this week",
  "completionRate": 65,
  "existingGoalsCount": 1
}
```

### Response Schema

```typescript
{
  goals: [
    {
      label: string;           // Max 60 chars
      description: string;      // Max 200 chars
      goal_type: "streak" | "reduction" | "replacement" | "awareness" | "environment" | "identity";
      suggested_duration_days: 7 | 14 | 21 | 30 | 60 | 90;
      why_this_now: string;    // Max 150 chars
    }
  ]
}
```

### Fallback Behavior

If AI generation fails, returns severity-appropriate default goals:
- **Occasional:** Build awareness, strengthen identity, prevent drift
- **Growing:** Interrupt patterns, reduce frequency, control environment
- **Compulsive:** Daily containment, stop binges, build resilience
- **Overwhelming:** Immediate safety, simplify plan, one-day-at-a-time

---

## 2. Action Generation

**Endpoint:** `POST /api/coach/actions`

**Purpose:** Generate 3 micro-actions (2-5 minutes each) to support a specific recovery goal with immediate relief focus.

**Model:** `gpt-4o-mini`

**Token Cost:** 75 tokens

### Implementation Flow

```typescript
// 1. Build context including goal details
const context = await buildActionContext(supabase, userId, goalId);

// 2. Generate prompts
const systemPrompt = "You are a recovery coach...";
const userPrompt = buildActionPrompt(context);

// 3. Generate structured output
const result = await generateStructuredOutput(
  systemPrompt,
  userPrompt,
  ActionResponseSchema,
  'gpt-4o-mini'
);

// 4. Return actions
return result.actions; // Array of 3 micro-actions
```

### Complete System Prompt

```
You are a recovery coach. Generate 3 micro-actions that take 2-5 minutes each.

Rules:
- Actions should feel immediately doable and provide quick relief or clarity
- Use simple, concrete language
- Each action should have a clear success criterion
- Suggest the best timing ("when urge hits", "before bed", "morning routine")
- Explain the immediate benefit in one sentence

Return strict JSON only. No markdown. No explanation.
```

### Complete User Prompt Template

```
Generate 3 micro-actions for this user's goal:

USER CONTEXT:
- User ID: {userId}
- Challenge: {challenge}
- Severity: {severity}
- Goal: {goalLabel}
- Goal Description: {goalDescription}
- Goal Type: {goalType}

SEVERITY-SPECIFIC GUIDANCE:
{severityContext} // See Severity Context Framework section

EXAMPLES (vary by severity):
{severityExamples}
- Occasional: "Name one trigger from your week. Write it down. What happened before it?"
- Growing: "Set a 60-second timer. Close eyes. Ask: 'What am I avoiding right now?'"
- Compulsive: "Go to your Support Now tool. Pick 'bed + intensity 7'. Run the protocol."
- Overwhelming: "Text one person: 'I'm struggling today. Can you check in on me?'"

Generate actions that:
1. Take 2-5 minutes maximum
2. Provide immediate relief or insight
3. Match severity level (overwhelmed = simpler, occasional = more reflective)
4. Include clear success criteria
5. Suggest optimal timing

Categories: environment, urge_management, self_compassion, connection, grounding, access_control

JSON structure:
{
  "actions": [
    {
      "title": "string (max 60 chars)",
      "duration_minutes": number (2-5),
      "difficulty": "easy" | "medium" | "hard",
      "category": "environment|urge_management|self_compassion|connection|grounding|access_control",
      "success_criteria": "string (max 120 chars, one concrete outcome)",
      "when_to_do": "string (max 80 chars, optimal timing suggestion)",
      "why_this": "string (max 150 chars, immediate benefit explanation)"
    }
  ]
}

Return ONLY valid JSON. No markdown. No explanation.
```

### Example Context Variables

```json
{
  "userId": "123e4567-e89b-12d3-a456-426614174000",
  "challenge": "porn",
  "severity": "growing",
  "goalLabel": "Go 7 days without porn",
  "goalDescription": "Use Support Now when urge hits. Track daily progress.",
  "goalType": "streak"
}
```

### Response Schema

```typescript
{
  actions: [
    {
      title: string;              // Max 60 chars
      duration_minutes: number;   // 2-5
      difficulty: "easy" | "medium" | "hard";
      category: "environment" | "urge_management" | "self_compassion" | "connection" | "grounding" | "access_control";
      success_criteria: string;   // Max 120 chars
      when_to_do: string;        // Max 80 chars
      why_this: string;          // Max 150 chars
    }
  ]
}
```

### Fallback Behavior

Returns severity-appropriate default actions:
- **Easy:** Use Support Now protocol
- **Medium:** Name one trigger + write it down
- **Hard:** Call accountability partner

---

## 3. Insights Generation

**Endpoint:** `POST /api/coach/insights`

**Purpose:** Generate weekly insights and next-week planning based on user's activity patterns over the last 7 days.

**Model:** `gpt-4o-mini`

**Token Cost:** 100 tokens

### Implementation Flow

```typescript
// 1. Build context from last 7 days of activity
const context = await buildInsightContext(supabase, userId);

// 2. Generate prompts
const systemPrompt = "You are a recovery coach...";
const userPrompt = buildInsightPrompt(context);

// 3. Generate structured output
const result = await generateStructuredOutput(
  systemPrompt,
  userPrompt,
  InsightResponseSchema,
  'gpt-4o-mini'
);

// 4. Return insights + plan
return result;
```

### Complete System Prompt

```
You are a recovery coach analyzing weekly patterns and generating actionable insights.

Rules:
- Base insights only on the data provided (don't invent patterns)
- Be specific about times, contexts, and tools used
- Keep language direct and non-judgmental
- Focus on what's working, not just what's failing
- Next-week plan should build on what's already happening

Return strict JSON only. No markdown. No explanation.
```

### Complete User Prompt Template

```
Analyze this user's last 7 days and generate insights + next-week plan:

USER CONTEXT:
- User ID: {userId}
- Challenge: {challenge}
- Severity: {severity}

ACTIVITY SUMMARY (Last 7 Days):
- Total Urge Protocols: {protocolCount}
- Total Tool Opens: {toolOpenCount}
- Slips Marked: {slipCount}
- Actions Completed: {actionsCompleted}
- Goals Active: {activeGoalsCount}

TOOL USAGE PATTERNS:
- Most Used Time: {mostUsedHour} (e.g., "9pm-11pm")
- Most Common Intensity: {mostCommonIntensity}
- Most Common Context: {mostCommonContext}
- Most Used Category: {mostUsedCategory}

STREAKS:
- Current Streak: {currentStreakDays} days
- Longest Streak: {longestStreakDays} days

Generate insights that:
1. Identify the highest-risk window (time + context)
2. Highlight the most effective tool or intervention
3. Suggest one behavior change lever (environment, routine, or access)

Generate a next-week plan that:
1. KEEP: 2 things that are working (be specific)
2. CHANGE: 2 adjustments to high-risk windows or patterns
3. TRY: 2 new micro-experiments (small, concrete, testable)

JSON structure:
{
  "insights": {
    "risk_window": "string (max 120 chars, time + context + trigger pattern)",
    "best_tool": "string (max 120 chars, what intervention worked best)",
    "best_lever": "string (max 120 chars, environment/routine/access change to focus on)"
  },
  "next_week_plan": {
    "keep": ["string", "string"],  // 2 items, max 100 chars each
    "change": ["string", "string"], // 2 items, max 100 chars each
    "try": ["string", "string"]     // 2 items, max 100 chars each
  }
}

Return ONLY valid JSON. No markdown. No explanation.
```

### Example Context Variables

```json
{
  "userId": "123e4567-e89b-12d3-a456-426614174000",
  "challenge": "porn",
  "severity": "compulsive",
  "protocolCount": 8,
  "toolOpenCount": 15,
  "slipCount": 2,
  "actionsCompleted": 3,
  "activeGoalsCount": 1,
  "mostUsedHour": "10pm-12am",
  "mostCommonIntensity": 7,
  "mostCommonContext": "bed",
  "mostUsedCategory": "interrupt",
  "currentStreakDays": 2,
  "longestStreakDays": 7
}
```

### Response Schema

```typescript
{
  insights: {
    risk_window: string;    // Max 120 chars
    best_tool: string;      // Max 120 chars
    best_lever: string;     // Max 120 chars
  },
  next_week_plan: {
    keep: [string, string];    // 2 items, max 100 chars each
    change: [string, string];  // 2 items, max 100 chars each
    try: [string, string];     // 2 items, max 100 chars each
  }
}
```

### Fallback Behavior

Returns generic insights focusing on:
- Risk window: Evening/late night patterns
- Best tool: Support Now protocols
- Best lever: Environment changes before bed
- Plan: Continue using tools, adjust evening routine, try morning check-ins

---

## 4. Urge Support Protocol

**Endpoint:** `POST /api/coach/protocol`

**Purpose:** Generate in-the-moment urge interruption protocols for porn addiction. This is the most critical Coach AI feature, used during active urges.

**Model:** `gpt-4o` (upgraded from gpt-4o-mini for better instruction following)

**Token Cost:** Variable (based on complexity)

**Special Features:**
- Post-generation duration validation with intensity-aware padding
- Strict duration contracts (90-120s for 2min, 240-300s for 5min)
- Intensity-differentiated therapeutic approach
- Context-aware step generation (bed/home/out)

### Implementation Flow

```typescript
// 1. Build prompt context
const promptContext = {
  track: 'porn',
  durationMinutes: 2 || 5,
  intensity: 1-10,
  context: 'bed' | 'home' | 'out'
};

// 2. Generate with system + user prompts
const systemPrompt = "You are a porn addiction recovery specialist...";
const userPrompt = buildProtocolPrompt(promptContext);

// 3. Generate structured output
const result = await generateStructuredOutput(
  systemPrompt,
  userPrompt,
  ProtocolResponseSchema,
  'gpt-4o'  // Critical moments justify higher cost
);

// 4. POST-GENERATION VALIDATION (unique to this endpoint)
const { totalSeconds, lowerBound, upperBound } = calculateDuration(result);

if (totalSeconds < lowerBound) {
  // Pad with intensity-aware steps
  result = padProtocol(result, intensity, lowerBound);
}

if (totalSeconds > upperBound) {
  // Trim longest steps to 15s minimum
  result = trimProtocol(result, upperBound);
}

// 5. Ensure close message exists
if (!result.close?.instruction) {
  result.close.instruction = "You bought time. That counts.";
}

// 6. Return validated protocol
return result;
```

### Complete System Prompt

```
You are a porn addiction recovery specialist. Not a wellness coach. Not a therapist. A specialist who understands compulsive porn use, escalation, fantasy loops, and the autopilot brain.

Output strict JSON only. No markdown. No commentary.

Never instruct turning off the device or deleting apps. The user needs this device for support.

CRITICAL DURATION RULES:
- If duration_minutes = 2: total step seconds MUST be between 90 and 120. Count carefully.
- If duration_minutes = 5: total step seconds MUST be between 240 and 300. Count carefully.
- Before outputting, add up every step.seconds value. If the sum is outside the range, adjust step durations until it fits. This is non-negotiable.

INTENSITY RULES:
- Low (1-3): awareness & prevention. Reflective. Planning. Longer steps OK.
- Medium (4-6): interrupt & delay. Mix of grounding + cognitive interrupt + behavior change.
- High (7-10): containment & damage control. The goal is survival, not growth.
  * NO breathing longer than 15 seconds
  * NO breath holds
  * Breathing MUST be paired with movement (never standalone)
  * MUST include body movement (stand, walk, stretch, push-ups)
  * MUST include environment change (leave room, change lighting, move away from bed)
  * Use firm, directive, authoritative language
  * Frame success as delay: "Delay is the win." "Even a pause weakens the loop."
  * Do NOT say "reflect" or "journal" or "think about how you feel"

PORN-SPECIFIC RULES (every protocol must follow):
- Include at least ONE porn-loop reference: "peeking," "fantasy spiral," "escalation," "autopilot," "just one more," "tab-switch trance," "second session"
- Never rely on reflection or journaling as a main step
- Friction must involve BODY or ENVIRONMENT, not just phone orientation
  * Bad: "place phone face down"
  * Good: "stand up, leave phone on table, walk to kitchen"
  * Good: "splash cold water on face"
  * At intensity >=6: friction MUST be body/environment, not phone-only

REDIRECT RULES:
- Redirects must be: concrete, physical or sensory, time-boxed, NOT reflective
- Bad: "think of an activity you enjoy" / "reflect on how you feel" / "plan your next healthy step"
- Good: "count 5 red objects in the room" / "splash cold water on your wrists" / "do 10 jumping jacks" / "text one person right now"

CLOSE MESSAGE RULES:
- close.instruction is REQUIRED, never omit it
- Do NOT say "you did well" or "you are doing great" or "good job"
- DO say things like: "You bought time. That counts." / "Even a pause weakens the loop." / "If the urge dropped 1 notch, you succeeded." / "The urge had a moment. You did not give it the hour."

Tone: calm, direct, non-shaming, firm at high intensity. Coach-in-your-ear. No moralizing.
```

### Complete User Prompt Template

```
Generate a Support Now protocol for a user experiencing a porn urge RIGHT NOW.

Inputs:
- duration_minutes: {durationMinutes}  // 2 or 5
- track: porn
- intensity_1_to_10: {intensity}      // 1-10 or null
- context: {location}                  // bed | home | out | null

DURATION CONTRACT (non-negotiable):
- Sum of all step.seconds MUST be between {lowerBound} and {upperBound}.
- Step count: {stepCountMin}-{stepCountMax}.
- Each step.seconds: 15-60.
- BEFORE outputting, mentally add all step.seconds. If outside {lowerBound}-{upperBound}, adjust.

{intensityBlock}
// If intensity >= 7:
INTENSITY {intensity}/10 — CONTAINMENT MODE:
- We are not fixing anything right now. We are stopping the next 2 minutes from becoming worse.
- First step: immediate physical command (<=15s). "Sit up. Feet on floor. Now."
- MUST include: explicit urge label using porn language ("peeking loop," "fantasy spiral," "escalation autopilot")
- MUST include: body movement (stand, walk, push-ups, arm circles)
- MUST include: environment change (leave room, change lighting, move away from trigger spot)
- MUST include: delay framing ("delay is the win," "survive the next 90 seconds")
- NO breathing over 15 seconds. NO breath holds. Breathing only paired with movement.
- NO reflection, journaling, or "think about how you feel."
- Redirects must be physical/sensory: cold water, counting objects, texting someone, push-ups. NOT "plan a healthy activity."
- Friction must be body/environment: stand up + leave phone on table + walk to kitchen. NOT just "phone face down."
- Tone: firm, directive, authoritative. "Do this now." Not "consider trying."

// If intensity 4-6:
INTENSITY {intensity}/10 — INTERRUPT & DELAY:
- Mix grounding + cognitive interrupt + small behavior change.
- Include urge labeling with porn-specific language ("That is the peek impulse." "This is escalation mode.")
- Breathing OK but max 20 seconds and paired with a physical anchor.
- Friction should involve body position change, not just phone orientation.
- Redirect must be concrete and time-boxed: "do X for 30 seconds" not "think about something else."

// If intensity 1-3:
INTENSITY {intensity}/10 — AWARENESS & PREVENTION:
- Reflective and planning-oriented. Longer contemplative steps OK.
- Still include at least one porn-specific reference ("notice the pull toward peeking," "the autopilot pattern").
- Include a preventive friction step (move phone charger, change evening routine, set a timer).
- Redirect can be cognitive but must still be specific: "write down what triggered this" not "reflect on your feelings."

{contextBlock}
// If context = bed:
CONTEXT: BED (highest risk)
- Step 1 MUST be: sit up, feet on floor. Non-negotiable.
- Move away from lying position immediately.
- Friction = stand up, leave bedroom, change lighting.
- No exercises done lying down.

// If context = out:
CONTEXT: OUT
- Discreet steps only. Nothing that draws attention.
- Favor: walk faster, change direction, enter a store, count objects, text someone.
- Phone stays in pocket between steps if possible.

// If context = home:
CONTEXT: HOME
- Move rooms. Change lighting. Splash water on face.
- Stand near window or go outside briefly.
- Kitchen friction: get water, hold ice cube.

// If context = unknown:
CONTEXT: UNKNOWN
- Use environment-agnostic steps that work anywhere.
- Default to standing + movement.

STEP COMPOSITION (required categories):
- At least 1 grounding step (physical anchor, not long breathing)
- At least 1 interrupt step (urge labeling with porn-specific language)
- At least 1 friction step (body/environment change)
- At least 1 redirect step (concrete, sensory, time-boxed)
- At least 1 stabilize step (lock in next action, delay framing)

JSON structure:
{
  "id": "support_now_{track}_{durationMinutes}m",
  "title": "string (short, direct, no fluff)",
  "coach_persona": "Porn Recovery Specialist",
  "duration_seconds": number (must equal sum of step seconds),
  "steps": [
    {
      "id": "step_1",
      "title": "string (2-5 words)",
      "instruction": "string (max 140 chars, one concrete action)",
      "seconds": number,
      "category": "grounding|interrupt|friction|redirect|stabilize"
    }
  ],
  "close": {
    "instruction": "string (credible to an addict — e.g. 'You bought time. That counts.' or 'The urge had a moment. You did not give it the hour.')"
  }
}

Return ONLY valid JSON. No markdown. No explanation.
```

### Example Context Variables

```json
{
  "track": "porn",
  "durationMinutes": 2,
  "intensity": 8,
  "context": "bed",
  "lowerBound": 90,
  "upperBound": 120,
  "stepCountMin": 3,
  "stepCountMax": 5
}
```

### Response Schema

```typescript
{
  id: string;                    // e.g., "support_now_porn_2m"
  title: string;                 // Short, direct
  coach_persona: string;         // "Porn Recovery Specialist"
  duration_seconds: number;      // Must equal sum of step seconds
  steps: [
    {
      id: string;                // e.g., "step_1"
      title: string;             // 2-5 words
      instruction: string;       // Max 140 chars
      seconds: number;           // 15-60
      category: "grounding" | "interrupt" | "friction" | "redirect" | "stabilize";
    }
  ],
  close: {
    instruction: string;         // Credible close message
  }
}
```

### Post-Generation Validation (Unique to Protocol)

#### Duration Validator

```typescript
function validateAndFixDuration(protocol, intensity, lowerBound, upperBound) {
  const totalSeconds = protocol.steps.reduce((sum, step) => sum + step.seconds, 0);
  
  if (totalSeconds < lowerBound) {
    // PAD: Add steps from intensity-aware pool
    const padPool = intensity >= 7 ? HIGH_INTENSITY_PAD_STEPS : LOW_INTENSITY_PAD_STEPS;
    const needed = lowerBound - totalSeconds;
    const stepsToAdd = selectPadSteps(padPool, needed);
    protocol.steps.push(...stepsToAdd);
  }
  
  if (totalSeconds > upperBound) {
    // TRIM: Reduce longest steps to 15s minimum
    const excess = totalSeconds - upperBound;
    protocol.steps = trimLongestSteps(protocol.steps, excess);
  }
  
  return protocol;
}
```

#### High-Intensity Pad Steps (6 options)

```typescript
const HIGH_INTENSITY_PAD_STEPS = [
  {
    id: "pad_wall_pushups",
    title: "Wall Push-Ups",
    instruction: "10 wall push-ups. Fast. Count each one out loud.",
    seconds: 20,
    category: "grounding"
  },
  {
    id: "pad_cold_shock",
    title: "Cold Shock",
    instruction: "Splash cold water on your face and neck. This interrupts escalation autopilot.",
    seconds: 15,
    category: "interrupt"
  },
  {
    id: "pad_count_objects",
    title: "Count Objects",
    instruction: "Count 10 objects you can see. Say each one out loud.",
    seconds: 15,
    category: "redirect"
  },
  {
    id: "pad_stand_move",
    title: "Stand & Move",
    instruction: "Stand up. Leave your phone where it is. Walk to another room.",
    seconds: 20,
    category: "friction"
  },
  {
    id: "pad_arm_circles",
    title: "Arm Circles",
    instruction: "20 arm circles. Big movements. This breaks the freeze.",
    seconds: 20,
    category: "grounding"
  },
  {
    id: "pad_delay_win",
    title: "Delay Win",
    instruction: "Say out loud: 'Delay is the win.' You just bought time.",
    seconds: 10,
    category: "stabilize"
  }
];
```

#### Low-Intensity Pad Steps (6 options)

```typescript
const LOW_INTENSITY_PAD_STEPS = [
  {
    id: "pad_write_trigger",
    title: "Write Trigger",
    instruction: "Open notes. Write one sentence: what triggered this urge?",
    seconds: 30,
    category: "interrupt"
  },
  {
    id: "pad_prevention_plan",
    title: "Prevention Plan",
    instruction: "What is one thing you can change in your environment to make this harder next time?",
    seconds: 30,
    category: "friction"
  },
  {
    id: "pad_body_scan",
    title: "Body Scan",
    instruction: "Close eyes. Notice tension in your jaw, shoulders, chest. Breathe into those spots.",
    seconds: 30,
    category: "grounding"
  },
  {
    id: "pad_urge_label",
    title: "Name the Loop",
    instruction: "Say the pattern out loud: 'This is the peeking loop' or 'This is escalation mode.'",
    seconds: 15,
    category: "interrupt"
  },
  {
    id: "pad_text_someone",
    title: "Text Someone",
    instruction: "Text one person right now. Just check in. You don't have to say you're struggling.",
    seconds: 30,
    category: "redirect"
  },
  {
    id: "pad_next_action",
    title: "Lock Next Action",
    instruction: "What is one thing you will do in the next 5 minutes? Name it.",
    seconds: 20,
    category: "stabilize"
  }
];
```

### Therapeutic Rationale

#### Why Intensity Matters

The protocol system uses three radically different therapeutic approaches based on urge intensity:

**Low Intensity (1-3): Awareness & Prevention**
- Goal: Build awareness, prevent escalation before it starts
- Approach: Reflective, planning-oriented, longer contemplative steps
- Example: "Write down what triggered this urge. What happened 5 minutes before?"
- Tone: Calm, exploratory, educational

**Medium Intensity (4-6): Interrupt & Delay**
- Goal: Interrupt the pattern, delay the next action
- Approach: Mix of grounding + cognitive interrupt + small behavior changes
- Example: "Stand up. Put phone down. Do 10 arm circles. That's the peek impulse talking."
- Tone: Direct, supportive, action-oriented

**High Intensity (7-10): Containment & Damage Control**
- Goal: Survival mode—stop the next 2 minutes from becoming worse
- Approach: Immediate physical commands, environment changes, firm directives
- Example: "Sit up. Feet on floor. Now. Stand up. Leave phone on bed. Walk to kitchen."
- Tone: Firm, authoritative, no-nonsense
- Key Framing: "Delay is the win." "Even a pause weakens the loop."

#### Why Context Matters

**Bed (Highest Risk)**
- First step MUST be: sit up, feet on floor (break lying position immediately)
- Friction = stand up, leave bedroom, change lighting
- No exercises done lying down

**Out (Public/Social)**
- Discreet steps only (nothing that draws attention)
- Favor: walk faster, change direction, enter a store, count objects, text someone
- Phone stays in pocket between steps if possible

**Home**
- Move rooms, change lighting, splash water on face
- Stand near window or go outside briefly
- Kitchen friction: get water, hold ice cube

#### Why Porn-Specific Language Matters

Every protocol MUST include at least one porn-loop reference:
- "peeking"
- "fantasy spiral"
- "escalation"
- "autopilot"
- "just one more"
- "tab-switch trance"
- "second session"

This language is credible to addicts. It shows the coach understands the specific patterns of compulsive porn use, not just generic "urge management."

#### Why Breathing Rules Are Strict at High Intensity

At intensity ≥7:
- NO breathing longer than 15 seconds
- NO breath holds
- Breathing MUST be paired with movement (never standalone)

**Rationale:** At high intensity, the user is in crisis mode. Long breathing exercises can become rumination or give the brain space to justify acting out. Movement interrupts the autopilot pattern more effectively.

#### Why Redirects Must Be Concrete

**Bad:** "Think of an activity you enjoy" / "Reflect on how you feel" / "Plan your next healthy step"

**Good:** "Count 5 red objects in the room" / "Splash cold water on your wrists" / "Do 10 jumping jacks" / "Text one person right now"

**Rationale:** Abstract redirects are too hard to execute during an urge. Concrete, physical, time-boxed actions give the brain a specific target and interrupt the fantasy loop.

#### Why Close Messages Matter

**Banned:** "You did well" / "You are doing great" / "Good job"

**Required:** "You bought time. That counts." / "Even a pause weakens the loop." / "If the urge dropped 1 notch, you succeeded." / "The urge had a moment. You did not give it the hour."

**Rationale:** Generic praise feels hollow to addicts who know they're still struggling. Credible close messages acknowledge the reality ("you bought time") and reframe success as delay, not perfection.

### Fallback Behavior

If AI generation fails, returns intensity-appropriate hardcoded protocol:
- **High Intensity:** Immediate physical commands (sit up, stand, walk), cold water, wall push-ups
- **Medium Intensity:** Mix of grounding + cognitive interrupt + behavior change
- **Low Intensity:** Reflective steps with prevention planning

---

## Severity Context Framework

All Coach AI prompts use a shared severity context framework that adapts tone, focus areas, and therapeutic approach based on the user's severity level.

### Severity Levels

```typescript
const SEVERITY_CONTEXT = {
  occasional: {
    label: "Occasional Use",
    focus_areas: ["awareness", "prevention", "identity"],
    avoid: ["crisis language", "shame", "extreme interventions"],
    tone: "calm, educational, empowering",
    key_actions: ["build awareness", "strengthen non-porn identity", "prevent drift"],
    relief_sources: ["physical activity", "social connection", "creative outlets"]
  },
  
  growing: {
    label: "Growing Concern",
    focus_areas: ["interruption", "reduction", "environment"],
    avoid: ["minimizing", "overly clinical language"],
    tone: "direct, practical, hopeful",
    key_actions: ["interrupt patterns", "reduce frequency", "control environment"],
    relief_sources: ["physical grounding", "immediate distractions", "access control"]
  },
  
  compulsive: {
    label: "Compulsive Pattern",
    focus_areas: ["containment", "harm reduction", "resilience"],
    avoid: ["perfection", "all-or-nothing thinking", "willpower-only approaches"],
    tone: "firm, non-shaming, tool-focused",
    key_actions: ["contain binges", "reduce duration", "build resilience"],
    relief_sources: ["Support Now protocols", "environmental friction", "immediate support calls"]
  },
  
  overwhelming: {
    label: "Overwhelming Struggle",
    focus_areas: ["safety", "simplicity", "immediate support"],
    avoid: ["complex plans", "long-term goals", "multi-step interventions"],
    tone: "calming, stabilizing, one-day-at-a-time",
    key_actions: ["ensure safety", "simplify plan", "connect to support"],
    relief_sources: ["crisis protocols", "immediate human contact", "professional resources"]
  }
};
```

### How Severity Context Is Used

**Goal Generation:**
- **Occasional:** Goals focus on building awareness and strengthening identity
- **Growing:** Goals focus on interrupting patterns and controlling environment
- **Compulsive:** Goals focus on containment and harm reduction (tools > willpower)
- **Overwhelming:** Goals focus on immediate safety and simplifying the plan

**Action Generation:**
- **Occasional:** Actions are reflective (name trigger, write it down)
- **Growing:** Actions mix awareness + small behavior changes
- **Compulsive:** Actions are immediate relief tools (Support Now protocol, 60-second reset)
- **Overwhelming:** Actions are simplest possible (text someone, use crisis protocol)

**Insight Generation:**
- **Occasional:** Insights highlight prevention opportunities
- **Growing:** Insights highlight pattern interruption points
- **Compulsive:** Insights highlight containment strategies
- **Overwhelming:** Insights highlight stabilization needs

**Protocol Generation:**
- Severity doesn't directly impact protocol generation (intensity does)
- But severity influences the user's starting state and typical intensity levels

---

## Testing

### Protocol Test Viewer

Interactive HTML test viewer at: `/public/test-urge-support-viewer.html`

**Features:**
- Single test mode (pick intensity + context + duration)
- Run all 23 tests mode (exhaustive coverage)
- Duration validation display (✅ if in range, ⚠️ if out of range)
- Color-coded category badges
- Coach persona display
- Stats: total tests, avg steps, avg duration

**23 Test Scenarios:**
1. Intensity 1-10 × bed/home/out × 2min/5min
2. Edge cases: null intensity, null context, max intensity + bed

**Usage:**
```bash
# Open in browser
open web/public/test-urge-support-viewer.html

# Or run via local server
cd web
npm run dev
# Navigate to /test-urge-support-viewer.html
```

---

## Token Management

All Coach AI endpoints deduct tokens from user's balance and log usage:

```typescript
// 1. Check token balance
const { data: user } = await supabase
  .from('users')
  .select('coach_ai_tokens_remaining')
  .eq('id', userId)
  .single();

if (user.coach_ai_tokens_remaining < TOKEN_COST) {
  return res.status(403).json({ error: 'Insufficient tokens' });
}

// 2. Generate content via Coach AI
const result = await generateStructuredOutput(...);

// 3. Deduct tokens
await supabase
  .from('users')
  .update({ 
    coach_ai_tokens_remaining: user.coach_ai_tokens_remaining - TOKEN_COST 
  })
  .eq('id', userId);

// 4. Log usage
await supabase
  .from('coach_ai_usage')
  .insert({
    user_id: userId,
    feature: 'goal_generation', // or action_generation, insights, urge_support
    tokens_used: TOKEN_COST,
    success: true
  });
```

---

## Error Handling

All endpoints follow this error handling pattern:

```typescript
try {
  // 1. Validate request
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  // 2. Check token balance
  if (tokens < COST) {
    return res.status(403).json({ error: 'Insufficient tokens' });
  }
  
  // 3. Try AI generation
  const result = await generateStructuredOutput(...);
  
  // 4. If AI fails, use fallback
  if (!result || !result.goals) {
    console.warn('AI generation failed, using fallback');
    return res.status(200).json(getFallbackGoals(severity));
  }
  
  // 5. Return success
  return res.status(200).json(result);
  
} catch (error) {
  console.error('Error in goal generation:', error);
  
  // Return fallback on any error
  return res.status(200).json(getFallbackGoals(severity));
}
```

**Key Points:**
- Never return 500 errors to user (use fallbacks instead)
- Always log errors for debugging
- Fallbacks are severity-appropriate and therapeutic
- Token deduction only happens on successful AI generation

---

## Future Improvements

**Short-term:**
- [ ] Add caching for similar protocol requests (reduce token costs)
- [ ] A/B test different close messages for effectiveness
- [ ] Track which pad steps are most used (optimize pad pool)
- [ ] Add "protocol variations" (multiple options for same inputs)

**Medium-term:**
- [ ] Fine-tune custom model for protocol generation (lower costs, better quality)
- [ ] Add user feedback loop (thumbs up/down on protocols)
- [ ] Generate "protocol chains" (what to do if first protocol doesn't work)
- [ ] Add voice mode for protocol delivery (audio instructions)

**Long-term:**
- [ ] Personalized protocol generation based on user history
- [ ] Multi-language protocol support
- [ ] Integration with wearables (trigger protocols based on heart rate)
- [ ] Collaborative protocols (involving accountability partners)

---

## Maintenance Notes

**When updating prompts:**
1. Test exhaustively with the HTML viewer (all 23 scenarios)
2. Check duration validation (protocols must render in 90-120s or 240-300s)
3. Verify porn-specific language appears in every protocol
4. Test all severity levels (occasional/growing/compulsive/overwhelming)
5. Check fallback behavior (disconnect network, test with invalid tokens)

**When changing models:**
1. Update model name in endpoint file
2. Test token costs (may need to adjust TOKEN_COST constants)
3. Verify schema validation still works (different models may format differently)
4. Run full test suite to ensure quality doesn't degrade

**When adding new features:**
1. Follow the existing pattern: context → prompt → generate → validate → fallback
2. Add Zod schema for response validation
3. Implement fallback mechanism
4. Add token cost constant
5. Log usage in coach_ai_usage table
6. Add documentation to this README

---

## Contact

For questions or issues with Coach AI system, contact the development team.

**Last Updated:** January 2025
