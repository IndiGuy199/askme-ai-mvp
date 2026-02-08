/**
 * Coach AI Prompt Templates
 * Separate from chat - these are for structured goal/action/insight generation
 */

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
  existingGoals?: Array<{ label: string; goal_id: string }>;
}

export interface ActionContext extends UserContext {
  goalLabel: string;
  goalDescription: string;
  goalId: string;
}

export interface InsightContext extends UserContext {
  last7DaysActions?: number;
  last7DaysCompletions?: number;
  riskWindowData?: { hour: number; count: number }[];
  bestTools?: string[];
}

/**
 * SEVERITY CONTEXT SNIPPETS
 */
const SEVERITY_CONTEXT = {
  occasional: `
User severity: OCCASIONAL ("It shows up sometimes")
- Focus: awareness, prevention, early boundaries
- Avoid: lockdown language, crisis framing
- Tone: supportive exploration, building identity
`,
  growing: `
User severity: GROWING ("It's becoming a pattern")
- Focus: habit interruption, frequency reduction, environmental control
- Avoid: shame language, perfectionism
- Tone: practical, harm reduction, pattern breaking
`,
  compulsive: `
User severity: COMPULSIVE ("I often struggle to stop")
- Focus: containment, stopping binges, resilience building
- Avoid: willpower-only solutions
- Tone: compassionate realism, tools > willpower
`,
  overwhelming: `
User severity: OVERWHELMING ("It feels out of control")
- Focus: immediate safety, crisis support, simplification
- Avoid: complex plans, long-term goals
- Tone: calming, stabilizing, one-day-at-a-time
`
};

/**
 * GOAL GENERATION PROMPT
 */
export function buildGoalPrompt(context: GoalContext): string {
  const { firstName, challengeLabel, severity, signals, completionRate, existingGoals } = context;

  const severityGuide = SEVERITY_CONTEXT[severity];
  const signalsText = signals 
    ? `Assessment signals: ${JSON.stringify(signals, null, 2)}`
    : 'No detailed signals available.';
  
  const completionText = completionRate !== undefined
    ? `Recent action completion rate: ${completionRate}%`
    : 'No completion data yet.';

  const existingText = existingGoals && existingGoals.length > 0
    ? `Current goals: ${existingGoals.map(g => g.label).join(', ')}`
    : 'No existing goals yet.';

  return `You are a recovery coach AI generating personalized wellness goals.

${severityGuide}

User context:
- Name: ${firstName || 'User'}
- Challenge: ${challengeLabel}
- ${signalsText}
- ${completionText}
- ${existingText}

TASK: Generate EXACTLY 3 practical, outcome-based recovery goals (you MUST return 3 goals, not 1 or 2).

REQUIREMENTS:
1. Each goal must have clear success criteria
2. Match severity level (no crisis goals for occasional, no abstract goals for overwhelming)
3. Be specific and measurable
4. Include a brief "why_this_now" personalized to the user's metrics
5. Duration should be realistic: 14 or 30 days
6. Goal types: "track" (behavior tracking) or "wellness" (skill building)
7. CRITICAL: Return EXACTLY 3 distinct goals with different approaches

OUTPUT FORMAT (strict JSON, no extra text):
{
  "challenge_id": "${context.challengeId}",
  "severity": "${severity}",
  "goals": [
    {
      "label": "short practical goal name",
      "description": "clear success criteria in 1-2 sentences",
      "goal_type": "track",
      "suggested_duration_days": 30,
      "why_this_now": "1 sentence tied to user's current state"
    }
  ]
}

Return ONLY the JSON object, no markdown, no explanations.`;
}

/**
 * ACTION GENERATION PROMPT
 */
export function buildActionPrompt(context: ActionContext): string {
  const { firstName, challengeLabel, severity, goalLabel, goalDescription, signals, completionRate } = context;

  const severityGuide = SEVERITY_CONTEXT[severity];
  const signalsText = signals 
    ? `User's current state: ${JSON.stringify(signals, null, 2)}`
    : 'Limited behavioral data available.';

  return `You are a recovery coach AI generating micro-actions for a specific goal.

${severityGuide}

User context:
- Name: ${firstName || 'User'}
- Challenge: ${challengeLabel}
- Goal: "${goalLabel}"
- Goal description: "${goalDescription}"
- ${signalsText}
- Recent completion rate: ${completionRate ?? 'unknown'}%

TASK: Generate EXACTLY 3 concrete micro-actions (2-5 minutes each) that support this goal (you MUST return 3 distinct actions).

REQUIREMENTS:
1. Each action must be completable in 2-5 minutes
2. Clear success criteria ("done" = what exactly?)
3. Categorize: environment, urge, mindset, connection, sleep, movement
4. Difficulty: easy or medium only
5. Include "when_to_do" suggestion (e.g., "before bed", "when urge hits", "morning")
6. "why_this" must tie back to user's severity and signals
7. CRITICAL: Return EXACTLY 3 different actions with varied categories

OUTPUT FORMAT (strict JSON):
{
  "goal_id": "${context.goalId}",
  "actions": [
    {
      "title": "specific action verb + object",
      "duration_minutes": 2,
      "difficulty": "easy",
      "category": "environment",
      "success_criteria": "exactly what done means",
      "when_to_do": "timing suggestion",
      "why_this": "1 sentence about why now"
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
