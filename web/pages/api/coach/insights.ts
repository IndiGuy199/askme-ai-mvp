/**
 * POST /api/coach/insights
 * Generate weekly insights and next-week planning (deterministic — no AI model call).
 * Uses getInsightMetrics for real data + deriveWeeklyBullets for computed bullets.
 */
import { createClient } from '@supabase/supabase-js';
import { buildInsightContext, getInsightMetrics } from '../../../lib/coach-ai/context';
import { deriveWeeklyBullets } from '../../../lib/coach-ai/prompts';

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

    // Build context to get challengeId (still needed for response field)
    const context = await buildInsightContext(supabase, user);
    if (!context) {
      return res.status(400).json({ error: 'Unable to build context. Complete onboarding first.' });
    }

    console.log('🎯 Deriving weekly insights for:', { userId: user.id, challenge: context.challengeLabel });

    // Fetch 7-day metrics — same function the detailed report uses
    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setUTCDate(startDate.getUTCDate() - 7);

    const metrics = await getInsightMetrics(supabase, user.id, 'porn_recovery', startDate, endDate);

    // Derive bullets deterministically — no AI call needed
    const responseData = deriveWeeklyBullets(metrics, context.challengeId);

    // Deduct tokens (flat cost for the analysis operation)
    await supabase
      .from('users')
      .update({ tokens: user.tokens - INSIGHT_GENERATION_TOKEN_COST })
      .eq('id', user.id);

    // Log usage (0 model tokens since deterministic)
    await supabase.from('coach_ai_usage_logs').insert({
      user_id: user.id,
      kind: 'insights',
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: INSIGHT_GENERATION_TOKEN_COST,
      success: true,
      error_message: null
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
