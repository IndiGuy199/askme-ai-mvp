/**
 * POST /api/baselines/track
 * Upsert track-level baseline (porn recovery overall state)
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
      trackId, 
      slip_frequency_30d, 
      longest_streak_90d, 
      strongest_urge_time, 
      biggest_trigger, 
      notes 
    } = req.body;

    if (!email || !trackId) {
      return res.status(400).json({ error: 'Email and trackId required' });
    }

    // Validate all required fields
    if (!slip_frequency_30d || !longest_streak_90d || !strongest_urge_time || !biggest_trigger) {
      return res.status(400).json({ 
        error: 'All baseline fields required: slip_frequency_30d, longest_streak_90d, strongest_urge_time, biggest_trigger' 
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

    // Upsert track baseline (unique constraint on user_id + track_id)
    const { data, error } = await supabase
      .from('user_track_baselines')
      .upsert(
        {
          user_id: user.id,
          track_id: trackId,
          slip_frequency_30d,
          longest_streak_90d,
          strongest_urge_time,
          biggest_trigger,
          notes: notes || null,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'user_id,track_id' }
      )
      .select()
      .single();

    if (error) {
      console.error('Track baseline upsert error:', error);
      throw error;
    }

    return res.status(200).json({
      success: true,
      baseline: data
    });

  } catch (error: any) {
    console.error('❌ Track baseline error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
