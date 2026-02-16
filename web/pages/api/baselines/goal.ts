/**
 * POST /api/baselines/goal
 * Save goal-specific baseline (where user is with this specific goal)
 */
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { 
      email, 
      goalId, 
      goalSlot,
      goal_baseline_level, 
      goal_obstacle_text, 
      confidence_0_10, 
      notes 
    } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    if (!goalSlot) {
      return res.status(400).json({ error: 'Goal slot required (1 or 2)' });
    }

    // Validate all required fields
    if (!goal_baseline_level || !goal_obstacle_text || confidence_0_10 === null || confidence_0_10 === undefined) {
      return res.status(400).json({ 
        error: 'All baseline fields required: goal_baseline_level, goal_obstacle_text, confidence_0_10' 
      });
    }

    // Validate goal_obstacle_text min length
    if (goal_obstacle_text.trim().length < 3) {
      return res.status(400).json({ 
        error: 'goal_obstacle_text must be at least 3 characters' 
      });
    }

    // Get user
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (userError || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Insert goal baseline
    const { data, error } = await supabase
      .from('user_goal_baselines')
      .insert({
        user_id: user.id,
        user_goal_id: goalId || null,
        goal_slot: goalSlot,
        goal_baseline_level,
        goal_obstacle_text,
        confidence_0_10,
        notes: notes || null
      })
      .select()
      .single();

    if (error) {
      console.error('Goal baseline insert error:', error);
      throw error;
    }

    // Log the event
    await supabase.from('user_goal_events').insert({
      user_id: user.id,
      event_type: 'baseline_update',
      goal_slot: goalSlot,
      to_user_goal_id: goalId || null
    });

    return res.status(200).json({
      success: true,
      baseline: data
    });

  } catch (error: any) {
    console.error('❌ Goal baseline error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
