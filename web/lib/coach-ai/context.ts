/**
 * Context builder - fetches user data from Supabase to personalize Coach AI outputs
 */
import { SupabaseClient } from '@supabase/supabase-js';
import { UserContext, GoalContext, ActionContext, InsightContext } from './prompts';
import { classifyGoalArchetype, selectCategoriesForGeneration } from './archetypes';


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
 */
export async function getInsightMetrics(
  supabase: SupabaseClient,
  userId: string,
  trackId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  range: { start: string; end: string; label: string; days: number };
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
    drops_by_category: Array<{ category: string; avg_drop: number; count: number; completion_rate: number }>;
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
    sample_sizes: { completions: number; actions: number; slips: number };
  };
}> {
  try {
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    // 1. Fetch action plans created in this period
    const { data: actionPlans, count: actionsPlanned } = await supabase
      .from('action_plans')
      .select('id, action_text, category', { count: 'exact' })
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    // 2. Fetch completion logs with urge data
    const { data: completions, count: actionsLogged } = await supabase
      .from('action_completions')
      .select('id, action_id, completed_at, urge_before_0_10, urge_after_0_10, context, created_at', { count: 'exact' })
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    // Calculate counts
    const doneCount = completions?.length || 0;
    const partialCount = 0; // Would need completion_status field
    const completionRate = actionsPlanned && actionsPlanned > 0 ? doneCount / actionsPlanned : 0;

    // 3. Compute urge metrics
    let avgBefore: number | null = null;
    let avgAfter: number | null = null;
    let avgDrop: number | null = null;

    if (completions && completions.length > 0) {
      const urgeCompletions = completions.filter(c => 
        c.urge_before_0_10 !== null && c.urge_after_0_10 !== null
      );

      if (urgeCompletions.length > 0) {
        avgBefore = urgeCompletions.reduce((sum, c) => sum + (c.urge_before_0_10 || 0), 0) / urgeCompletions.length;
        avgAfter = urgeCompletions.reduce((sum, c) => sum + (c.urge_after_0_10 || 0), 0) / urgeCompletions.length;
        avgDrop = avgBefore - avgAfter;
      }
    }

    // 4. Compute urge drops by category
    const categoryMap = new Map<string, { drops: number[]; completions: number; totalActions: number }>();
    
    if (completions && actionPlans) {
      for (const completion of completions) {
        if (completion.urge_before_0_10 !== null && completion.urge_after_0_10 !== null) {
          const action = actionPlans.find(a => a.id === completion.action_id);
          const category = action?.category || 'UNKNOWN';
          
          if (!categoryMap.has(category)) {
            categoryMap.set(category, { drops: [], completions: 0, totalActions: 0 });
          }
          
          const drop = completion.urge_before_0_10 - completion.urge_after_0_10;
          categoryMap.get(category)!.drops.push(drop);
          categoryMap.get(category)!.completions++;
        }
      }

      // Count total actions per category
      for (const action of actionPlans) {
        const category = action.category || 'UNKNOWN';
        if (!categoryMap.has(category)) {
          categoryMap.set(category, { drops: [], completions: 0, totalActions: 0 });
        }
        categoryMap.get(category)!.totalActions++;
      }
    }

    const dropsByCategory = Array.from(categoryMap.entries())
      .map(([category, data]) => {
        const avgDrop = data.drops.length > 0 
          ? data.drops.reduce((sum, d) => sum + d, 0) / data.drops.length 
          : 0;
        const completionRate = data.totalActions > 0 ? data.completions / data.totalActions : 0;
        
        return {
          category,
          avg_drop: Math.round(avgDrop * 10) / 10,
          count: data.drops.length,
          completion_rate: Math.round(completionRate * 100) / 100
        };
      })
      .filter(cat => cat.count >= 2); // Only include categories with enough data

    // 5. Compute risk window from completion timestamps
    const hourCounts = new Map<number, { count: number; signal: string }>();
    
    if (completions) {
      for (const completion of completions) {
        const hour = new Date(completion.created_at).getHours();
        if (!hourCounts.has(hour)) {
          hourCounts.set(hour, { count: 0, signal: 'activity' });
        }
        hourCounts.get(hour)!.count++;
        
        // Mark as urge_spike if high urge before
        if (completion.urge_before_0_10 && completion.urge_before_0_10 >= 7) {
          hourCounts.get(hour)!.signal = 'urge_spike';
        }
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
      const endHour = (startHour + 2) % 24;
      riskWindowLabel = `${formatHour(startHour)}–${formatHour(endHour)}`;
    }

    // 6. Score tools by category
    const toolCategories = dropsByCategory
      .map(cat => {
        // Score = (normalized urge drop * 0.5) + (completion rate * 0.5)
        const dropScore = cat.avg_drop > 0 ? Math.min(cat.avg_drop / 10, 1) : 0;
        const score = (dropScore * 0.5) + (cat.completion_rate * 0.5);
        
        let why = '';
        if (cat.avg_drop > 3) why = `drops urge by ${cat.avg_drop.toFixed(1)} points`;
        else if (cat.completion_rate > 0.7) why = `${Math.round(cat.completion_rate * 100)}% completion rate`;
        else why = `modest results`;
        
        return {
          category: cat.category,
          score: Math.round(score * 100) / 100,
          why
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    // 7. Fetch track baseline
    const { data: trackBaseline, error: trackBaselineError } = await supabase
      .from('user_track_baselines')
      .select('*')
      .eq('user_id', userId)
      .eq('track_id', trackId)
      .maybeSingle();

    console.log('🎯 Track baseline fetch:', {
      userId,
      trackId,
      trackBaseline,
      trackBaselineError
    });

    // 8. Fetch most recent goal baseline (if any)
    const { data: goalBaseline } = await supabase
      .from('user_goal_baselines')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // 9. Fetch slip data from progress table
    const { data: progressLogs } = await supabase
      .from('progress')
      .select('logged_at, slip_count, status')
      .eq('user_id', userId)
      .gte('logged_at', startDate.toISOString())
      .lte('logged_at', endDate.toISOString());

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

    const totalSlipDays = slipDays.size;
    const multiSlipDays = Array.from(slipDays.values()).filter(count => count > 1).length;
    const secondSessionRate = totalSlipDays >= 3 
      ? Math.round((multiSlipDays / totalSlipDays) * 100)
      : null;

    // 10. Determine if we have enough data
    const hasEnoughData = (completions?.length || 0) >= 3 && (actionsPlanned || 0) >= 3;

    return {
      range: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        label: daysDiff <= 7 ? 'last_7_days' : daysDiff <= 30 ? 'last_30_days' : 'custom',
        days: daysDiff
      },
      activity: {
        actions_planned: actionsPlanned || 0,
        actions_logged: actionsLogged || 0,
        done_count: doneCount,
        partial_count: partialCount,
        completion_rate: Math.round(completionRate * 100) / 100
      },
      urge: {
        avg_before: avgBefore !== null ? Math.round(avgBefore * 10) / 10 : null,
        avg_after: avgAfter !== null ? Math.round(avgAfter * 10) / 10 : null,
        avg_drop: avgDrop !== null ? Math.round(avgDrop * 10) / 10 : null,
        drops_by_category: dropsByCategory
      },
      risk_window: {
        top_hours: topHours,
        label: riskWindowLabel
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
        second_session_rate: secondSessionRate
      },
      meta: {
        has_enough_data: hasEnoughData,
        sample_sizes: {
          completions: completions?.length || 0,
          actions: actionsPlanned || 0,
          slips: slipCount
        }
      }
    };

    console.log('📊 Metrics baselines being returned:', {
      track: trackBaseline || null,
      goal: goalBaseline || null
    });

    return metrics;
  } catch (error) {
    console.error('Error fetching insight metrics:', error);
    // Return safe defaults
    return {
      range: { start: startDate.toISOString(), end: endDate.toISOString(), label: 'error', days: 0 },
      activity: { actions_planned: 0, actions_logged: 0, done_count: 0, partial_count: 0, completion_rate: 0 },
      urge: { avg_before: null, avg_after: null, avg_drop: null, drops_by_category: [] },
      risk_window: { top_hours: [], label: null },
      tools: { best_categories: [] },
      baselines: { track: null, goal: null },
      slips: { slip_count: 0, second_session_rate: null },
      meta: { has_enough_data: false, sample_sizes: { completions: 0, actions: 0, slips: 0 } }
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

  // Get last 7 days action stats
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { count: last7DaysActions } = await supabase
    .from('action_plans')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', sevenDaysAgo.toISOString());

  const { count: last7DaysCompletions } = await supabase
    .from('action_plans')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_complete', true)
    .gte('created_at', sevenDaysAgo.toISOString());

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
