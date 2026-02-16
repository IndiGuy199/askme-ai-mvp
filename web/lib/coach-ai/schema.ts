/**
 * Zod schemas for validating Coach AI JSON responses
 */
import { z } from 'zod';

/**
 * GOAL SCHEMA - Updated for porn recovery archetype system
 */
export const CoachGoalSchema = z.object({
  label: z.string().min(5).max(100),
  archetype: z.enum([
    'POST_SLIP_CONTAINMENT',
    'BEDTIME_RISK_WINDOW',
    'ACCESS_PATHWAY_BLOCK',
    'BORED_ALONE_LOOP',
    'STRESS_ESCAPE',
    'FANTASY_SPIRAL',
    'ACCOUNTABILITY_BUILD'
  ]).optional(),
  description: z.string().min(10).max(500),
  goal_type: z.enum(['track', 'wellness']).optional(),
  duration_days: z.number().int().positive().optional(),
  suggested_duration_days: z.number().int().positive().optional(),
  baseline_capture_question: z.string().min(5).max(200).optional(),
  baseline_capture_type: z.enum(['count_7d', 'count_30d', 'yes_no', 'scale_1_5', 'minutes', 'checklist']).optional(),
  why_this_now: z.string().min(10).max(300)
});

export const GoalResponseSchema = z.object({
  challenge_id: z.string().optional(),
  challenge: z.string().optional(),
  severity: z.enum(['occasional', 'growing', 'compulsive', 'overwhelming']),
  goals: z.array(CoachGoalSchema).min(3).max(4)
});

export type CoachGoal = z.infer<typeof CoachGoalSchema>;
export type GoalResponse = z.infer<typeof GoalResponseSchema>;

/**
 * ACTION SCHEMA - Updated for porn recovery category system
 */
export const CoachActionSchema = z.object({
  title: z.string().min(5).max(150),
  duration_minutes: z.number().int().min(1).max(10),
  difficulty: z.enum(['easy', 'medium']),
  category: z.enum([
    'DEVICE_FRICTION',
    'ENVIRONMENT_SHIFT',
    'ACCOUNTABILITY_PING',
    'TIME_PROTOCOL',
    'ANTI_BINGE_LOCK',
    'RECOVERY_REPAIR',
    'SHAME_REPAIR',
    'URGE_INTERRUPT',
    // Legacy values for backwards compatibility
    'friction', 'accountability', 'grounding', 'interrupt', 'replacement', 'environment', 'urge', 'mindset', 'connection', 'movement'
  ]),
  trigger_condition: z.string().min(5).max(200),
  success_criteria: z.string().min(10).max(300),
  mechanism_type: z.enum(['friction', 'accountability', 'grounding', 'interrupt', 'replacement', 'environmental_control', 'shame_repair', 'state_change']),
  when_to_do: z.string().min(5).max(200),
  ai_note: z.string().min(10).max(500)
});

export const ActionResponseSchema = z.object({
  goal_id: z.string().optional(),
  goal_label: z.string().optional(),
  goal_archetype: z.string().optional(),
  challenge: z.string().optional(),
  actions: z.array(CoachActionSchema).min(3).max(3)
});

export type CoachAction = z.infer<typeof CoachActionSchema>;
export type ActionResponse = z.infer<typeof ActionResponseSchema>;

/**
 * INSIGHT SCHEMA
 */
export const InsightDataSchema = z.object({
  risk_window: z.string(),
  best_tool: z.string(),
  best_lever: z.string()
});

export const NextWeekPlanSchema = z.object({
  keep: z.array(z.string()).length(2),
  change: z.array(z.string()).length(2),
  try: z.array(z.string()).length(2)
});

export const InsightResponseSchema = z.object({
  challenge_id: z.string(),
  timeframe_days: z.number().int(),
  insights: InsightDataSchema,
  next_week_plan: NextWeekPlanSchema
});

export type InsightData = z.infer<typeof InsightDataSchema>;
export type NextWeekPlan = z.infer<typeof NextWeekPlanSchema>;
export type InsightResponse = z.infer<typeof InsightResponseSchema>;

/**
 * DETAILED INSIGHT REPORT SCHEMA (with metrics + comparison)
 */
export const DetailedInsightDataSchema = z.object({
  risk_window: z.string(),
  best_tool: z.string(),
  best_lever: z.string(),
  insights: z.array(z.string()).min(3).max(7),
  next_experiment: z.object({
    title: z.string().min(5).max(100),
    why: z.string().min(10).max(200),
    steps: z.array(z.string()).min(1).max(3)
  }),
  compare_summary: z.string().optional()
});

export type DetailedInsightData = z.infer<typeof DetailedInsightDataSchema>;

/**
 * Range key for time filtering
 */
export type RangeKey = 'last_7_days' | 'last_30_days' | 'last_90_days' | 'since_beginning';

/**
 * Compare mode for period comparison
 */
export type CompareMode = 'previous_period' | 'baseline' | 'none';

/**
 * Insight metrics structure (returned by getInsightMetrics)
 */
export interface InsightMetrics {
  range: {
    start: string;
    end: string;
    label: string;
    days: number;
  };
  activity: {
    actions_planned: number;
    actions_logged: number;
    done_count: number;
    partial_count: number;
    completion_rate: number;
  };
  urge: {
    avg_before: number | null;
    avg_after: number | null;
    avg_drop: number | null;
    drops_by_category: Array<{
      category: string;
      avg_drop: number;
      count: number;
      completion_rate: number;
    }>;
  };
  risk_window: {
    top_hours: Array<{ hour: number; count: number; signal: string }>;
    label: string | null;
  };
  tools: {
    best_categories: Array<{ category: string; score: number; why: string }>;
  };
  baselines: {
    track: any | null;
    goal: any | null;
  };
  slips: {
    slip_count: number;
    second_session_rate: number | null;
  };
  meta: {
    has_enough_data: boolean;
    sample_sizes: {
      completions: number;
      actions: number;
      slips: number;
    };
  };
}

/**
 * Insight snapshot (cached in database)
 */
export interface InsightSnapshot {
  id: string;
  user_id: string;
  track_id: string;
  range_key: RangeKey;
  compare_mode: CompareMode;
  start_at: string;
  end_at: string;
  metrics_json: InsightMetrics;
  insights_json: DetailedInsightData;
  version: number;
  created_at: string;
  updated_at: string;
}

/**
 * Detailed insights API response
 */
export interface DetailedInsightsResponse {
  report_completeness: {
    percent_complete: number;
    missing_metrics: Array<{
      key: string;
      label: string;
      why_it_matters: string;
      how_to_fix: string;
      cta: {
        label: string;
        href: string;
      };
    }>;
    coverage: {
      [sectionName: string]: {
        available: boolean;
        pct: number;
        reasons: string[];
      };
    };
  };
  snapshot: {
    metrics: InsightMetrics;
    insights: DetailedInsightData;
  };
  compare_snapshot?: {
    metrics: InsightMetrics;
    insights: DetailedInsightData;
  } | null;
  delta?: {
    completion_rate_change: number;
    avg_drop_change: number | null;
    slip_count_change: number;
  } | null;
  cached: boolean;
}

/**
 * URGE PROTOCOL SCHEMA (Support Now)
 */
export const ProtocolStepSchema = z.object({
  id: z.string(),
  title: z.string().min(2).max(50),
  instruction: z.string().min(5).max(140),
  seconds: z.number().int().min(15).max(60),
  category: z.enum(['grounding', 'interrupt', 'friction', 'redirect', 'stabilize'])
});

export const ProtocolCloseSchema = z.object({
  instruction: z.string().min(5).max(140)
});

export const ProtocolResponseSchema = z.object({
  id: z.string(),
  title: z.string().min(5).max(100),
  coach_persona: z.string().min(5).max(100),
  duration_seconds: z.number().int(),
  steps: z.array(ProtocolStepSchema).min(3).max(8),
  close: ProtocolCloseSchema
});

export type ProtocolStep = z.infer<typeof ProtocolStepSchema>;
export type ProtocolClose = z.infer<typeof ProtocolCloseSchema>;
export type ProtocolResponse = z.infer<typeof ProtocolResponseSchema>;
