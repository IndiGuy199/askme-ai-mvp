/**
 * Context builder - fetches user data from Supabase to personalize Coach AI outputs
 */
import { SupabaseClient } from '@supabase/supabase-js';
import { UserContext, GoalContext, ActionContext, InsightContext } from './prompts';
import { classifyGoalArchetype, selectCategoriesForGeneration } from './archetypes';
import { InsightMetrics } from './schema';
import { existsDuringRange, computeGoalsActiveInRange } from './completeness';

const RISK_LOGS_MEDIUM_MIN = 10;
const RISK_LOGS_HIGH_MIN = 25;


interface BaseUserData {
  id: string;
  first_name?: string;
  email: string;
}

/**
 * Fetch user's latest severity assessment for their primary challenge
 */
export async function getUserSeverityContext(
  supabase: SupabaseClient,
  userId: string
): Promise<Pick<UserContext, 'challengeId' | 'challengeLabel' | 'severity' | 'timeframeDays' | 'signals'> | null> {
  try {
    // Get user's primary challenge from user_challenges with latest assessment
    const { data: userChallenge, error: challengeError } = await supabase
      .from('user_challenges')
      .select(`
        coach_challenges (
          id,
          challenge_id,
          label
        )
      `)
      .eq('user_id', userId)
      .limit(1)
      .single();

    if (challengeError || !userChallenge) {
      console.error('❌ No challenge found for user:', { userId, error: challengeError });
      // Try to proceed with a generic challenge assumption
      console.warn('⚠️ Attempting to use generic porn_addiction challenge as fallback');
      
      // Query for any porn_addiction challenge from coach_challenges
      const { data: fallbackChallenge } = await supabase
        .from('coach_challenges')
        .select('id, challenge_id, label')
        .eq('challenge_id', 'porn_addiction')
        .limit(1)
        .single();
      
      if (fallbackChallenge) {
        return {
          challengeId: fallbackChallenge.challenge_id,
          challengeLabel: fallbackChallenge.label,
          severity: 'growing',
          timeframeDays: 30,
          signals: undefined
        };
      }
      
      return null;
    }

    // Extract the first (and should be only) coach_challenges object
    const coachChallenge = Array.isArray(userChallenge.coach_challenges) 
      ? userChallenge.coach_challenges[0] 
      : userChallenge.coach_challenges;
      
    if (!coachChallenge) {
      console.error('❌ No coach_challenges found in user challenge');
      return null;
    }

    const coachChallengeId = coachChallenge.id;
    const challengeId = coachChallenge.challenge_id;
    const challengeLabel = coachChallenge.label;

    // Get latest assessment
    const { data: assessment, error: assessmentError } = await supabase
      .from('user_challenge_latest_assessment')
      .select('severity_label, timeframe_days, latest_assessment_id')
      .eq('user_id', userId)
      .eq('coach_challenge_id', coachChallengeId)
      .single();

    if (assessmentError || !assessment) {
      console.warn('⚠️ No assessment found for user, using default severity:', { userId, coachChallengeId, error: assessmentError });
      // Return defaults instead of null - allow action generation to proceed
      return {
        challengeId,
        challengeLabel,
        severity: 'growing', // Safe default
        timeframeDays: 30,
        signals: undefined
      };
    }

    // Get signals from the assessment history row
    const { data: assessmentDetail } = await supabase
      .from('user_challenge_assessments')
      .select('signals_json')
      .eq('id', assessment.latest_assessment_id)
      .single();

    return {
      challengeId,
      challengeLabel,
      severity: assessment.severity_label as 'occasional' | 'growing' | 'compulsive' | 'overwhelming',
      timeframeDays: assessment.timeframe_days,
      signals: assessmentDetail?.signals_json || undefined
    };
  } catch (error) {
    console.error('❌ Error fetching severity context:', error);
    console.warn('⚠️ Returning null - will prevent action generation');
    return null;
  }
}

/**
 * Calculate action completion rate for last N days
 */
export async function getCompletionRate(
  supabase: SupabaseClient,
  userId: string,
  days: number = 30
): Promise<number | undefined> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // Count total actions created in timeframe
    const { count: totalActions } = await supabase
      .from('action_plans')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', cutoffDate.toISOString());

    // Count completed actions
    const { count: completedActions } = await supabase
      .from('action_plans')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_complete', true)
      .gte('created_at', cutoffDate.toISOString());

    if (!totalActions || totalActions === 0) return undefined;

    return Math.round((completedActions! / totalActions) * 100);
  } catch (error) {
    console.error('Error calculating completion rate:', error);
    return undefined;
  }
}

/**
 * Build context for GOAL generation
 */
export async function buildGoalContext(
  supabase: SupabaseClient,
  user: BaseUserData
): Promise<GoalContext | null> {
  const severityContext = await getUserSeverityContext(supabase, user.id);
  if (!severityContext) return null;

  const completionRate = await getCompletionRate(supabase, user.id, 30);

  // Get existing goals
  const { data: existingGoals } = await supabase
    .from('user_wellness_goals')
    .select(`
      coach_wellness_goals (
        goal_id,
        label
      )
    `)
    .eq('user_id', user.id);

  return {
    firstName: user.first_name,
    ...severityContext,
    completionRate,
    existingGoals: existingGoals?.map(g => {
      const goalData = Array.isArray(g.coach_wellness_goals) 
        ? g.coach_wellness_goals[0] 
        : g.coach_wellness_goals;
      return {
        goal_id: goalData?.goal_id,
        label: goalData?.label
      };
    }) || []
  };
}

/**
 * Build context for ACTION generation
 * Can accept goal details directly for unsaved goals
 * Now includes recovery metrics: slip history, streak, risk window, existing actions
 */
export async function buildActionContext(
  supabase: SupabaseClient,
  user: BaseUserData,
  goalIdOrDetails: string | { label: string; description?: string; goalType?: 'track' | 'wellness' }
): Promise<ActionContext | null> {
  const severityContext = await getUserSeverityContext(supabase, user.id);
  if (!severityContext) return null;

  const completionRate = await getCompletionRate(supabase, user.id, 30);

  let goalLabel: string;
  let goalDescription: string | undefined;
  let goalType: 'track' | 'wellness' | undefined;
  let goalDbId: string | undefined;

  // Check if goal details provided directly (unsaved goal)
  if (typeof goalIdOrDetails === 'object') {
    goalLabel = goalIdOrDetails.label;
    goalDescription = goalIdOrDetails.description;
    goalType = goalIdOrDetails.goalType;
  } else {
    // Lookup goal from database
    const { data: goal, error: goalError } = await supabase
      .from('coach_wellness_goals')
      .select('label, description, goal_id, goal_type')
      .eq('goal_id', goalIdOrDetails)
      .single();

    if (goalError || !goal) {
      console.error('Goal not found:', goalIdOrDetails);
      return null;
    }

    goalLabel = goal.label;
    goalDescription = goal.description;
    goalType = goal.goal_type;
    goalDbId = goal.goal_id;
  }

  // Fetch recovery metrics
  const recoveryMetrics = await getRecoveryMetrics(supabase, user.id);
  
  // Build compact metrics JSON
  const userMetricsCompact = buildCompactUserMetrics(recoveryMetrics);
  
  // Determine goal archetype (classify from label)
  const goalArchetype = classifyGoalArchetype(goalLabel);
  
  // Fetch existing action titles for this goal to prevent duplicates
  const existingActionTitles = await getExistingActionTitles(
    supabase, 
    user.id, 
    typeof goalIdOrDetails === 'string' ? goalIdOrDetails : undefined
  );
  
  // Fetch existing actions with their metadata for category selection
  let query = supabase
    .from('action_plans')
    .select('action_text, coach_metadata')
    .eq('user_id', user.id);
  
  if (goalDbId) {
    query = query.eq('goal_id', goalDbId);
  }
  
  const { data: existingActionsData } = await query;
  const existingActionsList = existingActionsData?.map(a => a.action_text).filter(Boolean) || [];
  
  // Select 3 categories for this generation based on archetype
  const allowedCategories = selectCategoriesForGeneration(goalArchetype, existingActionsList);

  return {
    firstName: user.first_name,
    ...severityContext,
    completionRate,
    goalId: typeof goalIdOrDetails === 'string' ? goalIdOrDetails : undefined,
    goalLabel,
    goalDescription: goalDescription || '',
    goalType,
    goalArchetype,
    ...recoveryMetrics,
    existingActionTitles,
    allowedCategories,
    userMetricsCompact
  };
}

/**
 * Fetch recovery-specific metrics: slip count, streaks, risk windows
 * EXPORTED for use in goals.ts endpoint
 */
export async function getRecoveryMetrics(
  supabase: SupabaseClient,
  userId: string
): Promise<{
  last30DaysSlips?: number;
  secondSessionRate?: number;
  recentSlipToday?: boolean;
  currentStreak?: number;
  commonRiskWindow?: string;
  topTrigger?: string;
}> {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Get progress logs for slip data
    const { data: progressLogs } = await supabase
      .from('progress')
      .select('logged_at, slip_count, notes, status')
      .eq('user_id', userId)
      .gte('logged_at', thirtyDaysAgo.toISOString())
      .order('logged_at', { ascending: false });

    let last30DaysSlips = 0;
    let recentSlipToday = false;
    let currentStreak = 0;

    if (progressLogs && progressLogs.length > 0) {
      // Count slips
      for (const log of progressLogs) {
        if (log.slip_count && log.slip_count > 0) {
          last30DaysSlips += log.slip_count;
        }
        // Check for status-based slip tracking
        if (log.status === 'slip' || log.status === 'relapse') {
          last30DaysSlips++;
        }
      }

      // Check today's slip
      const todayLogs = progressLogs.filter(log => 
        new Date(log.logged_at) >= todayStart
      );
      recentSlipToday = todayLogs.some(log => 
        (log.slip_count && log.slip_count > 0) || 
        log.status === 'slip' || 
        log.status === 'relapse'
      );

      // Calculate current streak (days since last slip)
      let streakCount = 0;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      for (let d = 0; d < 90; d++) {
        const checkDate = new Date(today);
        checkDate.setDate(checkDate.getDate() - d);
        const dateStr = checkDate.toISOString().split('T')[0];
        
        const dayLogs = progressLogs.filter(log => 
          log.logged_at?.startsWith(dateStr)
        );
        
        const hadSlip = dayLogs.some(log => 
          (log.slip_count && log.slip_count > 0) || 
          log.status === 'slip' || 
          log.status === 'relapse'
        );
        
        if (hadSlip) break;
        streakCount++;
      }
      currentStreak = streakCount;
    }

    // Try to get risk window data from action_completion_logs or progress
    let commonRiskWindow: string | undefined;
    const { data: completionLogs } = await supabase
      .from('progress')
      .select('logged_at')
      .eq('user_id', userId)
      .or('status.eq.slip,status.eq.relapse')
      .gte('logged_at', thirtyDaysAgo.toISOString());
    
    if (completionLogs && completionLogs.length >= 3) {
      // Analyze hour distribution of slips
      const hourCounts: Record<number, number> = {};
      for (const log of completionLogs) {
        const hour = new Date(log.logged_at).getHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      }
      
      // Find the peak 2-hour window
      let maxCount = 0;
      let peakHour = 22; // default
      for (const [hour, count] of Object.entries(hourCounts)) {
        if (count > maxCount) {
          maxCount = count;
          peakHour = parseInt(hour);
        }
      }
      
      const formatHour = (h: number) => {
        const ampm = h >= 12 ? 'pm' : 'am';
        const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
        return `${h12}${ampm}`;
      };
      commonRiskWindow = `${formatHour(peakHour)}-${formatHour((peakHour + 2) % 24)}`;
    }

    // Estimate second-session rate (slips > 1 per day / total slip days)
    let secondSessionRate: number | undefined;
    if (progressLogs && progressLogs.length > 0) {
      const slipDays = new Map<string, number>();
      for (const log of progressLogs) {
        const date = log.logged_at?.split('T')[0];
        if ((log.slip_count && log.slip_count > 0) || log.status === 'slip' || log.status === 'relapse') {
          slipDays.set(date, (slipDays.get(date) || 0) + (log.slip_count || 1));
        }
      }
      
      const totalSlipDays = slipDays.size;
      const multiSlipDays = [...slipDays.values()].filter(count => count > 1).length;
      
      if (totalSlipDays >= 3) {
        secondSessionRate = Math.round((multiSlipDays / totalSlipDays) * 100);
      }
    }

    return {
      last30DaysSlips: last30DaysSlips > 0 ? last30DaysSlips : undefined,
      secondSessionRate,
      recentSlipToday,
      currentStreak,
      commonRiskWindow,
      topTrigger: undefined // Could be enhanced with trigger tracking later
    };
  } catch (error) {
    console.error('Error fetching recovery metrics:', error);
    return {};
  }
}

/**
 * Comprehensive metrics aggregation for insights report
 * Single source of truth for weekly patterns, detailed report, and AI prompts
 *
 * Phase 0+2 rewrite – fixes:
 *   • Temporal query: actions ACTIVE during period (not just created)
 *   • Goal overlap: counts goals active at any point in [start,end]
 *   • Extracts category from coach_metadata JSONB (not non-existent column)
 *   • Uses completion_status + completion_percent from action_completions
 *   • Leverages user_action_events for lifecycle awareness
 *   • Removes dead code (unreachable return)
 *   • Adds action_days_available, completion_quality_avg, confidence fields
 */
export async function getInsightMetrics(
  supabase: SupabaseClient,
  userId: string,
  trackId: string,
  startDate: Date,
  endDate: Date
): Promise<InsightMetrics> {
  try {
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    // ---------------------------------------------------------------
    // 1. Fetch actions ACTIVE during period (temporal filter)
    //    Strategy: fetch all user actions (is_active=true) created before endDate,
    //    then cross-reference action_deletions + user_action_events(remove) to find
    //    removal date for any action that was later removed.
    //    Per product spec: use current is_active for 'planned actions' counts.
    // ---------------------------------------------------------------
    const [
      { data: allActions },
      { data: deletions },
      { data: removeEvents },
      { data: allGoals },
      { data: goalEvents }
    ] = await Promise.all([
      supabase
        .from('action_plans')
        .select('id, action_text, goal_id, created_at, coach_metadata, status')
        .eq('user_id', userId)
        .eq('is_active', true)  // A2: use current is_active as proxy for "planned" actions
        .lte('created_at', endDate.toISOString()),
      supabase
        .from('action_deletions')
        .select('original_action_id, deleted_at')
        .eq('user_id', userId),
      supabase
        .from('user_action_events')
        .select('from_action_id, created_at')
        .eq('user_id', userId)
        .eq('event_type', 'remove'),
      supabase
        .from('user_wellness_goals')
        .select('id, track_id, goal_slot, status, is_active, selected_at, created_at, coach_wellness_goals(goal_id)')
        .eq('user_id', userId),
      supabase
        .from('user_goal_events')
        .select('goal_slot, swapped_goal_id, swapped_out_goal_id, created_at')
        .eq('user_id', userId)
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: true })
    ]);

    // Build a map of action_id → removal date (earliest of deletion or remove event)
    const removalDateMap = new Map<string, Date>();
    if (deletions) {
      for (const d of deletions) {
        const dt = new Date(d.deleted_at);
        const existing = removalDateMap.get(d.original_action_id);
        if (!existing || dt < existing) removalDateMap.set(d.original_action_id, dt);
      }
    }
    if (removeEvents) {
      for (const e of removeEvents) {
        if (!e.from_action_id) continue;
        const dt = new Date(e.created_at);
        const existing = removalDateMap.get(e.from_action_id);
        if (!existing || dt < existing) removalDateMap.set(e.from_action_id, dt);
      }
    }

    // Filter to actions that were ACTIVE during period
    const allActiveActions = (allActions || []).filter(a => {
      const removedAt = removalDateMap.get(a.id);
      return existsDuringRange(a.created_at, removedAt, startDate, endDate);
    });

    // Further restrict to actions belonging to currently active goals only.
    // action_plans.goal_id stores coach_wellness_goals.goal_id (TEXT), not user_wellness_goals.id.
    // This mirrors the exact filter used in playbook.js fetchActionsForGoals.
    const activeCoachGoalIds = new Set(
      (allGoals || [])
        .filter((g: any) => g.is_active)
        .map((g: any) => (g.coach_wellness_goals as any)?.goal_id)
        .filter(Boolean)
    );
    const activeActions = activeCoachGoalIds.size > 0
      ? allActiveActions.filter(a => activeCoachGoalIds.has(a.goal_id))
      : allActiveActions;

    const goalsInRange = computeGoalsActiveInRange(
      goalEvents || [],
      allGoals || [],
      startDate,
      endDate
    );

    // Helper: extract category from coach_metadata JSONB (not a direct column)
    const getCategory = (action: any): string => {
      if (action.coach_metadata && typeof action.coach_metadata === 'object') {
        return action.coach_metadata.category || 'UNKNOWN';
      }
      return 'UNKNOWN';
    };

    // Calculate action_days_available per action
    const actionDaysMap = new Map<string, number>();
    for (const action of activeActions) {
      const actionStart = new Date(Math.max(new Date(action.created_at).getTime(), startDate.getTime()));
      const removedAt = removalDateMap.get(action.id);
      const actionEnd = removedAt ? new Date(Math.min(removedAt.getTime(), endDate.getTime())) : endDate;
      const daysActive = Math.max(1, Math.ceil((actionEnd.getTime() - actionStart.getTime()) / (1000 * 60 * 60 * 24)));
      actionDaysMap.set(action.id, daysActive);
    }

    const totalActionDaysAvailable = Array.from(actionDaysMap.values()).reduce((sum, d) => sum + d, 0);
    const actionsPlanned = activeActions.length;

    // ---------------------------------------------------------------
    // 2. Fetch completions in period with full fields
    // ---------------------------------------------------------------
    // Use logged_at for the range filter \u2014 it is explicitly set by log-action.ts
    // and has a dedicated index (idx_action_completions_logged_at).
    // created_at is the Postgres auto-fill DEFAULT but logged_at is the canonical
    // user-facing timestamp and cannot be truncated away by range-end rounding.
    const { data: completions } = await supabase
      .from('action_completions')
      .select('id, action_id, completed_at, created_at, completion_status, completion_percent, urge_before_0_10, urge_after_0_10, context, notes, logged_at')
      .eq('user_id', userId)
      .gte('logged_at', startDate.toISOString())
      .lte('logged_at', endDate.toISOString());

    // Separate done vs partial
    const allCompletions = completions || [];
    const doneCount = allCompletions.filter(c => c.completion_status !== 'partial').length;
    const partialCount = allCompletions.filter(c => c.completion_status === 'partial').length;
    const actionsLogged = allCompletions.length;

    // Completion quality: average of completion_percent (done=100 if null)
    const completionPercents = allCompletions.map(c => {
      if (c.completion_percent !== null && c.completion_percent !== undefined) return c.completion_percent;
      return c.completion_status === 'partial' ? 50 : 100;
    });
    const completionQualityAvg = completionPercents.length > 0
      ? Math.round(completionPercents.reduce((s, p) => s + p, 0) / completionPercents.length)
      : null;

    // Completion rate: opportunity-based (completions / action_days_available)
    const completionRate = totalActionDaysAvailable > 0
      ? Math.min(1, actionsLogged / totalActionDaysAvailable)
      : 0;

    // ---------------------------------------------------------------
    // 3. Urge metrics
    // ---------------------------------------------------------------
    let avgBefore: number | null = null;
    let avgAfter: number | null = null;
    let avgDrop: number | null = null;

    const urgeCompletions = allCompletions.filter(c =>
      c.urge_before_0_10 !== null && c.urge_after_0_10 !== null
    );

    if (urgeCompletions.length > 0) {
      avgBefore = urgeCompletions.reduce((sum, c) => sum + (c.urge_before_0_10 || 0), 0) / urgeCompletions.length;
      avgAfter = urgeCompletions.reduce((sum, c) => sum + (c.urge_after_0_10 || 0), 0) / urgeCompletions.length;
      avgDrop = avgBefore - avgAfter;
    }

    // ---------------------------------------------------------------
    // 4. Urge drops by category (using coach_metadata.category)
    // ---------------------------------------------------------------
    const categoryMap = new Map<string, { drops: number[]; completions: number; totalActions: number; completionPercents: number[] }>();

    // Build action ID → action lookup for completions
    const actionLookup = new Map(activeActions.map(a => [a.id, a]));

    for (const completion of allCompletions) {
      const action = actionLookup.get(completion.action_id);
      const category = action ? getCategory(action) : 'UNKNOWN';

      if (!categoryMap.has(category)) {
        categoryMap.set(category, { drops: [], completions: 0, totalActions: 0, completionPercents: [] });
      }

      const entry = categoryMap.get(category)!;
      entry.completions++;

      const pct = completion.completion_percent ?? (completion.completion_status === 'partial' ? 50 : 100);
      entry.completionPercents.push(pct);

      if (completion.urge_before_0_10 !== null && completion.urge_after_0_10 !== null) {
        entry.drops.push(completion.urge_before_0_10 - completion.urge_after_0_10);
      }
    }

    // Count total actions per category
    for (const action of activeActions) {
      const category = getCategory(action);
      if (!categoryMap.has(category)) {
        categoryMap.set(category, { drops: [], completions: 0, totalActions: 0, completionPercents: [] });
      }
      categoryMap.get(category)!.totalActions++;
    }

    const dropsByCategory = Array.from(categoryMap.entries())
      .map(([category, data]) => {
        const catAvgDrop = data.drops.length > 0
          ? data.drops.reduce((sum, d) => sum + d, 0) / data.drops.length
          : 0;
        const catCompletionRate = data.totalActions > 0 ? data.completions / data.totalActions : 0;

        return {
          category,
          avg_drop: Math.round(catAvgDrop * 10) / 10,
          count: data.drops.length,
          completion_rate: Math.round(catCompletionRate * 100) / 100
        };
      })
      .filter(cat => cat.count >= 1); // Include categories with at least 1 urge pair

    // ---------------------------------------------------------------
    // 5. Risk window from completion timestamps
    // ---------------------------------------------------------------
    const hourCounts = new Map<number, { count: number; signal: string }>();
    let timestampedLogs = 0;

    for (const completion of allCompletions) {
      const ts = completion.completed_at || completion.created_at;
      if (!ts) continue;
      timestampedLogs++;
      const hour = new Date(ts).getHours();
      if (!hourCounts.has(hour)) {
        hourCounts.set(hour, { count: 0, signal: 'activity' });
      }
      hourCounts.get(hour)!.count++;

      if (completion.urge_before_0_10 && completion.urge_before_0_10 >= 7) {
        hourCounts.get(hour)!.signal = 'urge_spike';
      }
    }

    const topHours = Array.from(hourCounts.entries())
      .map(([hour, data]) => ({ hour, count: data.count, signal: data.signal }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    let riskWindowLabel: string | null = null;
    if (topHours.length > 0) {
      const formatHour = (h: number) => {
        const ampm = h >= 12 ? 'pm' : 'am';
        const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
        return `${h12}${ampm}`;
      };
      const startHour = topHours[0].hour;
      const endHr = (startHour + 2) % 24;
      riskWindowLabel = `${formatHour(startHour)}–${formatHour(endHr)}`;
    }

    // ---------------------------------------------------------------
    // 6. Score tools by category
    // ---------------------------------------------------------------
    const toolCategories = dropsByCategory
      .map(cat => {
        const dropScore = cat.avg_drop > 0 ? Math.min(cat.avg_drop / 10, 1) : 0;
        const score = (dropScore * 0.5) + (cat.completion_rate * 0.5);

        let why = '';
        if (cat.avg_drop > 3) why = `drops urge by ${cat.avg_drop.toFixed(1)} points`;
        else if (cat.completion_rate > 0.7) why = `${Math.round(cat.completion_rate * 100)}% completion rate`;
        else why = `modest results`;

        return {
          category: cat.category,
          score: Math.round(score * 100) / 100,
          why,
          sample_size: cat.count
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    // ---------------------------------------------------------------
    // 7-8. Baselines (track + goal)
    // ---------------------------------------------------------------
    const [
      { data: trackBaseline, error: trackBaselineError },
      { data: goalBaseline }
    ] = await Promise.all([
      supabase
        .from('user_track_baselines')
        .select('*')
        .eq('user_id', userId)
        .eq('track_id', trackId)
        .maybeSingle(),
      supabase
        .from('user_goal_baselines')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    ]);

    if (trackBaselineError) {
      console.warn('⚠️ Track baseline fetch error:', trackBaselineError);
    }

    // ---------------------------------------------------------------
    // 9. Slip data: merge progress table (legacy) + slip_events (new)
    // ---------------------------------------------------------------
    const [{ data: progressLogs }, { data: slipEventRows }] = await Promise.all([
      supabase
        .from('progress')
        .select('logged_at, slip_count, status')
        .eq('user_id', userId)
        .gte('logged_at', startDate.toISOString())
        .lte('logged_at', endDate.toISOString()),
      // Guard: slip_events may not exist in all environments
      supabase
        .from('slip_events')
        .select('slipped_at')
        .eq('user_id', userId)
        .gte('slipped_at', startDate.toISOString())
        .lte('slipped_at', endDate.toISOString())
        .order('slipped_at', { ascending: false })
    ]);

    let slipCount = 0;
    const slipDays = new Map<string, number>();

    if (progressLogs) {
      for (const log of progressLogs) {
        const count = log.slip_count || (log.status === 'slip' || log.status === 'relapse' ? 1 : 0);
        slipCount += count;
        if (count > 0) {
          const date = log.logged_at?.split('T')[0];
          slipDays.set(date, (slipDays.get(date) || 0) + count);
        }
      }
    }

    // Merge slip_events rows (deduplicate by day)
    let lastSlipAt: string | null = null;
    if (slipEventRows && slipEventRows.length > 0) {
      slipCount += slipEventRows.length;
      for (const row of slipEventRows) {
        const date = row.slipped_at?.split('T')[0];
        if (date) slipDays.set(date, (slipDays.get(date) || 0) + 1);
      }
      lastSlipAt = slipEventRows[0].slipped_at; // already ordered DESC
    }

    const totalSlipDays = slipDays.size;
    const multiSlipDays = Array.from(slipDays.values()).filter(count => count > 1).length;
    const secondSessionRate = totalSlipDays >= 3
      ? Math.round((multiSlipDays / totalSlipDays) * 100)
      : null;

    // ---------------------------------------------------------------
    // 10. Confidence + meta
    // ---------------------------------------------------------------
    const hasEnoughData = actionsLogged >= 3 && actionsPlanned >= 1;

    // ---------------------------------------------------------------
    // 11. Support sessions in period
    // ---------------------------------------------------------------
    const { data: supportSessionRows } = await supabase
      .from('support_sessions')
      .select('pre_urge_intensity, post_urge_rating, context, created_at')
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    const sessionRows = supportSessionRows || [];
    const sessionCount = sessionRows.length;
    const sessionWithRatings = sessionRows.filter(
      (s: any) => s.pre_urge_intensity !== null && s.post_urge_rating !== null
    );
    let supportAvgPre: number | null = null;
    let supportAvgPost: number | null = null;
    let supportAvgDrop: number | null = null;
    if (sessionWithRatings.length > 0) {
      supportAvgPre = sessionWithRatings.reduce((s: number, r: any) => s + r.pre_urge_intensity, 0) / sessionWithRatings.length;
      supportAvgPost = sessionWithRatings.reduce((s: number, r: any) => s + r.post_urge_rating, 0) / sessionWithRatings.length;
      supportAvgDrop = supportAvgPre - supportAvgPost;
    }

    const urgeConfidence: 'high' | 'medium' | 'low' | 'none' =
      urgeCompletions.length >= 10 ? 'high' :
      urgeCompletions.length >= 5 ? 'medium' :
      urgeCompletions.length >= 1 ? 'low' : 'none';

    const riskWindowConfidence: 'high' | 'medium' | 'low' | 'none' =
      timestampedLogs >= RISK_LOGS_HIGH_MIN ? 'high' :
      timestampedLogs >= RISK_LOGS_MEDIUM_MIN ? 'medium' :
      timestampedLogs >= 1 ? 'low' : 'none';

    return {
      range: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        label: daysDiff <= 7 ? 'last_7_days' : daysDiff <= 30 ? 'last_30_days' : 'custom',
        days: daysDiff
      },
      activity: {
        actions_planned: actionsPlanned,
        actions_logged: actionsLogged,
        done_count: doneCount,
        partial_count: partialCount,
        completion_rate: Math.round(completionRate * 100) / 100,
        action_days_available: totalActionDaysAvailable,
        completion_quality_avg: completionQualityAvg
      },
      urge: {
        avg_before: avgBefore !== null ? Math.round(avgBefore * 10) / 10 : null,
        avg_after: avgAfter !== null ? Math.round(avgAfter * 10) / 10 : null,
        avg_drop: avgDrop !== null ? Math.round(avgDrop * 10) / 10 : null,
        drops_by_category: dropsByCategory,
        confidence: urgeConfidence
      },
      risk_window: {
        top_hours: topHours,
        label: riskWindowLabel,
        confidence: riskWindowConfidence
      },
      tools: {
        best_categories: toolCategories
      },
      baselines: {
        track: trackBaseline || null,
        goal: goalBaseline || null
      },
      slips: {
        slip_count: slipCount,
        days_with_slips: totalSlipDays,
        last_slip_at: lastSlipAt,
        second_session_rate: secondSessionRate
      },
      support_sessions: {
        count: sessionCount,
        avg_pre_urge: supportAvgPre !== null ? Math.round(supportAvgPre * 10) / 10 : null,
        avg_post_urge: supportAvgPost !== null ? Math.round(supportAvgPost * 10) / 10 : null,
        avg_urge_drop: supportAvgDrop !== null ? Math.round(supportAvgDrop * 10) / 10 : null
      },
      meta: {
        has_enough_data: hasEnoughData,
        sample_sizes: {
          completions: actionsLogged,
          actions: actionsPlanned,
          goals_active: goalsInRange.goals_active_count,
          slips: slipCount,
          urge_pairs: urgeCompletions.length,
          timestamped_logs: timestampedLogs
        }
      }
    };
  } catch (error) {
    console.error('Error fetching insight metrics:', error);
    return {
      range: { start: startDate.toISOString(), end: endDate.toISOString(), label: 'error', days: 0 },
      activity: { actions_planned: 0, actions_logged: 0, done_count: 0, partial_count: 0, completion_rate: 0, action_days_available: 0, completion_quality_avg: null },
      urge: { avg_before: null, avg_after: null, avg_drop: null, drops_by_category: [], confidence: 'none' as const },
      risk_window: { top_hours: [], label: null, confidence: 'none' as const },
      tools: { best_categories: [] },
      baselines: { track: null, goal: null },
      slips: { slip_count: 0, days_with_slips: 0, last_slip_at: null, second_session_rate: null },
      support_sessions: { count: 0, avg_pre_urge: null, avg_post_urge: null, avg_urge_drop: null },
      meta: { has_enough_data: false, sample_sizes: { completions: 0, actions: 0, goals_active: 0, slips: 0, urge_pairs: 0, timestamped_logs: 0 } }
    };
  }
}

/**
 * Get existing action titles for a goal to prevent AI from generating duplicates
 */
async function getExistingActionTitles(
  supabase: SupabaseClient,
  userId: string,
  goalId?: string
): Promise<string[]> {
  try {
    let query = supabase
      .from('action_plans')
      .select('action_text')
      .eq('user_id', userId);
    
    if (goalId) {
      query = query.eq('goal_id', goalId);
    }

    const { data } = await query;
    return data?.map(a => a.action_text).filter(Boolean) || [];
  } catch (error) {
    console.error('Error fetching existing actions:', error);
    return [];
  }
}

/**
 * Build context for INSIGHT generation
 */
export async function buildInsightContext(
  supabase: SupabaseClient,
  user: BaseUserData
): Promise<InsightContext | null> {
  const severityContext = await getUserSeverityContext(supabase, user.id);
  if (!severityContext) return null;

  // Get last 7 days action stats using the exact same logic the playbook uses:
  // 1. Fetch active user_wellness_goals joined with coach_wellness_goals to get goal_id
  // 2. Filter action_plans by those coach_wellness_goals.goal_id values (TEXT field)
  // This is identical to how fetchActionsForGoals works in playbook.js
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data: activeGoalRows } = await supabase
    .from('user_wellness_goals')
    .select('id, coach_wellness_goals(goal_id)')
    .eq('user_id', user.id)
    .eq('is_active', true);

  // Collect the coach_wellness_goals.goal_id values — this is what action_plans.goal_id stores
  const activeCoachGoalIds = (activeGoalRows || [])
    .map((g: any) => g.coach_wellness_goals?.goal_id)
    .filter(Boolean);

  let actionPlansQuery = supabase
    .from('action_plans')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_complete', false)
    .eq('is_active', true);  // A2: is_active column is the data-driven cap (max 3/goal)

  if (activeCoachGoalIds.length > 0) {
    actionPlansQuery = actionPlansQuery.in('goal_id', activeCoachGoalIds);
  } else {
    // No active goals → no actions to count
    actionPlansQuery = actionPlansQuery.in('goal_id', ['__none__']);
  }

  const { count: last7DaysActionsCount } = await actionPlansQuery;
  const last7DaysActions = last7DaysActionsCount || 0;

  const { count: last7DaysCompletions } = await supabase
    .from('action_completions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('logged_at', sevenDaysAgo.toISOString());

  // TODO: Add risk window analysis (would require completed_at timestamps)
  // For now, we'll pass undefined and let prompt handle it
  const riskWindowData = undefined;

  // Get most common action categories from completed actions (if action_text has patterns)
  const bestTools = undefined; // Could be enhanced later

  return {
    firstName: user.first_name,
    ...severityContext,
    last7DaysActions: last7DaysActions || 0,
    last7DaysCompletions: last7DaysCompletions || 0,
    riskWindowData,
    bestTools
  };
}

/**
 * Build compact user metrics JSON string for AI prompts
 * Keeps token usage low while providing key recovery data
 */
export function buildCompactUserMetrics(recoveryMetrics: {
  last30DaysSlips?: number;
  secondSessionRate?: number;
  recentSlipToday?: boolean;
  currentStreak?: number;
  commonRiskWindow?: string;
  topTrigger?: string;
}): string {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Calculate binge days (rough estimate: if slips > 15 in 30d, assume ~4 binge days)
  const bingeDays = recoveryMetrics.last30DaysSlips 
    ? Math.floor((recoveryMetrics.last30DaysSlips || 0) / 4)
    : 0;

  const metrics = {
    streak_days: recoveryMetrics.currentStreak || 0,
    slips_7d: undefined, // Could be calculated from progress table
    slips_30d: recoveryMetrics.last30DaysSlips || 0,
    binge_days_30d: bingeDays,
    common_risk_window: recoveryMetrics.commonRiskWindow || undefined,
    common_location: undefined, // Could be enhanced with context data
    common_pathway: undefined, // Could be enhanced with pathway tracking
    second_session_rate_30d: recoveryMetrics.secondSessionRate 
      ? (recoveryMetrics.secondSessionRate / 100) 
      : undefined,
    post_slip_shame_1_5: undefined, // Could be added via user survey
    top_trigger: recoveryMetrics.topTrigger || undefined,
    primary_device: 'phone' // Default assumption
  };

  // Remove undefined values to keep JSON compact
  const compact = Object.fromEntries(
    Object.entries(metrics).filter(([_, v]) => v !== undefined)
  );

  return JSON.stringify(compact);
}
