/**
 * POST /api/coach/enrich-actions
 * Auto-generate coach_metadata for actions that are missing it (manually created actions).
 * This is a lightweight call — no token cost, uses minimal AI.
 * Called on page load to backfill enrichment data.
 */
import { createClient } from '@supabase/supabase-js';
import { generateStructuredOutput } from '../../../lib/coach-ai/client';
import { z } from 'zod';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Lightweight schema for enrichment (just the display fields)
const EnrichmentSchema = z.object({
  actions: z.array(z.object({
    action_id: z.string(),
    trigger_condition: z.string().min(5).max(200),
    mechanism_type: z.enum(['friction', 'accountability', 'grounding', 'interrupt', 'replacement', 'environmental_control', 'shame_repair', 'state_change']),
    ai_note: z.string().min(10).max(500),
    category: z.enum(['friction', 'accountability', 'grounding', 'interrupt', 'replacement', 'environment', 'urge', 'mindset', 'connection', 'movement']),
    duration_minutes: z.number().int().min(1).max(10),
    difficulty: z.enum(['easy', 'medium']),
    success_criteria: z.string().min(10).max(300),
    when_to_do: z.string().min(5).max(200)
  }))
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, actionIds } = req.body;

    if (!email || !actionIds || !Array.isArray(actionIds) || actionIds.length === 0) {
      return res.status(400).json({ error: 'Email and actionIds array required' });
    }

    // Cap at 6 actions per request to keep costs low
    const idsToEnrich = actionIds.slice(0, 6);

    // Get user
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, first_name, email')
      .eq('email', email)
      .single();

    if (userError || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Fetch the actions that need enrichment
    const { data: actions, error: actionsError } = await supabase
      .from('action_plans')
      .select('id, action_text, goal_id')
      .eq('user_id', user.id)
      .in('id', idsToEnrich);

    if (actionsError || !actions || actions.length === 0) {
      return res.status(200).json({ enriched: 0, results: [] });
    }

    // Get user's challenge context for better enrichment
    const { data: userChallenge } = await supabase
      .from('user_challenges')
      .select('coach_challenges(challenge_id, label)')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    const challengeLabel = userChallenge?.coach_challenges?.label || 
      (Array.isArray(userChallenge?.coach_challenges) ? userChallenge.coach_challenges[0]?.label : null) ||
      'Recovery';

    // Build prompt for batch enrichment
    const actionsList = actions.map(a => `- ID: "${a.id}" | Text: "${a.action_text}"`).join('\n');

    const prompt = `You are a recovery coach. Analyze these user-created actions and generate enrichment metadata for each.

Context: These are actions for "${challengeLabel}" recovery.

Actions to enrich:
${actionsList}

For EACH action, generate:
- trigger_condition: When exactly should the user do this? (e.g., "immediately after a slip", "when urge exceeds 6/10")
- mechanism_type: What behavioral mechanism does this use? (friction, accountability, grounding, interrupt, replacement, environmental_control, shame_repair, state_change)
- ai_note: 2-3 sentences explaining WHY this action works neurologically or behaviorally. Reference dopamine, shame loops, or friction design where relevant.
- category: Best fit (friction, accountability, grounding, interrupt, replacement, environment, urge, mindset, connection, movement)
- duration_minutes: Realistic estimate (1-10)
- difficulty: easy or medium
- success_criteria: What "done" looks like — observable, measurable
- when_to_do: Timing suggestion tied to recovery patterns

Be specific and practical. No generic filler.

OUTPUT (strict JSON):
{
  "actions": [
    {
      "action_id": "the exact id from above",
      "trigger_condition": "...",
      "mechanism_type": "...",
      "ai_note": "...",
      "category": "...",
      "duration_minutes": 2,
      "difficulty": "easy",
      "success_criteria": "...",
      "when_to_do": "..."
    }
  ]
}`;

    const result = await generateStructuredOutput(
      'You are a recovery coach enriching action metadata. Be specific and practical.',
      prompt,
      EnrichmentSchema,
      'gpt-4o-mini'
    );

    if (!result.success || !result.data?.actions) {
      console.warn('⚠️ Enrichment generation failed:', result.error);
      return res.status(200).json({ enriched: 0, results: [], error: 'Generation failed' });
    }

    // Save enrichment back to DB
    const results = [];
    for (const enriched of result.data.actions) {
      const metadata = {
        trigger_condition: enriched.trigger_condition,
        mechanism_type: enriched.mechanism_type,
        ai_note: enriched.ai_note,
        category: enriched.category,
        duration_minutes: enriched.duration_minutes,
        difficulty: enriched.difficulty,
        success_criteria: enriched.success_criteria,
        when_to_do: enriched.when_to_do
      };

      const { error: updateError } = await supabase
        .from('action_plans')
        .update({ coach_metadata: metadata })
        .eq('id', enriched.action_id)
        .eq('user_id', user.id);

      if (!updateError) {
        results.push({ id: enriched.action_id, metadata });
      } else {
        console.error('Failed to update action:', enriched.action_id, updateError);
      }
    }

    // Log usage (no token cost to user — this is a system enrichment)
    await supabase.from('coach_ai_usage_logs').insert({
      user_id: user.id,
      kind: 'enrich_actions',
      prompt_tokens: result.usage?.promptTokens || 0,
      completion_tokens: result.usage?.completionTokens || 0,
      total_tokens: result.usage?.totalTokens || 0,
      success: true,
      error_message: null
    }).catch(() => {}); // Don't fail on logging error

    return res.status(200).json({
      enriched: results.length,
      results
    });

  } catch (error) {
    console.error('❌ Enrich actions error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
