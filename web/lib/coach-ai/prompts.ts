/**
 * Coach AI Prompt Templates
 * Separate from chat - these are for structured goal/action/insight generation
 */

import { GoalArchetype, ActionCategory } from './archetypes';

export interface UserContext {
  firstName?: string;
  challengeId: string;
  challengeLabel: string;
  severity: 'occasional' | 'growing' | 'compulsive' | 'overwhelming';
  timeframeDays: number;
  signals?: {
    frequency_days_active?: number;
    binge_count?: number;
    impact_level?: number;
    loss_of_control?: number;
    craving_intensity?: number;
  };
  completionRate?: number; // 0-100
  recentSlips?: number;
}

export interface GoalContext extends UserContext {
  existingGoals?: Array<{ label: string; goal_id: string; archetype?: string }>;
  allowedArchetypes?: GoalArchetype[];
  userMetricsCompact?: string;
  seedGoalTitle?: string;
  seedGoalDescription?: string;
}

export interface ActionContext extends UserContext {
  goalLabel: string;
  goalDescription: string;
  goalId?: string;
  goalType?: 'track' | 'wellness';
  goalArchetype?: GoalArchetype;
  // Recovery metrics
  last30DaysSlips?: number;
  secondSessionRate?: number;
  recentSlipToday?: boolean;
  currentStreak?: number;
  commonRiskWindow?: string;
  topTrigger?: string;
  existingActionTitles?: string[];
  allowedCategories?: ActionCategory[];
  userMetricsCompact?: string;
  seedActionText?: string;
}

export interface InsightContext extends UserContext {
  last7DaysActions?: number;
  last7DaysCompletions?: number;
  riskWindowData?: { hour: number; count: number }[];
  bestTools?: string[];
}

/**
 * PORN RECOVERY SYSTEM PROMPT
 * Used for both goal and action generation for porn recovery
 */
export const PORN_RECOVERY_SYSTEM_PROMPT = `You are AskMe AI's Porn Recovery Coach — a specialist in pornography addiction behavior change.
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
- No markdown. No commentary. No extra keys.`;

/**
 * SEVERITY CONTEXT SNIPPETS
 */
const SEVERITY_CONTEXT = {
  occasional: `
User severity: OCCASIONAL ("It shows up sometimes")
- Focus: awareness, prevention, early boundaries
- Avoid: lockdown language, crisis framing
- Tone: supportive exploration, building identity
- Key actions: Track patterns, practice pause, build competing habits, identify triggers
- Relief comes from: Understanding what's happening, feeling in control, building self-trust
`,
  growing: `
User severity: GROWING ("It's becoming a pattern")
- Focus: habit interruption, frequency reduction, environmental control
- Avoid: shame language, perfectionism
- Tone: practical, harm reduction, pattern breaking
- Key actions: Environmental friction, urge surfing, replace late-night routines, accountability
- Relief comes from: Breaking the automatic loop, reducing frequency, winning risk windows
- CRITICAL: Actions must provide immediate dopamine alternatives and urge de-escalation
`,
  compulsive: `
User severity: COMPULSIVE ("I often struggle to stop")
- Focus: containment, stopping binges, resilience building
- Avoid: willpower-only solutions
- Tone: compassionate realism, tools > willpower
- Key actions: Access barriers, binge stoppers, shame repair, daily recovery reps, baseline care
- Relief comes from: Stopping spirals fast, reducing harm, building streak confidence
- CRITICAL: Focus on harm reduction (stop at 1 vs 5 sessions), rapid shame repair, self-compassion
`,
  overwhelming: `
User severity: OVERWHELMING ("It feels out of control")
- Focus: immediate safety, crisis support, simplification
- Avoid: complex plans, long-term goals
- Tone: calming, stabilizing, one-day-at-a-time
- Key actions: Emergency protocols, environment shifts, immediate support access, grounding techniques
- Relief comes from: Feeling less alone, having a clear next step, getting through the next hour
- CRITICAL: Actions must be extremely simple, provide immediate safety/support, reduce panic
`
};

/**
 * GOAL GENERATION PROMPT
 */
export function buildGoalPrompt(context: GoalContext): string {
  const { severity, existingGoals, allowedArchetypes, userMetricsCompact, seedGoalTitle, seedGoalDescription } = context;

  // Build existing goals text with archetypes
  const existingText = existingGoals && existingGoals.length > 0
    ? existingGoals.map(g => `- ${g.label}${g.archetype ? ` (${g.archetype})` : ''}`).join('\n')
    : 'None';

  // Archetype list
  const archetypesList = allowedArchetypes && allowedArchetypes.length > 0
    ? allowedArchetypes.join(', ')
    : 'POST_SLIP_CONTAINMENT, BEDTIME_RISK_WINDOW, ACCESS_PATHWAY_BLOCK';

  // Build seed intent section
  const hasSeed = seedGoalTitle || seedGoalDescription;
  const seedSection = hasSeed ? `
USER INTENT SEED (MANDATORY ALIGNMENT):
The user typed: "${seedGoalTitle || ''}"
${seedGoalDescription ? `Description: "${seedGoalDescription}"` : ''}

CRITICAL SEED ALIGNMENT RULES:
- ALL 3 generated goals MUST be semantically aligned to this seed intent.
- Each goal should be a close variant of what the user typed.
- Do NOT generate generic goals unless the seed is explicitly generic.
- Do NOT include breathing/grounding actions unless the seed is about calming/grounding.
- If you cannot align to the seed while respecting severity + archetypes, explain why and propose closest alternatives.
- Examples:
  * Seed: "abstain from porn 30 days" → Generate abstinence/containment goals (e.g., "Zero sessions for 30 days", "Block access for 30-day trial")
  * Seed: "no second session after slip" → Generate post-slip containment goals (e.g., "Close loop after slip in 60s", "One session max per day")
  * Seed: "exercise daily" → Generate movement/replacement goals, NOT generic wellness
` : '';

  return `Generate exactly 3 porn recovery goals for this user.

USER_METRICS (compact JSON):
${userMetricsCompact || '{}'}

SEVERITY: ${severity}

EXISTING_GOALS (do not repeat or paraphrase):
${existingText}

ALLOWED_GOAL_ARCHETYPES (must use 3 DIFFERENT archetypes, one each):
${archetypesList}
${seedSection}
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
  "severity": "${severity}",
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
}`;
}

/**
 * ACTION GENERATION PROMPT
 * Porn recovery gets archetype-gated action generation
 */
export function buildActionPrompt(context: ActionContext): string {
  const { 
    severity, 
    goalLabel, 
    goalArchetype,
    userMetricsCompact, 
    existingActionTitles,
    allowedCategories,
    seedActionText
  } = context;

  // Split active vs library actions
  const activeActions = existingActionTitles?.slice(0, 3) || [];
  const libraryActions = existingActionTitles?.slice(3) || [];
  
  const activeText = activeActions.length > 0
    ? activeActions.map(t => `- "${t}"`).join('\n')
    : 'None';
  
  const libraryText = libraryActions.length > 0
    ? libraryActions.map(t => `- "${t}"`).join('\n')
    : 'None';

  const categoriesList = allowedCategories && allowedCategories.length > 0
    ? allowedCategories.join(', ')
    : 'ANTI_BINGE_LOCK, SHAME_REPAIR, DEVICE_FRICTION';

  // Build seed intent section
  const hasSeed = seedActionText && seedActionText.trim().length > 0;
  const seedSection = hasSeed ? `
USER INTENT SEED (MANDATORY ALIGNMENT):
The user typed: "${seedActionText}"

CRITICAL SEED ALIGNMENT RULES:
- ALL 3 generated actions MUST be semantically aligned to this seed intent.
- Each action should be a close variant of what the user typed.
- Do NOT generate generic actions ("breathe", "drink water", "leave room") unless the seed explicitly calls for them.
- If the seed is about physical activity (e.g., "cardio", "exercise", "walk"), ALL 3 actions must be movement-based variants.
- If the seed is about device management, ALL 3 actions must be device/access control variants.
- If you cannot align to the seed while respecting the goal archetype + categories, explain why and propose closest alternatives.
- Examples:
  * Seed: "do cardio for few minutes" → Generate: "Walk outside 15 min", "Easy jog 10 min", "Stairs/pace indoors 8 min"
  * Seed: "block social media at night" → Generate device friction actions targeting social media
  * Seed: "text accountability partner" → Generate accountability ping variants
  ❌ FORBIDDEN: If seed is "cardio" → Do NOT output "take deep breaths" or "drink water"
` : '';

  return `Generate exactly 3 actions for the goal below. The goal is for pornography addiction recovery.

USER_METRICS (compact JSON):
${userMetricsCompact || '{}'}

SEVERITY: ${severity}

GOAL:
{
  "label": "${goalLabel}",
  "archetype": "${goalArchetype || 'ACCOUNTABILITY_BUILD'}"
}
${seedSection}
EXISTING ACTIONS (do not repeat or paraphrase)
ACTIVE_ACTIONS_FOR_GOAL:
${activeText}

LIBRARY_ACTIONS_FOR_GOAL:
${libraryText}

ALLOWED_ACTION_CATEGORIES (must output exactly one per category, in any order):
${categoriesList}

ARCHETYPE GATING (mandatory)
- POST_SLIP_CONTAINMENT must include:
  (1) ANTI_BINGE_LOCK action (close loop + prevent "second session")
  (2) SHAME_REPAIR or RECOVERY_REPAIR action (break justification spiral)
  (3) DEVICE_FRICTION or ACCOUNTABILITY_PING action (prevent easy relapse)
  
- BEDTIME_RISK_WINDOW must include:
  (1) DEVICE_FRICTION tailored to the risk window
  (2) TIME_PROTOCOL
  (3) ENVIRONMENT_SHIFT compatible with staying in-app
  
- ACCESS_PATHWAY_BLOCK must include:
  (1) friction targeting the actual pathway (apps/search/incognito)
  (2) a "replacement default" for risk window (what to do instead)
  (3) accountability or logging action

ANTI-GENERIC RULES (hard bans)
- No "turn off phone", "close device", "stop using your phone".
- No vague actions like "be mindful", "take a walk", "distract yourself" unless you specify when/how/for how long and what success looks like.
- Every action must have a concrete trigger condition ("When X happens…") and success definition.

RETURN STRICT JSON ONLY:
{
  "challenge": "porn",
  "goal_label": "${goalLabel}",
  "goal_archetype": "${goalArchetype || 'ACCOUNTABILITY_BUILD'}",
  "actions": [
    {
      "title": "under 70 chars",
      "category": "ONE OF: DEVICE_FRICTION | ENVIRONMENT_SHIFT | ACCOUNTABILITY_PING | TIME_PROTOCOL | ANTI_BINGE_LOCK | RECOVERY_REPAIR | SHAME_REPAIR | URGE_INTERRUPT",
      "duration_minutes": 1-10,
      "difficulty": "easy|medium",
      "trigger_condition": "1 sentence: when to do this",
      "success_criteria": "1 sentence measurable",
      "mechanism_type": "ONE OF: friction | accountability | grounding | interrupt | replacement | environmental_control | shame_repair | state_change",
      "when_to_do": "short trigger statement",
      "ai_note": "2-3 sentences: what to do + why it works + common failure mode fix"
    }
  ]
}`;
}

/**
 * LEGACY: Kept for backwards compatibility but will be replaced
 */
function buildPornRecoveryActionPrompt(
  context: ActionContext, 
  severityGuide: string, 
  userMetrics: string, 
  existingActionsText: string
): string {
  const { severity, goalLabel, goalDescription } = context;

  // Severity-specific action strategy
  const SEVERITY_ACTION_STRATEGY: Record<string, string> = {
    occasional: `ACTION STRATEGY FOR OCCASIONAL:
- Focus: awareness tools, pattern logging, trigger identification, pause practice
- Actions should build self-awareness and catch the autopilot early
- Include: trigger journaling, urge rating scales, pattern identification
- Avoid: heavy lockdown language, crisis framing
- Mechanism bias: grounding, interrupt, replacement`,

    growing: `ACTION STRATEGY FOR GROWING:
- Focus: delay + friction, habit interruption, environmental control, urge de-escalation
- Actions must provide immediate dopamine alternatives
- Include: phone displacement, room changes, competing habit activation, timed delays
- CRITICAL: Actions should interrupt the automatic loop, not just observe it
- Mechanism bias: friction, environmental_control, interrupt, replacement`,

    compulsive: `ACTION STRATEGY FOR COMPULSIVE:
- Focus: hard environment lockdown, binge stopping, shame repair, rapid reset
- Actions must assume willpower is LOW — rely on environmental design instead
- Include: access barriers, device restrictions, accountability texts, shame-reset scripts
- CRITICAL: Focus on "stop at 1 not 5" — the second session is the enemy
- Treat every slip as a fire to contain, not a moral failure to process
- Mechanism bias: friction, accountability, environmental_control, shame_repair`,

    overwhelming: `ACTION STRATEGY FOR OVERWHELMING:
- Focus: immediate safety, crisis containment, extreme simplicity
- Actions must be doable in a panic state — ONE step, ZERO thinking required
- Include: emergency protocols, speed-dial contacts, physical state changes
- CRITICAL: Do not give options. Give commands. "Stand up. Leave room. Now."
- Everything must be completable when brain is hijacked
- Mechanism bias: state_change, grounding, accountability`
  };

  return `You are a specialized recovery intervention designer for pornography addiction.

Your job is NOT to give generic wellness advice.
You generate highly practical, behaviorally effective micro-actions that interrupt addiction loops.

${severityGuide}

${SEVERITY_ACTION_STRATEGY[severity] || SEVERITY_ACTION_STRATEGY.growing}

USER SUMMARY:
  ${userMetrics}

GOAL: "${goalLabel}"
${goalDescription ? `Description: "${goalDescription}"` : ''}
${existingActionsText}

CRITICAL RULES:
1. You MUST condition every suggestion on the severity level above.
2. Consider whether this is pre-slip or post-slip context based on the goal name.
3. Use friction, environmental control, accountability, and movement strategically.
4. NEVER suggest generic breathing-only solutions unless severity is occasional AND intensity is 1-2.
5. Make actions concrete, observable, and measurable.
6. Each action MUST include an ai_note explaining WHY it works neurologically or behaviorally (max 3 sentences).
7. Do NOT produce motivational fluff, vague actions, or repeat generic grounding.
8. Prefer environmental shifts and accountability for compulsive/overwhelming levels.
9. Do NOT repeat any action already assigned to this goal.
10. Actions must be 1-5 minutes. Recovery happens in micro-moments.

WHAT MAKES A QUALITY ACTION:
✅ "Close browser and physically change rooms immediately" (friction + state change)
✅ "Send 1-line accountability text within 2 min of slip" (accountability + secrecy break)
✅ "Activate high-risk mode: blocker on, private browsing off, device in shared room" (environmental control)
✅ "60-second shame reset: write 'I'm human, I'm trying' and read aloud" (shame repair)
✅ "Phone to kitchen counter before 10pm every night" (preemptive friction)

❌ "Take 3 deep breaths" (too generic, doesn't interrupt addiction loop)
❌ "Drink water" (irrelevant to recovery mechanism)
❌ "Think positive thoughts" (motivational fluff)
❌ "Practice mindfulness" (too vague, no measurable outcome)

TASK: Generate EXACTLY 3 recovery-grade micro-actions for the goal "${goalLabel}".

Each action must include:
- title: specific action verb + object (concrete, observable)
- duration_minutes: realistic (1-5)
- difficulty: easy or medium
- category: one of [friction, accountability, grounding, interrupt, replacement, environment, urge, mindset, connection, movement]
- trigger_condition: WHEN exactly to do this (e.g., "immediately after a slip", "when urge exceeds 6/10", "before entering risk window")
- success_criteria: exactly what "done" means — observable, measurable
- mechanism_type: one of [friction, accountability, grounding, interrupt, replacement, environmental_control, shame_repair, state_change]
- when_to_do: timing tied to addiction patterns
- ai_note: 2-3 sentences explaining WHY this works neurologically or behaviorally. Reference dopamine, shame loops, escalation mechanics, or friction design. This builds trust.

OUTPUT FORMAT (strict JSON):
{
  "goal_id": "${context.goalId}",
  "actions": [
    {
      "title": "specific observable action",
      "duration_minutes": 2,
      "difficulty": "easy",
      "category": "friction",
      "trigger_condition": "when exactly to do this",
      "success_criteria": "what done looks like",
      "mechanism_type": "friction",
      "when_to_do": "timing pattern",
      "ai_note": "2-3 sentences on why this works neurologically/behaviorally"
    }
  ]
}

Return ONLY JSON, no markdown, no commentary.`;
}

/**
 * WELLNESS ACTION PROMPT — for non-addiction goals (journaling, exercise, etc.)
 */
function buildWellnessActionPrompt(
  context: ActionContext, 
  severityGuide: string, 
  userMetrics: string, 
  existingActionsText: string
): string {
  const { goalLabel, goalDescription } = context;

  return `You are a recovery coach AI generating supportive micro-actions for wellness goals.

${severityGuide}

User context:
  ${userMetrics}

Goal: "${goalLabel}"
${goalDescription ? `Description: "${goalDescription}"` : ''}
${existingActionsText}

TASK: Generate EXACTLY 3 practical micro-actions (1-5 minutes each) that support this wellness goal.

REQUIREMENTS:
1. Each action must be concrete, specific, and completable in 1-5 minutes
2. Actions should support recovery by building healthy habits and structure
3. Include clear trigger conditions (when to do this)
4. Include measurable success criteria
5. Include an ai_note explaining the behavioral science behind why this helps recovery
6. Do NOT repeat any action already assigned to this goal
7. Actions should feel doable and provide quick wins

Each action must include:
- title: specific action verb + object
- duration_minutes: realistic (1-5)
- difficulty: easy or medium
- category: one of [friction, accountability, grounding, interrupt, replacement, environment, urge, mindset, connection, movement]
- trigger_condition: when exactly to do this
- success_criteria: what done means — observable
- mechanism_type: one of [friction, accountability, grounding, interrupt, replacement, environmental_control, shame_repair, state_change]
- when_to_do: timing suggestion
- ai_note: 2-3 sentences on why this helps behaviorally

OUTPUT FORMAT (strict JSON):
{
  "goal_id": "${context.goalId}",
  "actions": [
    {
      "title": "specific action",
      "duration_minutes": 2,
      "difficulty": "easy",
      "category": "mindset",
      "trigger_condition": "when to do this",
      "success_criteria": "what done means",
      "mechanism_type": "replacement",
      "when_to_do": "timing",
      "ai_note": "why this works"
    }
  ]
}

Return ONLY JSON, no markdown, no commentary.`;
}

/**
 * INSIGHTS GENERATION PROMPT
 */
export function buildInsightPrompt(context: InsightContext): string {
  const { firstName, challengeLabel, severity, last7DaysActions, last7DaysCompletions, riskWindowData, bestTools } = context;

  const severityGuide = SEVERITY_CONTEXT[severity];
  
  const activityText = last7DaysActions !== undefined
    ? `Last 7 days: ${last7DaysCompletions} completions out of ${last7DaysActions} actions (${Math.round((last7DaysCompletions! / last7DaysActions!) * 100)}% rate)`
    : 'Insufficient activity data for last 7 days.';

  const riskWindowText = riskWindowData && riskWindowData.length > 0
    ? `Risk pattern: High activity at hours ${riskWindowData.map(d => d.hour).join(', ')}`
    : 'No clear risk window identified yet.';

  const toolsText = bestTools && bestTools.length > 0
    ? `Tools used: ${bestTools.join(', ')}`
    : 'Limited tool usage data.';

  return `You are a recovery coach AI generating weekly insights and next-week planning.

${severityGuide}

User context:
- Name: ${firstName || 'User'}
- Challenge: ${challengeLabel}
- ${activityText}
- ${riskWindowText}
- ${toolsText}

TASK: Generate insights from last 7 days + next week plan.

REQUIREMENTS:
1. Insights must be data-driven (if data is sparse, acknowledge it)
2. Do NOT hallucinate specific numbers or patterns
3. "risk_window" = time range with highest struggle (or "not enough data")
4. "best_tool" = which action type worked most
5. "best_lever" = highest impact category (environment, connection, etc.)
6. Next week plan: exactly 2 items each for keep/change/try

OUTPUT FORMAT (strict JSON):
{
  "challenge_id": "${context.challengeId}",
  "timeframe_days": 7,
  "insights": {
    "risk_window": "e.g. 10:30pm–12:30am or 'not enough data'",
    "best_tool": "most completed action type or 'still learning'",
    "best_lever": "category with best results or 'environment' as default"
  },
  "next_week_plan": {
    "keep": ["item 1", "item 2"],
    "change": ["item 1", "item 2"],
    "try": ["item 1", "item 2"]
  }
}

Return ONLY JSON.`;
}

/**
 * BUILD COMPACT INSIGHT PROMPT (for detailed report with metrics)
 * Accepts comprehensive metrics object and returns structured insights
 */
export function buildCompactInsightPrompt(
  metrics: any,
  compareMetrics?: any,
  firstName?: string
): string {
  const hasEnoughData = metrics.meta?.has_enough_data;
  const completions = metrics.meta?.sample_sizes?.completions || 0;
  const riskWindow = metrics.risk_window?.label || null;
  const bestTool = metrics.tools?.best_categories?.[0];
  const avgDrop = metrics.urge?.avg_drop;
  const completionRate = metrics.activity?.completion_rate;

  const metricsJson = JSON.stringify({
    range: metrics.range,
    activity: metrics.activity,
    urge: metrics.urge,
    risk_window: metrics.risk_window,
    tools: metrics.tools,
    slips: metrics.slips,
    sample_sizes: metrics.meta.sample_sizes
  }, null, 2);

  let compareSection = '';
  if (compareMetrics) {
    compareSection = `
COMPARISON DATA:
Previous period metrics:
${JSON.stringify({
  activity: compareMetrics.activity,
  urge: compareMetrics.urge,
  slips: compareMetrics.slips
}, null, 2)}

Compute delta and provide "What changed" summary.`;
  }

  return `You are a porn addiction recovery analyst. Generate data-driven insights from the provided METRICS.

USER: ${firstName || 'User'}

METRICS (current period):
${metricsJson}
${compareSection}

RULES:
1. If sample_sizes.completions < 3: "risk_window" = "not enough data", "best_tool" = "still learning"
2. Use ONLY the provided data. Do NOT guess or hallucinate.
3. Risk window: use risk_window.label if available, else "not enough data"
4. Best tool: use tools.best_categories[0].category + tools.best_categories[0].why
5. Best lever: Choose from: Device Friction, Environment Shift, Accountability, Time Protocol
6. Insights: 3-7 bullets, each under 80 chars, data-specific (e.g., "10:30pm–12:30am shows 67% of high-urge activity")
7. Next experiment: Specific, testable, based on gaps in data (e.g., "Try morning accountability texts if risk window is evening")

OUTPUT (strict JSON, under 1200 total chars):
{
  "risk_window": "string or 'not enough data'",
  "best_tool": "string or 'still learning'",
  "best_lever": "Device Friction | Environment Shift | Accountability | Time Protocol",
  "insights": ["...", "...", "..."],
  "next_experiment": {
    "title": "...",
    "why": "...",
    "steps": ["...", "..."]
  }${compareMetrics ? ',\n  "compare_summary": "1-2 sentence delta summary"' : ''}
}

Return ONLY JSON. Keep total response under 1200 chars.`;
}

/**
 * BUILD URGE PROTOCOL PROMPT (Support Now)
 */
export interface ProtocolContext {
  track: 'porn' | 'sex' | 'food';
  durationMinutes: 2 | 5;
  intensity?: number; // 1-10;
  context?: 'home' | 'out' | 'bed';
}

export function buildProtocolPrompt(context: ProtocolContext): string {
  const { track, durationMinutes, intensity, context: location } = context;

  const lowerBound = durationMinutes === 2 ? 90 : 240;
  const upperBound = durationMinutes === 2 ? 120 : 300;
  const stepCountMin = durationMinutes === 2 ? 3 : 5;
  const stepCountMax = durationMinutes === 2 ? 5 : 8;

  // Intensity-specific composition rules
  let intensityBlock = '';
  if (intensity && intensity >= 7) {
    intensityBlock = `
INTENSITY ${intensity}/10 — CONTAINMENT MODE:
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
- Tone: firm, directive, authoritative. "Do this now." Not "consider trying."`;
  } else if (intensity && intensity >= 4) {
    intensityBlock = `
INTENSITY ${intensity}/10 — INTERRUPT & DELAY:
- Mix grounding + cognitive interrupt + small behavior change.
- Include urge labeling with porn-specific language ("That is the peek impulse." "This is escalation mode.")
- Breathing OK but max 20 seconds and paired with a physical anchor.
- Friction should involve body position change, not just phone orientation.
- Redirect must be concrete and time-boxed: "do X for 30 seconds" not "think about something else."`;
  } else {
    intensityBlock = `
INTENSITY ${intensity || 'unknown'}/10 — AWARENESS & PREVENTION:
- Reflective and planning-oriented. Longer contemplative steps OK.
- Still include at least one porn-specific reference ("notice the pull toward peeking," "the autopilot pattern").
- Include a preventive friction step (move phone charger, change evening routine, set a timer).
- Redirect can be cognitive but must still be specific: "write down what triggered this" not "reflect on your feelings."`;
  }

  // Context rules
  let contextBlock = '';
  if (location === 'bed') {
    contextBlock = `\nCONTEXT: BED (highest risk)\n- Step 1 MUST be: sit up, feet on floor. Non-negotiable.\n- Move away from lying position immediately.\n- Friction = stand up, leave bedroom, change lighting.\n- No exercises done lying down.`;
  } else if (location === 'out') {
    contextBlock = `\nCONTEXT: OUT\n- Discreet steps only. Nothing that draws attention.\n- Favor: walk faster, change direction, enter a store, count objects, text someone.\n- Phone stays in pocket between steps if possible.`;
  } else if (location === 'home') {
    contextBlock = `\nCONTEXT: HOME\n- Move rooms. Change lighting. Splash water on face.\n- Stand near window or go outside briefly.\n- Kitchen friction: get water, hold ice cube.`;
  } else {
    contextBlock = `\nCONTEXT: UNKNOWN\n- Use environment-agnostic steps that work anywhere.\n- Default to standing + movement.`;
  }

  return `Generate a Support Now protocol for a user experiencing a porn urge RIGHT NOW.

Inputs:
- duration_minutes: ${durationMinutes}
- track: porn
- intensity_1_to_10: ${intensity || 'null'}
- context: ${location || 'null'}

DURATION CONTRACT (non-negotiable):
- Sum of all step.seconds MUST be between ${lowerBound} and ${upperBound}.
- Step count: ${stepCountMin}-${stepCountMax}.
- Each step.seconds: 15-60.
- BEFORE outputting, mentally add all step.seconds. If outside ${lowerBound}-${upperBound}, adjust.
${intensityBlock}
${contextBlock}

STEP COMPOSITION (required categories):
- At least 1 grounding step (physical anchor, not long breathing)
- At least 1 interrupt step (urge labeling with porn-specific language)
- At least 1 friction step (body/environment change)
- At least 1 redirect step (concrete, sensory, time-boxed)
- At least 1 stabilize step (lock in next action, delay framing)

JSON structure:
{
  "id": "support_now_${track}_${durationMinutes}m",
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

Return ONLY valid JSON. No markdown. No explanation.`;
}
