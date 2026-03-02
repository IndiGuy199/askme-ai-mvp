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
 * DETAILED INSIGHT REPORT SCHEMA — Coach-grade structured sections.
 *
 * v3 stable schema (all keys always present):
 *   - summary_paragraph   : coaching overview sentence(s)
 *   - whats_working       : 2–4 bullets on what's going well
 *   - where_vulnerable    : 2–4 bullets on risk areas
 *   - patterns_triggers   : 2–4 bullets on patterns / triggers
 *   - slip_analysis       : null when slip_count == 0; object when slips present
 *   - one_experiment      : single testable experiment with 3–5 steps
 *   - compare_section     : always present; bullets may be [] when data insufficient
 */
export const DetailedInsightDataSchema = z.object({
  /** 1–2 sentence coaching overview of the period. */
  summary_paragraph: z.string().min(10).max(400),
  /** 2–4 bullets: what is going well and why it matters. */
  whats_working: z.array(z.string()).min(2).max(4),
  /** 2–4 bullets: where the user is at risk and what that means. */
  where_vulnerable: z.array(z.string()).min(2).max(4),
  /** 2–4 bullets referencing risk window or baseline trigger when available. */
  patterns_triggers: z.array(z.string()).min(2).max(4),
  /** null when slips == 0; required object when slip_count > 0. */
  slip_analysis: z.object({
    pattern: z.string().min(5).max(300),
    anti_binge_rule: z.string().min(5).max(200),
    repair_step: z.string().min(5).max(200)
  }).nullable(),
  /** One measurable experiment with 3–5 concrete steps. */
  one_experiment: z.object({
    title: z.string().min(5).max(100),
    why: z.string().min(10).max(200),
    steps: z.array(z.string()).min(3).max(5)
  }),
  /** Always present. bullets is [] when compare data is absent or low-confidence. */
  compare_section: z.object({
    label: z.string().min(1).max(100),
    bullets: z.array(z.string()).max(3)
  })
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
 * Phase 0+2 shape – includes temporal fields, confidence, completion quality
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
    /** Total action×days available in period (opportunity denominator) */
    action_days_available: number;
    /** Average completion_percent across all completions (null if none) */
    completion_quality_avg: number | null;
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
    confidence: 'high' | 'medium' | 'low' | 'none';
  };
  risk_window: {
    top_hours: Array<{ hour: number; count: number; signal: string }>;
    label: string | null;
    confidence: 'high' | 'medium' | 'low' | 'none';
  };
  tools: {
    best_categories: Array<{ category: string; score: number; why: string; sample_size?: number }>;
  };
  baselines: {
    track: any | null;
    goal: any | null;
  };
  slips: {
    slip_count: number;
    days_with_slips: number;
    last_slip_at: string | null;
    second_session_rate: number | null;
  };
  support_sessions: {
    count: number;
    avg_pre_urge: number | null;
    avg_post_urge: number | null;
    avg_urge_drop: number | null;
  };
  meta: {
    has_enough_data: boolean;
    sample_sizes: {
      completions: number;
      actions: number;
      goals_active?: number;
      slips: number;
      urge_pairs: number;
      timestamped_logs?: number;
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
    /** Hard-missing: section has zero data. */
    missing_metrics: Array<{
      key: string;
      label: string;
      why_it_matters: string;
      how_to_fix: string;
      cta: { label: string; href: string };
    }>;
    /** Soft-missing: section exists but could improve (explains any gap from 100%). */
    improvement_items: Array<{
      key: string;
      label: string;
      why_it_matters: string;
      how_to_fix: string;
      threshold_text: string;
      cta?: { label: string; href: string };
    }>;
    coverage: {
      [sectionName: string]: {
        available: boolean;
        pct: number;
        reasons: string[];
      };
    };
    meta?: {
      total_events_in_range: number;
      total_urge_ratings_in_range: number;
      total_completions_in_range: number;
      tool_samples_by_category: Array<{
        category: string;
        sample_size: number;
      }>;
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
