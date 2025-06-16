/**
 * Session activity tracker for detecting user inactivity and session boundaries
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);

// Session timeout configuration
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds
const INACTIVITY_CHECK_INTERVAL = 5 * 60 * 1000; // Check every 5 minutes

/**
 * Update user's last activity timestamp
 * @param {string} userId - User ID
 */
async function updateLastActivity(userId) {
  try {
    const now = new Date().toISOString();
    
    const { error } = await supabase
      .from('user_profiles')
      .upsert({
        user_id: userId,
        last_activity: now,
        updated_at: now
      }, {
        onConflict: 'user_id'
      });
      
    if (error) {
      console.error('Error updating last activity:', error);
    }
  } catch (err) {
    console.error('Exception updating last activity:', err);
  }
}

/**
 * Check if user session has timed out based on last activity
 * @param {string} userId - User ID
 * @returns {Object} Session status information
 */
async function checkSessionTimeout(userId) {
  try {
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('last_activity, memory_summary')
      .eq('user_id', userId)
      .single();
      
    if (error) {
      console.error('Error checking session timeout:', error);
      return { timedOut: false, reason: 'error_fetching_profile' };
    }
    
    if (!profile?.last_activity) {
      return { timedOut: false, reason: 'no_activity_recorded' };
    }
    
    const lastActivity = new Date(profile.last_activity);
    const timeSinceActivity = Date.now() - lastActivity.getTime();
    
    const timedOut = timeSinceActivity > SESSION_TIMEOUT;
    
    return {
      timedOut,
      timeSinceActivity,
      lastActivity: profile.last_activity,
      hasMemory: Boolean(profile.memory_summary),
      reason: timedOut ? 'session_timeout' : 'active_session'
    };
  } catch (err) {
    console.error('Exception checking session timeout:', err);
    return { timedOut: false, reason: 'exception' };
  }
}

/**
 * Get the time since last message for a user
 * @param {string} userId - User ID
 * @returns {Object} Last message timing information
 */
async function getLastMessageTime(userId) {
  try {
    const { data: lastMessage, error } = await supabase
      .from('chat_messages')
      .select('created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
      
    if (error) {
      if (error.code === 'PGRST116') { // No rows found
        return { hasMessages: false, reason: 'no_messages' };
      }
      console.error('Error fetching last message time:', error);
      return { hasMessages: false, reason: 'error' };
    }
    
    const lastMessageTime = new Date(lastMessage.created_at);
    const timeSinceMessage = Date.now() - lastMessageTime.getTime();
    
    return {
      hasMessages: true,
      lastMessageTime: lastMessage.created_at,
      timeSinceMessage,
      minutesSinceMessage: Math.round(timeSinceMessage / (1000 * 60))
    };
  } catch (err) {
    console.error('Exception getting last message time:', err);
    return { hasMessages: false, reason: 'exception' };
  }
}

/**
 * Determine if a session-end memory update should be triggered based on inactivity
 * @param {string} userId - User ID
 * @returns {Object} Decision about session-end update
 */
async function shouldTriggerSessionEndUpdate(userId) {
  const sessionStatus = await checkSessionTimeout(userId);
  const messageStatus = await getLastMessageTime(userId);
  
  // Don't trigger if no session timeout or no messages
  if (!sessionStatus.timedOut || !messageStatus.hasMessages) {
    return {
      shouldUpdate: false,
      reason: !sessionStatus.timedOut ? 'session_active' : 'no_messages',
      sessionStatus,
      messageStatus
    };
  }
  
  // Check if there's been enough conversation to warrant an update
  // (At least 10 minutes of conversation activity)
  const minConversationTime = 10 * 60 * 1000; // 10 minutes
  if (messageStatus.timeSinceMessage < minConversationTime) {
    return {
      shouldUpdate: false,
      reason: 'insufficient_conversation_time',
      sessionStatus,
      messageStatus
    };
  }
  
  return {
    shouldUpdate: true,
    reason: 'session_timeout_with_conversation',
    sessionStatus,
    messageStatus
  };
}

module.exports = {
  updateLastActivity,
  checkSessionTimeout,
  getLastMessageTime,
  shouldTriggerSessionEndUpdate,
  SESSION_TIMEOUT
};
