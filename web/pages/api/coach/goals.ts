/**
 * POST /api/coach/goals
 * Generate personalized recovery goals based on user's assessment data
 * SEPARATE from chat system
 */
import { createClient } from '@supabase/supabase-js';
import { buildGoalContext } from '../../../lib/coach-ai/context';
import { buildGoalPrompt } from '../../../lib/coach-ai/prompts';
import { GoalResponseSchema } from '../../../lib/coach-ai/schema';
import { generateStructuredOutput, getFallbackGoals } from '../../../lib/coach-ai/client';

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
    const { email } = req.body;

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

    console.log('🎯 Generating goals for:', { 
      userId: user.id, 
      severity: context.severity,
      challenge: context.challengeLabel 
    });

    // Generate goals via Coach AI
    const prompt = buildGoalPrompt(context);
    const result = await generateStructuredOutput(
      'You are a recovery coach generating personalized wellness goals.',
      prompt,
      GoalResponseSchema,
      'gpt-4o-mini'
    );

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
