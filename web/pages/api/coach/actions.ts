/**
 * POST /api/coach/actions
 * Generate personalized micro-actions for a specific goal
 * SEPARATE from chat system
 */
import { createClient } from '@supabase/supabase-js';
import { buildActionContext } from '../../../lib/coach-ai/context';
import { buildActionPrompt, PORN_RECOVERY_SYSTEM_PROMPT } from '../../../lib/coach-ai/prompts';
import { ActionResponseSchema } from '../../../lib/coach-ai/schema';
import { generateStructuredOutput, getFallbackActions } from '../../../lib/coach-ai/client';
import { checkActionAlignment, buildRetryPrompt } from '../../../lib/coach-ai/alignment';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

const ACTION_GENERATION_TOKEN_COST = 200;

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, goalId, goalLabel, goalDescription, goalType, seedActionText } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    // Need either goalId OR goalLabel for unsaved goals
    if (!goalId && !goalLabel) {
      return res.status(400).json({ error: 'Either goalId or goalLabel required' });
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
    if (user.tokens < ACTION_GENERATION_TOKEN_COST) {
      return res.status(403).json({
        error: 'Insufficient tokens',
        required: ACTION_GENERATION_TOKEN_COST,
        available: user.tokens
      });
    }

    // Always pass goal label for context, goalId is optional for enrichment
    // Pass goalType so prompt can be track-specific
    const goalParam = { label: goalLabel, description: goalDescription, goalType: goalType };
    let context = await buildActionContext(supabase, user, goalParam);
    
    // If context building fails, create a minimal fallback context
    if (!context) {
      console.warn('⚠️ Context building failed, using fallback context');
      context = {
        firstName: user.first_name || 'User',
        challengeId: 'porn_addiction',
        challengeLabel: 'Pornography Addiction',
        severity: 'growing',
        timeframeDays: 30,
        signals: undefined,
        completionRate: undefined,
        goalId: 'custom_goal',
        goalLabel: goalLabel,
        goalDescription: goalDescription,
        goalType: goalType || 'track',
        goalArchetype: 'BEDTIME_RISK_WINDOW', // fallback archetype
        allowedCategories: ['DEVICE_FRICTION', 'TIME_PROTOCOL', 'URGE_INTERRUPT']
      };
    }

    // Add seed text to context
    context.seedActionText = seedActionText || undefined;

    console.log('🎯 Generating actions for:', {
      userId: user.id,
      goalLabel: context.goalLabel,
      goalArchetype: context.goalArchetype,
      allowedCategories: context.allowedCategories,
      hasSeed: !!seedActionText
    });

    // Generate actions via Coach AI with porn recovery system prompt
    let prompt = buildActionPrompt(context);
    let result = await generateStructuredOutput(
      PORN_RECOVERY_SYSTEM_PROMPT,
      prompt,
      ActionResponseSchema,
      'gpt-4o-mini'
    );

    // Check alignment if seed text exists
    const hasSeed = seedActionText && seedActionText.trim().length > 0;
    if (hasSeed && result.success && result.data?.actions) {
      const alignment = checkActionAlignment(
        seedActionText,
        result.data.actions as Array<{ title: string; ai_note?: string }>
      );

      console.log('🎯 Action alignment check:', alignment);

      // If alignment failed, retry once with additional instructions
      if (!alignment.aligned) {
        console.warn('⚠️ Action alignment failed, retrying with stricter prompt');
        const retryPrompt = buildRetryPrompt(prompt, seedActionText!, alignment.reason || 'Outputs did not match seed intent');
        
        result = await generateStructuredOutput(
          PORN_RECOVERY_SYSTEM_PROMPT,
          retryPrompt,
          ActionResponseSchema,
          'gpt-4o-mini'
        );

        // Log retry result
        if (result.success && result.data?.actions) {
          const retryAlignment = checkActionAlignment(
            seedActionText,
            result.data.actions as Array<{ title: string; ai_note?: string }>
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
      console.warn('⚠️ Model failed, using fallback actions');
      responseData = getFallbackActions(goalId);
      actualTokens = ACTION_GENERATION_TOKEN_COST;
    }

    // Deduct tokens
    await supabase
      .from('users')
      .update({ tokens: user.tokens - ACTION_GENERATION_TOKEN_COST })
      .eq('id', user.id);

    // Log usage
    await supabase.from('coach_ai_usage_logs').insert({
      user_id: user.id,
      kind: 'actions',
      prompt_tokens: result.usage?.promptTokens || 0,
      completion_tokens: result.usage?.completionTokens || 0,
      total_tokens: actualTokens,
      success: result.success,
      error_message: result.error || null
    });

    return res.status(200).json({
      ...responseData,
      tokens_used: ACTION_GENERATION_TOKEN_COST,
      tokens_remaining: user.tokens - ACTION_GENERATION_TOKEN_COST
    });

  } catch (error: any) {
    console.error('❌ Action generation error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
