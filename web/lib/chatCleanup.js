/**
 * Chat message cleanup utilities
 * Implements aggressive cleanup strategy with memory preservation
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);

/**
 * Clean up old chat messages for a user, keeping only recent essential ones
 * @param {string} user_id - The user ID to clean up messages for
 * @param {number} keepRecentMessages - Number of recent messages to keep (default: 20)
 * @param {boolean} forceCleanup - Force cleanup even if memory summary doesn't exist
 * @returns {Object} Cleanup results
 */
async function cleanupUserChatHistory(user_id, keepRecentMessages = 20, forceCleanup = false) {
  console.log(`Starting chat cleanup for user ${user_id}`);
  
  try {
    // First, check if user has a memory summary
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('memory_summary, updated_at')
      .eq('user_id', user_id)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      throw new Error(`Error checking user profile: ${profileError.message}`);
    }

    const hasMemorySummary = profile?.memory_summary && profile.memory_summary.length > 50;
    
    if (!hasMemorySummary && !forceCleanup) {
      console.log('No memory summary found - skipping cleanup to preserve conversation history');
      return { 
        success: false, 
        reason: 'No memory summary - preserving full history',
        messagesDeleted: 0,
        messagesKept: 0
      };
    }

    // Get total message count
    const { count: totalMessages, error: countError } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user_id);

    if (countError) {
      throw new Error(`Error counting messages: ${countError.message}`);
    }

    console.log(`User has ${totalMessages} total messages`);

    if (totalMessages <= keepRecentMessages) {
      console.log('User has fewer messages than keep threshold - no cleanup needed');
      return {
        success: true,
        reason: 'Below cleanup threshold',
        messagesDeleted: 0,
        messagesKept: totalMessages
      };
    }

    // Get the cutoff timestamp for messages to keep
    const { data: recentMessages, error: recentError } = await supabase
      .from('chat_messages')
      .select('created_at')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false })
      .limit(keepRecentMessages);

    if (recentError) {
      throw new Error(`Error getting recent messages: ${recentError.message}`);
    }

    if (recentMessages.length === 0) {
      console.log('No recent messages found');
      return {
        success: true,
        reason: 'No messages to clean',
        messagesDeleted: 0,
        messagesKept: 0
      };
    }

    const cutoffDate = recentMessages[recentMessages.length - 1].created_at;
    console.log(`Deleting messages older than: ${cutoffDate}`);

    // Delete old messages
    const { count: deletedCount, error: deleteError } = await supabase
      .from('chat_messages')
      .delete({ count: 'exact' })
      .eq('user_id', user_id)
      .lt('created_at', cutoffDate);

    if (deleteError) {
      throw new Error(`Error deleting old messages: ${deleteError.message}`);
    }

    const messagesDeleted = deletedCount || 0;
    const messagesKept = totalMessages - messagesDeleted;

    console.log(`Cleanup completed: ${messagesDeleted} deleted, ${messagesKept} kept`);

    return {
      success: true,
      reason: 'Cleanup completed',
      messagesDeleted,
      messagesKept,
      memoryExists: hasMemorySummary,
      cutoffDate
    };

  } catch (error) {
    console.error('Error during chat cleanup:', error);
    return {
      success: false,
      reason: error.message,
      messagesDeleted: 0,
      messagesKept: 0
    };
  }
}

/**
 * Clean up chat messages for all users who have memory summaries
 * @param {number} keepRecentMessages - Number of recent messages to keep per user
 * @param {number} maxUsersPerRun - Maximum users to process in one run
 * @returns {Object} Bulk cleanup results
 */
async function bulkCleanupChatHistory(keepRecentMessages = 20, maxUsersPerRun = 50) {
  console.log('Starting bulk chat cleanup...');
  
  try {
    // Get users who have memory summaries and might need cleanup
    const { data: usersWithMemory, error: usersError } = await supabase
      .from('user_profiles')
      .select('user_id, memory_summary, updated_at')
      .not('memory_summary', 'is', null)
      .neq('memory_summary', '')
      .order('updated_at', { ascending: true }) // Start with oldest memory summaries
      .limit(maxUsersPerRun);

    if (usersError) {
      throw new Error(`Error getting users with memory: ${usersError.message}`);
    }

    console.log(`Found ${usersWithMemory.length} users with memory summaries to potentially clean`);

    const results = {
      totalUsersProcessed: 0,
      totalMessagesDeleted: 0,
      totalMessagesKept: 0,
      successfulCleanups: 0,
      skippedCleanups: 0,
      errors: []
    };

    for (const user of usersWithMemory) {
      try {
        const result = await cleanupUserChatHistory(user.user_id, keepRecentMessages, false);
        
        results.totalUsersProcessed++;
        results.totalMessagesDeleted += result.messagesDeleted;
        results.totalMessagesKept += result.messagesKept;
        
        if (result.success && result.messagesDeleted > 0) {
          results.successfulCleanups++;
        } else {
          results.skippedCleanups++;
        }

        // Add a small delay to avoid overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (userError) {
        console.error(`Error cleaning up user ${user.user_id}:`, userError);
        results.errors.push({
          user_id: user.user_id,
          error: userError.message
        });
      }
    }

    console.log('Bulk cleanup completed:', results);
    return results;

  } catch (error) {
    console.error('Error during bulk cleanup:', error);
    throw error;
  }
}

/**
 * Get cleanup statistics for monitoring
 * @returns {Object} Current database statistics
 */
async function getCleanupStats() {
  try {
    // Get total messages count
    const { count: totalMessages } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact', head: true });

    // Get users with memory summaries
    const { count: usersWithMemory } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
      .not('memory_summary', 'is', null)
      .neq('memory_summary', '');

    // Get users without memory summaries
    const { count: usersWithoutMemory } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
      .or('memory_summary.is.null,memory_summary.eq.');

    // Get message distribution by age
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { count: recentMessages } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', oneWeekAgo);

    const { count: oldMessages } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .lt('created_at', oneMonthAgo);

    return {
      totalMessages: totalMessages || 0,
      usersWithMemory: usersWithMemory || 0,
      usersWithoutMemory: usersWithoutMemory || 0,
      recentMessages: recentMessages || 0,
      oldMessages: oldMessages || 0,
      cleanupOpportunity: oldMessages || 0
    };

  } catch (error) {
    console.error('Error getting cleanup stats:', error);
    throw error;
  }
}

module.exports = {
  cleanupUserChatHistory,
  bulkCleanupChatHistory,
  getCleanupStats
};
