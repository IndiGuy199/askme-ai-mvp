/**
 * Zod schemas for validating Coach AI JSON responses
 */
import { z } from 'zod';

/**
 * GOAL SCHEMA
 */
export const CoachGoalSchema = z.object({
  label: z.string().min(5).max(100),
  description: z.string().min(10).max(500),
  goal_type: z.enum(['track', 'wellness']),
  suggested_duration_days: z.number().int().positive(),
  why_this_now: z.string().min(10).max(300)
});

export const GoalResponseSchema = z.object({
  challenge_id: z.string(),
  severity: z.enum(['occasional', 'growing', 'compulsive', 'overwhelming']),
  goals: z.array(CoachGoalSchema).min(3).max(4)
});

export type CoachGoal = z.infer<typeof CoachGoalSchema>;
export type GoalResponse = z.infer<typeof GoalResponseSchema>;

/**
 * ACTION SCHEMA
 */
export const CoachActionSchema = z.object({
  title: z.string().min(5).max(150),
  duration_minutes: z.number().int().min(1).max(10),
  difficulty: z.enum(['easy', 'medium']),
  category: z.enum(['environment', 'urge', 'mindset', 'connection', 'sleep', 'movement']),
  success_criteria: z.string().min(10).max(300),
  when_to_do: z.string().min(5).max(200),
  why_this: z.string().min(10).max(300)
});

export const ActionResponseSchema = z.object({
  goal_id: z.string(),
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
