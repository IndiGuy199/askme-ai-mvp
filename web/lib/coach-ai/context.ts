/**
 * Context builder - fetches user data from Supabase to personalize Coach AI outputs
 */
import { SupabaseClient } from '@supabase/supabase-js';
import { UserContext, GoalContext, ActionContext, InsightContext } from './prompts';

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
 */
export async function buildActionContext(
  supabase: SupabaseClient,
  user: BaseUserData,
  goalIdOrDetails: string | { label: string; description?: string }
): Promise<ActionContext | null> {
  const severityContext = await getUserSeverityContext(supabase, user.id);
  if (!severityContext) return null;

  const completionRate = await getCompletionRate(supabase, user.id, 30);

  let goalLabel: string;
  let goalDescription: string | undefined;

  // Check if goal details provided directly (unsaved goal)
  if (typeof goalIdOrDetails === 'object') {
    goalLabel = goalIdOrDetails.label;
    goalDescription = goalIdOrDetails.description;
  } else {
    // Lookup goal from database
    const { data: goal, error: goalError } = await supabase
      .from('coach_wellness_goals')
      .select('label, description, goal_id')
      .eq('goal_id', goalIdOrDetails)
      .single();

    if (goalError || !goal) {
      console.error('Goal not found:', goalIdOrDetails);
      return null;
    }

    goalLabel = goal.label;
    goalDescription = goal.description;
  }

  return {
    firstName: user.first_name,
    ...severityContext,
    completionRate,
    goalId: typeof goalIdOrDetails === 'string' ? goalIdOrDetails : undefined,
    goalLabel,
    goalDescription: goalDescription || ''
  };
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
