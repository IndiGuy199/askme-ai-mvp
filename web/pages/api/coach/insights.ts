/**
 * POST /api/coach/insights
 * Generate weekly insights and next-week planning
 * SEPARATE from chat system
 */
import { createClient } from '@supabase/supabase-js';
import { buildInsightContext } from '../../../lib/coach-ai/context';
import { buildInsightPrompt } from '../../../lib/coach-ai/prompts';
import { InsightResponseSchema } from '../../../lib/coach-ai/schema';
import { generateStructuredOutput, getFallbackInsights } from '../../../lib/coach-ai/client';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

const INSIGHT_GENERATION_TOKEN_COST = 100;

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

    // Check tokens
    if (user.tokens < INSIGHT_GENERATION_TOKEN_COST) {
      return res.status(403).json({
        error: 'Insufficient tokens',
        required: INSIGHT_GENERATION_TOKEN_COST,
        available: user.tokens
      });
    }

    // Build context
    const context = await buildInsightContext(supabase, user);
    if (!context) {
      return res.status(400).json({ error: 'Unable to build context. Complete onboarding first.' });
    }

    console.log('🎯 Generating insights for:', {
      userId: user.id,
      challenge: context.challengeLabel,
      last7Days: `${context.last7DaysCompletions}/${context.last7DaysActions}`
    });

    // Generate insights
    const prompt = buildInsightPrompt(context);
    const result = await generateStructuredOutput(
      'You are a recovery coach generating weekly insights.',
      prompt,
      InsightResponseSchema,
      'gpt-4o-mini'
    );

    let responseData;
    let actualTokens = 0;

    if (result.success && result.data) {
      responseData = result.data;
      actualTokens = result.usage?.totalTokens || 0;
    } else {
      console.warn('⚠️ Model failed, using fallback insights');
      responseData = getFallbackInsights(context.challengeId);
      actualTokens = INSIGHT_GENERATION_TOKEN_COST;
    }

    // Deduct tokens
    await supabase
      .from('users')
      .update({ tokens: user.tokens - INSIGHT_GENERATION_TOKEN_COST })
      .eq('id', user.id);

    // Log usage
    await supabase.from('coach_ai_usage_logs').insert({
      user_id: user.id,
      kind: 'insights',
      prompt_tokens: result.usage?.promptTokens || 0,
      completion_tokens: result.usage?.completionTokens || 0,
      total_tokens: actualTokens,
      success: result.success,
      error_message: result.error || null
    });

    return res.status(200).json({
      ...responseData,
      tokens_used: INSIGHT_GENERATION_TOKEN_COST,
      tokens_remaining: user.tokens - INSIGHT_GENERATION_TOKEN_COST
    });

  } catch (error: any) {
    console.error('❌ Insight generation error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
