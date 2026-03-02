/**
 * POST /api/support-now/save-session
 * Persists a completed support-now session to the support_sessions table.
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

  const {
    email,
    track,
    duration_minutes,
    pre_urge_intensity,
    context,
    post_urge_rating,
    completed_steps,
    total_steps
  } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    // Resolve user_id from email
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (userError || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { data, error } = await supabase
      .from('support_sessions')
      .insert({
        user_id: user.id,
        track: track || 'porn',
        duration_minutes: duration_minutes || 2,
        pre_urge_intensity: pre_urge_intensity || null,
        context: context || null,
        post_urge_rating: post_urge_rating || null,
        completed_steps: completed_steps ?? 0,
        total_steps: total_steps ?? 0,
        completed_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving support session:', error);
      return res.status(500).json({ error: 'Failed to save session' });
    }

    return res.status(201).json({ session: data });
  } catch (err) {
    console.error('Save session error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
