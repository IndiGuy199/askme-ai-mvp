/**
 * POST /api/coach/log-action
 * Server-authoritative action logging with token deduction.
 * Cost: 50 tokens per log entry.
 */
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

const ACTION_LOG_TOKEN_COST = 50;

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      email,
      action_id,
      completion_status = 'done',
      completion_percent = null,
      notes = null,
      context = null,
      urge_before_0_10 = null,
      urge_after_0_10 = null,
      logged_at = null,
    } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }
    if (!action_id) {
      return res.status(400).json({ error: 'action_id required' });
    }

    // Get user with token balance
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, tokens')
      .eq('email', email)
      .single();

    if (userError || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check token balance
    if (user.tokens < ACTION_LOG_TOKEN_COST) {
      return res.status(403).json({
        error: 'Insufficient tokens',
        required: ACTION_LOG_TOKEN_COST,
        available: user.tokens,
      });
    }

    const now = new Date().toISOString();

    // Insert action completion log
    const { data: logEntry, error: insertError } = await supabase
      .from('action_completions')
      .insert({
        user_id: user.id,
        action_id,
        completion_status,
        completion_percent,
        notes,
        context,
        urge_before_0_10,
        urge_after_0_10,
        logged_at: logged_at || now,
        completed_at: now,
      })
      .select()
      .single();

    if (insertError) {
      // Duplicate (already logged today) is non-fatal
      if (insertError.code === '23505') {
        return res.status(200).json({
          success: true,
          duplicate: true,
          tokens_used: 0,
          tokens_remaining: user.tokens,
        });
      }
      throw insertError;
    }

    // Deduct tokens
    await supabase
      .from('users')
      .update({ tokens: user.tokens - ACTION_LOG_TOKEN_COST })
      .eq('id', user.id);

    return res.status(200).json({
      success: true,
      log: logEntry,
      tokens_used: ACTION_LOG_TOKEN_COST,
      tokens_remaining: user.tokens - ACTION_LOG_TOKEN_COST,
    });
  } catch (error: any) {
    console.error('❌ log-action error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
