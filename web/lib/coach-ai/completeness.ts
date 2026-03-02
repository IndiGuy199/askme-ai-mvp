/**
 * Compute report completeness and missing metrics
 * Returns a structured analysis of what data is available vs. missing
 */

export interface MissingMetric {
  key: string;
  label: string;
  why_it_matters: string;
  how_to_fix: string;
  cta: {
    label: string;
    href: string;
  };
}

/** Sections that exist but could be improved (partial data). Not the same as hard-missing. */
export interface ImprovementItem {
  key: string;
  label: string;
  why_it_matters: string;
  how_to_fix: string;
  threshold_text: string;
  cta?: { label: string; href: string };
}

export interface SectionCoverage {
  available: boolean;
  pct: number;
  reasons: string[];
}

export interface ReportCompleteness {
  percent_complete: number;
  /** Hard-missing: section is completely unavailable (pct === 0 AND no data recorded). */
  missing_metrics: MissingMetric[];
  /** Soft-missing: section has data but score < 100; explains any gap between 100% and current score. */
  improvement_items: ImprovementItem[];
  coverage: {
    [sectionName: string]: SectionCoverage;
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
}

export function existsDuringRange(
  createdAt: string | Date | null | undefined,
  removedAt: string | Date | null | undefined,
  startDate: Date,
  endDate: Date
): boolean {
  if (!createdAt) return false;

  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime()) || created > endDate) return false;

  if (!removedAt) return true;
  const removed = new Date(removedAt);
  if (Number.isNaN(removed.getTime())) return true;

  return removed >= startDate;
}

export interface GoalIntervalEvent {
  goal_slot?: number | string | null;
  swapped_goal_id?: string | null;
  swapped_out_goal_id?: string | null;
  created_at?: string | null;
}

export interface GoalIntervalGoal {
  id: string;
  goal_slot?: number | string | null;
  is_active?: boolean | null;
  status?: string | null;
  selected_at?: string | null;
  created_at?: string | null;
}

/**
 * Bug fix: derive active-goal overlap from goal intervals (events + active-goal fallback),
 * not from selected_at/created_at being inside the range.
 */
export function computeGoalsActiveInRange(
  events: GoalIntervalEvent[],
  goals: GoalIntervalGoal[],
  rangeStart: Date,
  rangeEnd: Date
): {
  goals_active_count: number;
  goals_active_unique_in_range: string[];
  goals_active_by_slot: Record<string, string[]>;
} {
  const validEvents = (events || [])
    .filter(event => !!event?.created_at)
    .sort((a, b) => new Date(a.created_at as string).getTime() - new Date(b.created_at as string).getTime());

  const slotState = new Map<string, string>();
  const openIntervals = new Map<string, { slotKey: string; start: Date }>();
  const intervals: Array<{ goalId: string; slotKey: string; start: Date; end: Date | null }> = [];

  const toSlotKey = (slot: number | string | null | undefined) => String(slot ?? '__unknown__');
  const isCurrentGoal = (goal: GoalIntervalGoal): boolean => {
    if (typeof goal.is_active === 'boolean') return goal.is_active;
    if (typeof goal.status === 'string') return goal.status.toLowerCase() === 'active';
    return false;
  };

  const openGoal = (goalId: string, slotKey: string, start: Date) => {
    if (!goalId || Number.isNaN(start.getTime())) return;
    if (!openIntervals.has(goalId)) {
      openIntervals.set(goalId, { slotKey, start });
    }
    slotState.set(slotKey, goalId);
  };

  const closeGoal = (goalId: string, closeAt: Date) => {
    const open = openIntervals.get(goalId);
    if (!open) return;
    intervals.push({ goalId, slotKey: open.slotKey, start: open.start, end: closeAt });
    openIntervals.delete(goalId);
  };

  for (const event of validEvents) {
    const eventAt = new Date(event.created_at as string);
    if (Number.isNaN(eventAt.getTime()) || eventAt > rangeEnd) continue;

    const slotKey = toSlotKey(event.goal_slot);
    const incomingGoalId = event.swapped_goal_id || undefined;
    const outgoingGoalId = event.swapped_out_goal_id || undefined;

    if (outgoingGoalId) {
      closeGoal(outgoingGoalId, eventAt);
      if (slotState.get(slotKey) === outgoingGoalId) {
        slotState.delete(slotKey);
      }
    }

    if (incomingGoalId) {
      const currentInSlot = slotState.get(slotKey);
      if (currentInSlot && currentInSlot !== incomingGoalId) {
        closeGoal(currentInSlot, eventAt);
      }
      openGoal(incomingGoalId, slotKey, eventAt);
    }
  }

  // Fallback safety: if current active goals exist without complete event history,
  // treat them as open-ended intervals from selected_at/created_at.
  for (const goal of goals || []) {
    if (!goal?.id || !isCurrentGoal(goal)) continue;
    if (openIntervals.has(goal.id)) continue;

    const startAt = new Date(goal.selected_at || goal.created_at || rangeStart.toISOString());
    if (Number.isNaN(startAt.getTime())) continue;
    openGoal(goal.id, toSlotKey(goal.goal_slot), startAt);
  }

  for (const [goalId, open] of openIntervals.entries()) {
    intervals.push({ goalId, slotKey: open.slotKey, start: open.start, end: null });
  }

  const overlapping = intervals.filter(interval =>
    existsDuringRange(interval.start, interval.end, rangeStart, rangeEnd)
  );

  const uniqueGoalIds = Array.from(new Set(overlapping.map(interval => interval.goalId)));
  const bySlot: Record<string, string[]> = {};
  for (const interval of overlapping) {
    if (!bySlot[interval.slotKey]) bySlot[interval.slotKey] = [];
    if (!bySlot[interval.slotKey].includes(interval.goalId)) {
      bySlot[interval.slotKey].push(interval.goalId);
    }
  }

  return {
    goals_active_count: uniqueGoalIds.length,
    goals_active_unique_in_range: uniqueGoalIds,
    goals_active_by_slot: bySlot
  };
}

/**
 * Compute report completeness and missing metrics
 * Phase 6 rewrite: opportunity-based weighted scoring
 *
 * Weights:
 *   Activity    35%  (actions planned + completions logged + quality)
 *   Completions 20%  (done + partial count, quality avg)
 *   Urge        20%  (urge before/after pairs)
 *   Risk Window 15%  (completion timestamps)
 *   Tools       10%  (category urge drops)
 *
 * Each section scores 0-100 internally, then weighted sum.
 * Baselines are a bonus (+5 max), not penalized if missing.
 */

export function computeReportCompleteness(metrics: any): ReportCompleteness {
  const missing: MissingMetric[] = [];
  const improvements: ImprovementItem[] = [];
  const coverage: { [key: string]: SectionCoverage } = {};

  const actionsPlanned = metrics.activity?.actions_planned || 0;
  const actionsLogged = metrics.activity?.actions_logged || 0;
  const doneCount = metrics.activity?.done_count || 0;
  const partialCount = metrics.activity?.partial_count || 0;
  const actionDaysAvailable = metrics.activity?.action_days_available || 0;
  const completionQualityAvg = metrics.activity?.completion_quality_avg;
  const completionRate = metrics.activity?.completion_rate || 0;

  const urgePairs = metrics.meta?.sample_sizes?.urge_pairs || 0;
  const urgeConfidence = metrics.urge?.confidence || 'none';

  const riskWindowHours = metrics.risk_window?.top_hours?.length || 0;
  const riskWindowConfidence = metrics.risk_window?.confidence || 'none';

  const toolCategories = metrics.tools?.best_categories?.length || 0;
  const totalCompletions = metrics.meta?.sample_sizes?.completions || 0;
  const timestampedLogs = metrics.meta?.sample_sizes?.timestamped_logs || totalCompletions;
  const goalsActive = metrics.meta?.sample_sizes?.goals_active || 0;

  const hasTrackBaseline = metrics.baselines?.track !== null && metrics.baselines?.track !== undefined;
  const hasGoalBaseline = metrics.baselines?.goal !== null && metrics.baselines?.goal !== undefined;

  // ---------------------------------------------------------------
  // Activity section (weight 35)
  // ---------------------------------------------------------------
  let activityScore = 0;
  const activityReasons: string[] = [];

  if (actionsPlanned === 0) {
    activityReasons.push('No actions planned yet');
    missing.push({
      key: 'action_logs',
      label: 'Actions available',
      why_it_matters: 'Actions give this report enough logs to find patterns.',
      how_to_fix: 'Add 3 actions on your Playbook and log them this week.',
      cta: { label: 'Go to Playbook', href: '/playbook' }
    });
  } else {
    // Planned actions exist: 40 of 100 base
    activityScore += 40;
    // Completion rate (up to 40 points)
    activityScore += Math.min(40, completionRate * 40);
    // Quality bonus (up to 20 points)
    if (completionQualityAvg !== null) {
      activityScore += Math.min(20, (completionQualityAvg / 100) * 20);
    }
    // Improvement: low completion count
    if (actionsLogged > 0 && actionsLogged < 5) {
      const needed = 5 - actionsLogged;
      improvements.push({
        key: 'more_completions',
        label: 'Log more actions',
        why_it_matters: 'More logs surface clearer patterns in this report.',
        how_to_fix: `Log ${needed} more action${needed > 1 ? 's' : ''} this week.`,
        threshold_text: `${actionsLogged} / 5 logs`,
        cta: { label: 'Go to Playbook', href: '/playbook' }
      });
    }
  }

  if (actionsPlanned > 0 && actionsLogged === 0) {
    activityReasons.push('No actions completed yet');
    missing.push({
      key: 'completions',
      label: 'Action logs',
      why_it_matters: 'Logging actions shows what is actually helping you.',
      how_to_fix: 'Log at least 3 actions in this period.',
      cta: { label: 'Log actions', href: '/playbook' }
    });
  }

  // Note: active_goal is only hard-missing when no actions AND no goals,
  // otherwise the report still has content so we do not surface it as missing.
  if (goalsActive === 0 && actionsPlanned === 0) {
    activityReasons.push('No active goal in this period');
    missing.push({
      key: 'active_goal',
      label: 'Active goal',
      why_it_matters: 'Keeping one goal active gives your report a stable target.',
      how_to_fix: 'Keep 1 goal active for at least 7 days before swapping.',
      cta: { label: 'Manage goals', href: '/playbook' }
    });
  }

  coverage.activity = {
    available: actionsPlanned > 0,
    pct: Math.round(activityScore),
    reasons: activityReasons
  };

  // ---------------------------------------------------------------
  // Completions section (weight 20)
  // ---------------------------------------------------------------
  let completionsScore = 0;
  const completionsReasons: string[] = [];

  if (actionsLogged === 0) {
    completionsReasons.push('No completion logs yet');
  } else if (actionsLogged < 3) {
    completionsScore = 30 + (actionsLogged / 3) * 30; // 30-60
    completionsReasons.push(`Only ${actionsLogged} completion(s), need 3+ for patterns`);
  } else {
    // 3+ completions
    completionsScore = 60;
    // Quality bonus
    if (partialCount > 0 && doneCount > 0) {
      completionsScore += 20; // Using both done & partial = richer data
    } else {
      completionsScore += 10;
    }
    // Volume bonus: up to 20 more points for 10+ completions
    completionsScore += Math.min(20, (Math.min(actionsLogged, 10) / 10) * 20);
  }

  coverage.completions = {
    available: actionsLogged > 0,
    pct: Math.round(completionsScore),
    reasons: completionsReasons
  };

  // ---------------------------------------------------------------
  // Urge tracking section (weight 20)
  // ---------------------------------------------------------------
  let urgeScore = 0;
  const urgeReasons: string[] = [];

  if (urgePairs === 0) {
    urgeReasons.push('No urge ratings logged');
    missing.push({
      key: 'urge_data',
      label: 'Urge before & after',
      why_it_matters: 'Urge ratings show which actions lower urges the most.',
      how_to_fix: 'When logging an action, add urge before and after (0-10).',
      cta: { label: 'Learn how', href: '/playbook' }
    });
  } else if (urgePairs < 5) {
    urgeScore = 30 + (urgePairs / 5) * 50;
    urgeReasons.push(`Only ${urgePairs} urge rating${urgePairs > 1 ? 's' : ''}, need 5+ for reliable averages`);
    improvements.push({
      key: 'more_urge_pairs',
      label: 'Add urge ratings (before & after)',
      why_it_matters: 'Urge before/after pairs reveal which actions reliably lower urges.',
      how_to_fix: `Add urge before & after when logging actions — need ${5 - urgePairs} more.`,
      threshold_text: `${urgePairs} / 5 urge ratings`,
      cta: { label: 'Log actions', href: '/playbook' }
    });
  } else if (urgeConfidence === 'low') {
    urgeScore = 60;
    urgeReasons.push('Low confidence – need 5+ urge ratings');
    improvements.push({
      key: 'more_urge_pairs',
      label: 'More urge ratings (before & after)',
      why_it_matters: 'Low confidence: 10+ pairs needed to show which tools help most.',
      how_to_fix: `Log ${Math.max(0, 10 - urgePairs)} more action${Math.max(0, 10 - urgePairs) !== 1 ? 's' : ''} with urge ratings to reach high confidence.`,
      threshold_text: `${urgePairs} / 10 urge ratings`,
      cta: { label: 'Log actions', href: '/playbook' }
    });
  } else if (urgeConfidence === 'medium') {
    urgeScore = 80;
  } else {
    urgeScore = 100;
  }

  coverage.urge_tracking = {
    available: urgePairs > 0,
    pct: Math.round(urgeScore),
    reasons: urgeReasons
  };

  // ---------------------------------------------------------------
  // Risk window section (weight 15)
  // ---------------------------------------------------------------
  let riskScore = 0;
  const riskReasons: string[] = [];

  if (riskWindowHours === 0) {
    riskReasons.push('Not enough timestamped logs for high-risk times');
    if (actionsLogged === 0) {
      // Truly missing: no logs at all – covered by activity missing
    } else {
      // Has some logs but not enough for risk window → improvement item, not hard missing
      const needed = Math.max(0, 10 - timestampedLogs);
      riskReasons.push(`Need at least 10 timestamped logs (have ${timestampedLogs})`);
      if (needed > 0) {
        improvements.push({
          key: 'more_logs_for_risk_window',
          label: 'Unlock high-risk times',
          why_it_matters: 'Knowing your hardest hours lets you plan support before urges hit.',
          how_to_fix: `Log ${needed} more action${needed > 1 ? 's' : ''} to identify your high-risk hours.`,
          threshold_text: `${timestampedLogs} / 10 logs`,
          cta: { label: 'Continue logging', href: '/playbook' }
        });
      }
    }
  } else if (riskWindowConfidence === 'low') {
    riskScore = 50;
    riskReasons.push('Low confidence – need 7+ completions for reliable pattern');
    const needed = Math.max(0, 10 - timestampedLogs);
    if (needed > 0) {
      improvements.push({
        key: 'more_logs_for_risk_window',
        label: 'Improve high-risk times accuracy',
        why_it_matters: 'Low confidence (only a few logs). More logs = more reliable pattern.',
        how_to_fix: `Log ${needed} more action${needed > 1 ? 's' : ''} to reach medium confidence.`,
        threshold_text: `${timestampedLogs} / 10 logs`,
        cta: { label: 'Continue logging', href: '/playbook' }
      });
    }
  } else if (riskWindowConfidence === 'medium') {
    riskScore = 80;
  } else {
    riskScore = 100;
  }

  coverage.risk_window = {
    available: riskWindowHours > 0,
    pct: Math.round(riskScore),
    reasons: riskReasons
  };

  // ---------------------------------------------------------------
  // Tools effectiveness section (weight 10)
  // ---------------------------------------------------------------
  let toolsScore = 0;
  const toolsReasons: string[] = [];

  if (toolCategories === 0) {
    toolsReasons.push('No tool usage data');
    missing.push({
      key: 'tool_data',
      label: 'What helps most',
      why_it_matters: 'This section highlights which action types reduce urges most.',
      how_to_fix: 'Log actions with urge before/after across a few action types.',
      cta: { label: 'View actions', href: '/playbook' }
    });
  } else {
    const bestToolSamples = metrics.tools.best_categories[0]?.sample_size || 0;
    if (bestToolSamples >= 10) {
      toolsScore = 100;
    } else if (bestToolSamples >= 5) {
      toolsScore = 75;
    } else {
      toolsScore = 40;
      toolsReasons.push('Low sample size for tool scoring');
      const needed = Math.max(0, 5 - bestToolSamples);
      improvements.push({
        key: 'more_tool_data',
        label: 'See what helps most',
        why_it_matters: 'More logs per action type show which category lowers urges best.',
        how_to_fix: `Log ${needed} more action${needed > 1 ? 's' : ''} with urge ratings across different action types.`,
        threshold_text: `${bestToolSamples} / 5 logs for top category`,
        cta: { label: 'View actions', href: '/playbook' }
      });
    }
  }

  coverage.tools = {
    available: toolCategories > 0,
    pct: Math.round(toolsScore),
    reasons: toolsReasons
  };

  // ---------------------------------------------------------------
  // Baselines (bonus, not penalized)
  // ---------------------------------------------------------------
  let baselineBonus = 0;
  const baselineReasons: string[] = [];

  if (hasTrackBaseline) {
    baselineBonus += 3;
  } else {
    baselineReasons.push('Track baseline not set');
    // Baseline is a bonus — not a hard-missing blocker, so use improvement_items
    improvements.push({
      key: 'set_track_baseline',
      label: 'Set a track baseline',
      why_it_matters: 'A baseline makes week-over-week progress measurable.',
      how_to_fix: 'Set your track baseline once to establish a clear starting point.',
      threshold_text: 'Not set (optional bonus)',
      cta: { label: 'Set baseline', href: '/playbook' }
    });
  }
  if (hasGoalBaseline) {
    baselineBonus += 2;
  } else {
    baselineReasons.push('Goal baseline not set');
  }

  coverage.baselines = {
    available: hasTrackBaseline,
    pct: hasTrackBaseline ? (hasGoalBaseline ? 100 : 70) : 0,
    reasons: baselineReasons
  };

  // ---------------------------------------------------------------
  // Weighted total
  // ---------------------------------------------------------------
  const weighted =
    (activityScore / 100) * 35 +
    (completionsScore / 100) * 20 +
    (urgeScore / 100) * 20 +
    (riskScore / 100) * 15 +
    (toolsScore / 100) * 10 +
    baselineBonus; // +0-5 bonus

  const percentComplete = Math.min(100, Math.round(weighted));
  const toolSamplesByCategory = (metrics.tools?.best_categories || []).map((categoryRow: any) => ({
    category: categoryRow.category,
    sample_size: categoryRow.sample_size || categoryRow.count || 0
  }));

  return {
    percent_complete: percentComplete,
    missing_metrics: missing,
    improvement_items: improvements,
    coverage,
    meta: {
      total_events_in_range: timestampedLogs,
      total_urge_ratings_in_range: urgePairs,
      total_completions_in_range: actionsLogged,
      tool_samples_by_category: toolSamplesByCategory
    }
  };
}

/**
 * Get confidence label for tool effectiveness data
 */
export function getToolConfidence(sampleSize: number): 'high' | 'medium' | 'low' {
  if (sampleSize >= 10) return 'high';
  if (sampleSize >= 5) return 'medium';
  return 'low';
}

/**
 * Format risk window label
 */
export function formatRiskWindowLabel(topHours: Array<{ hour: number; count: number; signal: string }>): string | null {
  if (!topHours || topHours.length === 0) return null;

  const formatHour = (h: number) => {
    const ampm = h >= 12 ? 'pm' : 'am';
    const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${h12}${ampm}`;
  };

  // Find continuous window
  const peakHour = topHours[0].hour;
  return `${formatHour(peakHour)}–${formatHour((peakHour + 2) % 24)}`;
}

/**
 * Map category enum to user-friendly label
 */
export function mapCategoryToLabel(category: string): string {
  const mapping: { [key: string]: string } = {
    'DEVICE_FRICTION': 'Phone barriers',
    'ACCOUNTABILITY': 'Reach out',
    'ACCOUNTABILITY_PING': 'Reach out',
    'ENVIRONMENT_SHIFT': 'Change location',
    'TIME_PROTOCOL': 'Plan your timing',
    'ANTI_BINGE_LOCK': 'Stop escalation early',
    'RECOVERY_REPAIR': 'Recovery reset',
    'SHAME_REPAIR': 'Self-compassion reset',
    'URGE_INTERRUPT': 'Interrupt the urge',
    'friction': 'Phone barriers',
    'accountability': 'Reach out',
    'environment': 'Change location',
    'interrupt': 'Interrupt the urge',
    'urge': 'Urge surfing',
    'connection': 'Reach out',
    'movement': 'Physical activity',
    'PHYSICAL_ACTIVITY': 'Physical activity',
    'MINDFULNESS': 'Mindfulness',
    'URGE_SURFING': 'Urge surfing',
    'CREATIVE_OUTLET': 'Creative outlet',
    'SOCIAL_CONNECTION': 'Social connection',
    'UNKNOWN': 'Uncategorized (add tags)'
  };
  if (mapping[category]) return mapping[category];
  return category
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, ch => ch.toUpperCase());
}

/**
 * Get short description for a category
 */
export function mapCategoryToDescription(category: string): string {
  const descriptions: { [key: string]: string } = {
    'DEVICE_FRICTION': 'Add barriers to make risky content harder to access',
    'ACCOUNTABILITY': 'Connect with someone who supports your recovery',
    'ACCOUNTABILITY_PING': 'Quickly message someone who supports your recovery',
    'ENVIRONMENT_SHIFT': 'Move to a different room or go outside',
    'TIME_PROTOCOL': 'Set a specific next step for high-risk times',
    'ANTI_BINGE_LOCK': 'Create steps that stop one slip from becoming more',
    'RECOVERY_REPAIR': 'Reset quickly after a lapse and return to your plan',
    'SHAME_REPAIR': 'Use kind self-talk to prevent shame spirals',
    'URGE_INTERRUPT': 'Break the urge cycle with a fast action',
    'friction': 'Add barriers to make risky content harder to access',
    'accountability': 'Connect with someone who supports your recovery',
    'environment': 'Move to a different room or go outside',
    'interrupt': 'Break the urge cycle with a fast action',
    'urge': 'Observe urges without acting on them',
    'connection': 'Connect with someone who supports your recovery',
    'movement': 'Exercise or physical movement to shift energy',
    'PHYSICAL_ACTIVITY': 'Exercise or physical movement to shift energy',
    'MINDFULNESS': 'Breathing, meditation, or grounding exercises',
    'URGE_SURFING': 'Observe urges without acting on them',
    'CREATIVE_OUTLET': 'Express yourself through art, music, or writing',
    'SOCIAL_CONNECTION': 'Spend time with friends or family',
    'UNKNOWN': 'Uncategorized actions need tags to group patterns correctly'
  };
  return descriptions[category] || '';
}

/**
 * Get confidence copy based on sample size
 */
export function mapConfidenceToCopy(sampleSize: number, itemType: string = 'logs'): string {
  if (sampleSize >= 10) return 'High confidence';
  if (sampleSize >= 5) return 'Medium confidence';
  const needed = Math.max(1, 5 - sampleSize);
  return `Low confidence (needs ${needed} more ${itemType})`;
}

export function mapRiskConfidence(totalLogsWithTimestamps: number): 'low' | 'medium' | 'high' {
  if (totalLogsWithTimestamps >= 25) return 'high';
  if (totalLogsWithTimestamps >= 10) return 'medium';
  return 'low';
}

export function shouldRenderHeatmap(totalEventsInRange: number, minEvents: number = 10): boolean {
  return totalEventsInRange >= minEvents;
}

export function shouldRenderStrategies(totalUrgeRatingsInRange: number, minEvents: number = 5): boolean {
  return totalUrgeRatingsInRange >= minEvents;
}
