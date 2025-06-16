/**
 * API endpoint for scheduled chat cleanup
 * Can be called by cron jobs or scheduled tasks
 */

import { createClient } from '@supabase/supabase-js';
import { cleanupUserChatHistory, bulkCleanupChatHistory, getCleanupStats } from '../../lib/chatCleanup';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Simple authentication check
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${process.env.CLEANUP_API_KEY}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { action, user_id, keep_messages = 15 } = req.body;

    switch (action) {
      case 'stats':
        const stats = await getCleanupStats();
        return res.status(200).json({
          success: true,
          data: stats
        });

      case 'cleanup_user':
        if (!user_id) {
          return res.status(400).json({ error: 'user_id required for cleanup_user action' });
        }
        
        const userResult = await cleanupUserChatHistory(user_id, keep_messages, true);
        return res.status(200).json({
          success: true,
          data: userResult
        });

      case 'bulk_cleanup':
        const { max_users = 50 } = req.body;
        const bulkResult = await bulkCleanupChatHistory(keep_messages, max_users);
        return res.status(200).json({
          success: true,
          data: bulkResult
        });

      default:
        return res.status(400).json({ 
          error: 'Invalid action. Use: stats, cleanup_user, or bulk_cleanup' 
        });
    }

  } catch (error) {
    console.error('Cleanup API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
}
