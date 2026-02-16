/**
 * POST /api/coach/goals
 * Generate personalized recovery goals based on user's assessment data
 * SEPARATE from chat system
 */
import { createClient } from '@supabase/supabase-js';
import { buildGoalContext, buildCompactUserMetrics, getRecoveryMetrics } from '../../../lib/coach-ai/context';
import { buildGoalPrompt, PORN_RECOVERY_SYSTEM_PROMPT } from '../../../lib/coach-ai/prompts';
import { GoalResponseSchema } from '../../../lib/coach-ai/schema';
import { generateStructuredOutput, getFallbackGoals } from '../../../lib/coach-ai/client';
import { selectArchetypesForGeneration, classifyGoalArchetype } from '../../../lib/coach-ai/archetypes';
import { checkGoalAlignment, buildRetryPrompt } from '../../../lib/coach-ai/alignment';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

const GOAL_GENERATION_TOKEN_COST = 100; // Cost in user tokens

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, seedGoalTitle, seedGoalDescription } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    // Get user
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, first_name, email, tokens')
      .eq('email', email)
      .single();

    if (userError || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check token balance
    if (user.tokens < GOAL_GENERATION_TOKEN_COST) {
      return res.status(403).json({
        error: 'Insufficient tokens',
        required: GOAL_GENERATION_TOKEN_COST,
        available: user.tokens
      });
    }

    // Build context from assessments
    let context = await buildGoalContext(supabase, user);
    
    // If context building fails, create a minimal fallback context
    if (!context) {
      console.warn('⚠️ Context building failed for goals, using fallback');
      context = {
        firstName: user.first_name || 'User',
        challengeId: 'porn_addiction',
        challengeLabel: 'Pornography Addiction',
        severity: 'growing',
        timeframeDays: 30,
        signals: undefined,
        completionRate: undefined,
        existingGoals: []
      };
    }

    // Get recovery metrics for archetype selection
    const recoveryMetrics = await getRecoveryMetrics(supabase, user.id);
    
    // Build compact metrics JSON
    const userMetricsCompact = buildCompactUserMetrics(recoveryMetrics);
    
    // Get existing goals with archetypes
    const { data: existingGoals } = await supabase
      .from('user_wellness_goals')
      .select(`
        coach_wellness_goals (
          goal_id,
          label,
          archetype
        )
      `)
      .eq('user_id', user.id);

    const existingGoalsFormatted = existingGoals?.map(g => {
      const goalData = Array.isArray(g.coach_wellness_goals) 
        ? g.coach_wellness_goals[0] 
        : g.coach_wellness_goals;
      return {
        goal_id: goalData?.goal_id,
        label: goalData?.label,
        archetype: goalData?.archetype || classifyGoalArchetype(goalData?.label || '')
      };
    }).filter(Boolean) || [];

    // Map recovery metrics to UserMetrics interface for archetype selection
    const userMetricsForArchetypes = {
      second_session_rate_30d: recoveryMetrics.secondSessionRate ? recoveryMetrics.secondSessionRate / 100 : undefined,
      common_risk_window: recoveryMetrics.commonRiskWindow,
      common_location: undefined, // Not tracked yet
      common_pathway: undefined, // Not tracked yet
      top_trigger: recoveryMetrics.topTrigger
    };

    // Select 3 archetypes for this generation
    const allowedArchetypes = selectArchetypesForGeneration(
      existingGoalsFormatted,
      userMetricsForArchetypes
    );

    // Enhance context with new fields
    context.existingGoals = existingGoalsFormatted;
    context.allowedArchetypes = allowedArchetypes;
    context.userMetricsCompact = userMetricsCompact;
    context.seedGoalTitle = seedGoalTitle || undefined;
    context.seedGoalDescription = seedGoalDescription || undefined;

    console.log('🎯 Generating goals for:', { 
      userId: user.id, 
      severity: context.severity,
      challenge: context.challengeLabel,
      allowedArchetypes,
      existingGoalsCount: existingGoalsFormatted.length,
      hasSeed: !!(seedGoalTitle || seedGoalDescription)
    });

    // Generate goals via Coach AI with porn recovery system prompt
    let prompt = buildGoalPrompt(context);
    let result = await generateStructuredOutput(
      PORN_RECOVERY_SYSTEM_PROMPT,
      prompt,
      GoalResponseSchema,
      'gpt-4o-mini'
    );

    // Check alignment if seed text exists
    const hasSeed = seedGoalTitle || seedGoalDescription;
    if (hasSeed && result.success && result.data?.goals) {
      const alignment = checkGoalAlignment(
        seedGoalTitle,
        seedGoalDescription,
        result.data.goals as Array<{ label: string; description?: string }>
      );

      console.log('🎯 Goal alignment check:', alignment);

      // If alignment failed, retry once with additional instructions
      if (!alignment.aligned) {
        console.warn('⚠️ Goal alignment failed, retrying with stricter prompt');
        const seedText = `${seedGoalTitle || ''} ${seedGoalDescription || ''}`.trim();
        const retryPrompt = buildRetryPrompt(prompt, seedText, alignment.reason || 'Outputs did not match seed intent');
        
        result = await generateStructuredOutput(
          PORN_RECOVERY_SYSTEM_PROMPT,
          retryPrompt,
          GoalResponseSchema,
          'gpt-4o-mini'
        );

        // Log retry result
        if (result.success && result.data?.goals) {
          const retryAlignment = checkGoalAlignment(
            seedGoalTitle,
            seedGoalDescription,
            result.data.goals as Array<{ label: string; description?: string }>
          );
          console.log('🎯 Retry alignment check:', retryAlignment);
        }
      }
    }

    let responseData;
    let actualTokens = 0;

    if (result.success && result.data) {
      responseData = result.data;
      actualTokens = result.usage?.totalTokens || 0;
    } else {
      console.warn('⚠️ Model failed, using fallback goals');
      responseData = getFallbackGoals(context.challengeId, context.severity);
      actualTokens = GOAL_GENERATION_TOKEN_COST; // Charge anyway for the attempt
    }

    // Deduct tokens
    const { error: tokenError } = await supabase
      .from('users')
      .update({ tokens: user.tokens - GOAL_GENERATION_TOKEN_COST })
      .eq('id', user.id);

    if (tokenError) {
      console.error('Token deduction error:', tokenError);
    }

    // Log usage
    await supabase.from('coach_ai_usage_logs').insert({
      user_id: user.id,
      kind: 'goals',
      prompt_tokens: result.usage?.promptTokens || 0,
      completion_tokens: result.usage?.completionTokens || 0,
      total_tokens: actualTokens,
      success: result.success,
      error_message: result.error || null
    });

    return res.status(200).json({
      ...responseData,
      tokens_used: GOAL_GENERATION_TOKEN_COST,
      tokens_remaining: user.tokens - GOAL_GENERATION_TOKEN_COST
    });

  } catch (error: any) {
    console.error('❌ Goal generation error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
