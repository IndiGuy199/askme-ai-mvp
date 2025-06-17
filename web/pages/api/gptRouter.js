import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { encoding_for_model } from 'tiktoken'
import crypto from 'crypto'

// Import prompt configuration
import { promptConfig, loadCoachPrompts } from '../../lib/promptConfig'
import * as promptStrategy from '../../lib/promptStrategy'
import determineIfNewTopic from '../../lib/topicDetector'
import { detectTopicShift } from '../../lib/topicShiftDetector'
import { updateLastActivity, shouldTriggerSessionEndUpdate } from '../../lib/sessionTracker'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE)
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// Import error handler
import { withErrorHandling } from '../../lib/apiErrorHandler'

// Define the handler and then wrap it with error handling
async function gptRouterHandler(req, res) {
  // Enhanced in-memory cache for responses with TTL
  const promptCache = new Map();
  const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

  // Helper: Generate cache key for prompt caching
  function getCacheKey(user_id, message, context) {
    const content = `${user_id}:${message}:${context}`;
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  // Helper: Check cache for recent responses
  function getCachedResponse(key) {
    const cached = promptCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log('Cache hit for prompt');
      return cached.response;
    }
    if (cached) {
      promptCache.delete(key); // Remove expired cache
    }
    return null;
  }

  // Helper: Store response in cache
  function setCachedResponse(key, response) {
    promptCache.set(key, {
      response,
      timestamp: Date.now()
    });
    
    // Clean up old cache entries periodically
    if (promptCache.size > 1000) {
      const cutoff = Date.now() - CACHE_TTL;
      for (const [k, v] of promptCache.entries()) {
        if (v.timestamp < cutoff) {
          promptCache.delete(k);
        }
      }
    }
  }

  // --- Cost-Optimized Prompt Construction and Memory Logic ---  // Helper: Get user profile, onboarding context, and memory summary
  async function getUserProfile(user_id) {
    // Get from user_profiles table
    let { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', user_id)
      .single();
      // Get user data from users table including coach profile
    const { data: user } = await supabase
      .from('users')
      .select(`
        id, 
        first_name, 
        age, 
        goals, 
        tone, 
        city, 
        country, 
        marital_status,
        communication_style,
        coaching_format,
        preferences_set,
        coach_profile_id,
        coach_profiles (
          id,
          code,
          label,
          system_prompt,
          medium_prompt,
          short_prompt
        )
      `)
      .eq('id', user_id)
      .single();

    // Get user's selected wellness goals with details
    const { data: userGoals } = await supabase
      .from('user_wellness_goals')
      .select(`
        coach_wellness_goals(goal_id, label, description)
      `)
      .eq('user_id', user_id);

    // Get user's selected challenges with details  
    const { data: userChallenges } = await supabase
      .from('user_challenges')
      .select(`
        coach_challenges(challenge_id, label, description)
      `)
      .eq('user_id', user_id);

    // Build structured goals and challenges
    const goals = userGoals?.map(g => ({
      id: g.coach_wellness_goals?.goal_id,
      label: g.coach_wellness_goals?.label,
      description: g.coach_wellness_goals?.description
    })).filter(g => g.label) || [];

    const challenges = userChallenges?.map(c => ({
      id: c.coach_challenges?.challenge_id,
      label: c.coach_challenges?.label,
      description: c.coach_challenges?.description
    })).filter(c => c.label) || [];
      // Build onboarding context from user data
    const context_parts = [];
    if (user?.first_name) context_parts.push(`User's name: ${user.first_name}`);
    if (user?.age) context_parts.push(`Age: ${user.age}`);
    if (user?.city && user?.country) context_parts.push(`Location: ${user.city}, ${user.country}`);
    if (user?.marital_status) context_parts.push(`Marital status: ${user.marital_status}`);
    
    // Prioritize structured goals and make them prominent
    if (goals.length > 0) {
      const goalsList = goals.map(g => `${g.label}: ${g.description || g.id}`).join(' | ');
      context_parts.push(`CURRENT WELLNESS GOALS: ${goalsList}`);
    }
    
    // Add legacy goals as secondary if structured goals exist
    if (user?.goals && goals.length > 0) {
      context_parts.push(`Additional Goals (legacy): ${user.goals}`);
    } else if (user?.goals && goals.length === 0) {
      context_parts.push(`Goals: ${user.goals}`);
    }
    
    if (challenges.length > 0) {
      const challengesList = challenges.map(c => `${c.label}: ${c.description || c.id}`).join(' | ');
      context_parts.push(`CURRENT CHALLENGES: ${challengesList}`);
    }
    
    if (user?.tone) context_parts.push(`Preferred communication tone: ${user.tone}`);
    
    // Add communication style and coaching format preferences
    if (user?.communication_style) {
      const styleDescriptions = {
        'direct': 'User prefers direct, to-the-point advice without fluff',
        'step-by-step': 'User prefers detailed, step-by-step guidance with clear action items',
        'gentle-encouraging': 'User prefers gentle, encouraging tone with positive reinforcement'
      };
      context_parts.push(`Communication Style: ${styleDescriptions[user.communication_style] || user.communication_style}`);
    }
    
    if (user?.coaching_format) {
      const formatDescriptions = {
        'concise': 'User prefers brief, concise responses with key points only',
        'detailed': 'User prefers in-depth, thorough explanations with examples',
        'conversational': 'User prefers natural, conversational dialogue with context'
      };
      context_parts.push(`Response Format: ${formatDescriptions[user.coaching_format] || user.coaching_format}`);
    }
    
    const onboarding_context = context_parts.length > 0 ? context_parts.join('\n') : '';
      // Return user profile with coach profile info
    return {
      onboarding_context,
      last_memory_summary: profile?.memory_summary || '',
      first_name: user?.first_name || '',
      age: user?.age || null,
      goals: goals,
      challenges: challenges,
      simple_goals: user?.goals || '',
      tone: user?.tone || 'balanced',
      communication_style: user?.communication_style,
      coaching_format: user?.coaching_format,
      preferences_set: user?.preferences_set || false,
      coach_profile_id: user?.coach_profile_id,
      coach_profile: user?.coach_profiles,
      ...user
    };
  }// Helper: Get last N chat messages for user (optimized for context window)
  async function getLastNMessages(user_id, n = 4) { // Default reduced from 8 to 4
    // Get recent messages only (3-6 range for better token efficiency)
    const limit = Math.min(Math.max(n, 3), 6); // Reduced from 5-10 range
    
    const { data: messages } = await supabase
      .from('chat_messages')
      .select('role, content, created_at')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    return (messages || []).reverse();
  }
  // Helper: Store chat message
  async function storeChatMessage(user_id, role, content, model = null, token_count = 0) {
    await supabase.from('chat_messages').insert([{ 
      user_id, 
      role, 
      content, 
      model, 
      token_count 
    }]);
  }  // Helper: Ensure user profile exists
  async function ensureUserProfile(user_id) {
    console.log(`Ensuring user profile exists for user_id: ${user_id}`);
    
    try {
      // First check if profile exists
      const { data: existing, error: fetchError } = await supabase
        .from('user_profiles')
        .select('id, memory_summary, updated_at')
        .eq('user_id', user_id)
        .single();
      
      if (fetchError) {
        if (fetchError.code === 'PGRST116') { // PGRST116 = not found, which means we need to create it
          console.log('No profile found, creating new user profile');
          
          // Create new profile with explicit transaction
          const { data: insertData, error: insertError } = await supabase
            .from('user_profiles')
            .insert([{ 
              user_id,
              memory_summary: '',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }])
            .select();
          
          if (insertError) {
            console.error('Failed to create user profile:', insertError);
            throw new Error(`Failed to create user profile: ${insertError.message}`);
          } else {
            console.log('Successfully created new user profile');
            
            // Verify profile was created
            const { data: verifyData, error: verifyError } = await supabase
              .from('user_profiles')
              .select('id')
              .eq('user_id', user_id)
              .single();
              
            if (verifyError) {
              console.error('Profile creation verification failed:', verifyError);
              throw new Error(`Profile creation verification failed: ${verifyError.message}`);
            } else {
              console.log('Profile creation verified successfully');
              return true;
            }
          }
        } else {
          console.error('Error checking for existing user profile:', fetchError);
          throw new Error(`Error checking for existing user profile: ${fetchError.message}`);
        }
      } else {
        // Profile exists
        console.log(`Found existing profile with memory_summary length: ${existing.memory_summary?.length || 0}`);
        console.log(`Last updated: ${existing.updated_at}`);
        return true;
      }
    } catch (err) {
      console.error('Exception in ensureUserProfile:', err);
      
      // Last resort fallback - try direct raw insert
      try {
        const { data, error } = await supabase.rpc('create_user_profile_if_not_exists', {
          p_user_id: user_id
        });
        
        if (error) {
          console.error('Fallback profile creation failed:', error);
          return false;
        } else {
          console.log('Fallback profile creation succeeded');
          return true;
        }
      } catch (fallbackErr) {
        console.error('Fallback profile creation exception:', fallbackErr);
        return false;
      }
    }
  }// Helper: Summarize memory after X messages or session end  
async function updateMemorySummary(user_id, sessionEnd = false) {
  console.log(`Starting memory summarization for user ${user_id}, sessionEnd=${sessionEnd}`);
    
    // Define userData in wider scope to make it available throughout the function
    let userData = null;
    let userEmail = 'unknown@email.com';
    let userName = 'Unknown';
      try {
      // Get user info with coach profile for better summarization
      const { data: userDataResult, error: userError } = await supabase
        .from('users')
        .select(`
          first_name, 
          email,
          coach_profiles (
            id,
            code,
            label,
            system_prompt,
            medium_prompt,
            short_prompt
          )
        `)
        .eq('id', user_id)
        .single();
        
      if (userError) {
        console.error('Error fetching user for memory summarization:', userError);
        // Don't throw, continue with default values
        console.log('Continuing with default user info values');
      } else {
        userData = userDataResult;
        userEmail = userData?.email || 'unknown@email.com';
        userName = userData?.first_name || 'Unknown';
        console.log(`Processing memory for user: ${userName} (${userEmail}) with coach: ${userData?.coach_profiles?.code || 'default'}`);
      }
      
      // Use memoryLogger if available, fall back to manual logging
      try {
        const memoryLogger = require('../../lib/memoryLogger');
        memoryLogger.logSummarizationStart(user_id, userEmail, 0, sessionEnd);
      } catch (logModuleErr) {
        // Fall back to manual logging
        try {
          const fs = require('fs');
          const path = require('path');
          const logDir = path.join(process.cwd(), 'logs');
          if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
          
          const logEntry = {
            timestamp: new Date().toISOString(),
            userId: user_id,
            email: userEmail,
            event: 'SUMMARIZE_START',
            sessionEnd
          };
          
          fs.appendFileSync(
            path.join(logDir, 'memory-debug.log'), 
            JSON.stringify(logEntry) + '\n'
          );
        } catch (logErr) {
          console.error('Error writing to memory log:', logErr);
        }
      }
    } catch (initError) {
      console.error('Initial setup error in memory summarization:', initError);
      // Continue despite error in logging setup
    }      const limit = sessionEnd ? 15 : 10; // Reduced limits for better focus on recent conversation
    console.log(`Fetching up to ${limit} recent messages for summary update`);
    
    const { data: messages, error: msgError } = await supabase
      .from('chat_messages')
      .select('role, content, created_at')
      .eq('user_id', user_id)
      .order('created_at', { ascending: true }) // Chronological order for better context
      .limit(limit);
        if (msgError) {
      console.error('Error fetching messages for memory summarization:', msgError);
      throw new Error(`Error fetching messages: ${msgError.message}`);
    }
    
    console.log(`Found ${messages?.length || 0} messages for memory summary update`);
    
    // Get current user profile for context and existing summary
    let profile = null;
    let currentSummary = '';
    
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('memory_summary')
        .eq('user_id', user_id)
        .single();
      
      if (profileError) {
        if (profileError.code === 'PGRST116') { // Not found
          console.log('Profile not found, will create a new one during summarization');
        } else {
          console.error('Error fetching profile for memory summarization:', profileError);
        }
      } else {
        profile = profileData;
        currentSummary = profile?.memory_summary || '';
        console.log(`Retrieved existing memory summary (${currentSummary.length} chars)`);
      }
    } catch (profileFetchError) {
      console.error('Exception fetching profile:', profileFetchError);
      // Continue without profile - we'll create one below
    }
    
    if (!messages || messages.length < 2) {
      console.log('Not enough new messages for meaningful summary update');
      try {
        const memoryLogger = require('../../lib/memoryLogger');
        memoryLogger.logMemoryEvent(user_id, userData?.email, 'INSUFFICIENT_NEW_MESSAGES', 
          { messageCount: messages?.length || 0, minimumRequired: 2 });
      } catch (logErr) {
        console.error('Error logging insufficient messages:', logErr);
      }
      return currentSummary; // Return existing summary if no new content
    }// Improved approach: Focus on most recent meaningful conversation
    // Get last 10-12 messages but prioritize user messages and longer responses
    const recentMessages = messages
      .slice(-12) // Get last 12 messages for context
      .filter(m => {
        // Keep all user messages and substantial assistant responses
        return m.role === 'user' || 
               (m.role === 'assistant' && m.content.length > 50);
      })
      .slice(-8); // Keep up to 8 filtered messages for context
    
    const recentConversation = recentMessages
      .map(m => {
        // Truncate very long messages but keep important context
        const content = m.content.length > 500 ? 
          m.content.substring(0, 500) + "..." : 
          m.content;
        return `${m.role}: ${content}`;
      })
      .join('\n\n');

    const updatePrompt = `EXISTING SUMMARY:
${currentSummary || 'No previous summary - this is the first summary for this user.'}

RECENT CONVERSATION:
${recentConversation}

${promptConfig.memory.updateSummary}`;
      console.log(`Updating memory summary for user ${user_id} (${sessionEnd ? 'session end' : 'periodic update'})`);
    console.log(`Existing summary length: ${currentSummary?.length || 0} chars`);
    console.log(`Recent conversation: ${recentMessages.length} filtered messages from ${messages.length} total`);
    
    try {      console.log('Calling OpenAI API for memory summary update...');      const summaryRes = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: updatePrompt }],
        max_tokens: 320, // Slightly more for better summaries
        temperature: 0.3 // Lower temperature for more consistent summaries
      });
        let summary = summaryRes.choices[0]?.message?.content || '';
      console.log(`Got updated summary from OpenAI, length: ${summary.length} characters`);
      
      // Log summary preview for debugging (first 100 chars)
      console.log(`Summary preview: ${summary.substring(0, 100)}${summary.length > 100 ? '...' : ''}`);
      
      // Add role reminder to ensure personality consistency
      if (summary && summary.length > 0) {
        summary = promptStrategy.addRoleReminder(summary, userData?.coach_profiles);
        console.log('Added role reminder to updated memory summary');
      }
      
      // Validate summary quality - ensure it's better than just returning existing summary
      if (!summary || summary.length < 20) {
        console.error('OpenAI returned empty or too short summary content, returning existing summary');
        
        // Log the failure
        try {
          const memoryLogger = require('../../lib/memoryLogger');
          memoryLogger.logSummarizationFailure(user_id, userData?.email, new Error('Empty or too short summary returned from OpenAI'));
        } catch (logErr) {
          console.error('Error logging summarization failure:', logErr);
        }
        
        return currentSummary || null; // Return existing summary as fallback
      }      // Enhanced validation - ensure the summary incorporates recent conversation
      const recentContent = messages.slice(-3).map(m => m.content.toLowerCase()).join(' ');
      const summaryContent = summary.toLowerCase();
      
      // Check if summary contains reference to recent topics (more robust validation)
      const hasRecentContext = messages.slice(-3).some(msg => {
        if (msg.role === 'user') {
          // Extract meaningful words from user messages
          const words = msg.content.toLowerCase()
            .split(/\s+/)
            .filter(w => w.length > 4 && !/^(that|this|what|when|where|have|been|will|would|could|should)$/.test(w));
          
          // Check if any significant words appear in summary
          return words.some(word => summaryContent.includes(word));
        }
        return false;
      });

      // Additional validation: check if summary is significantly different from existing
      const summaryChanged = !currentSummary || 
        (summary.length !== currentSummary.length && 
         !summary.toLowerCase().includes(currentSummary.toLowerCase().substring(0, 50)));

      if (!hasRecentContext && messages.length >= 3) {
        console.warn('Updated summary may not adequately reflect recent conversation');
        
        // If summary doesn't seem to reflect recent content AND hasn't changed much, 
        // consider falling back to existing summary
        if (!summaryChanged && currentSummary && currentSummary.length > 50) {
          console.log('Summary unchanged and no recent context detected, keeping existing summary');
          return currentSummary;
        }
      }

      console.log(`Summary validation: hasRecentContext=${hasRecentContext}, summaryChanged=${summaryChanged}`);
        // Enhance database operations to prevent constraint violations
      console.log('Updating database with new memory summary...');
      
      try {
        // Explicitly check if profile exists to avoid constraint errors
        const { data: existingProfile, error: checkError } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('user_id', user_id)
          .single();
          
        if (checkError && checkError.code !== 'PGRST116') {
          // If there's an error other than "not found", log it but continue
          console.error('Error checking if profile exists:', checkError);
        }
        
        const profileExists = !checkError && existingProfile?.id;
        console.log(`Profile exists check result: ${profileExists ? 'Yes' : 'No'}`);
        
        if (profileExists) {
          // Profile exists - UPDATE operation
          console.log('Updating existing profile with new memory summary...');
          const { error: updateError } = await supabase
            .from('user_profiles')
            .update({ 
              memory_summary: summary,
              updated_at: new Date().toISOString()
            })
            .eq('user_id', user_id);
            if (updateError) {
            console.error('Error updating memory summary:', updateError);
            
            try {
              const memoryLogger = require('../../lib/memoryLogger');
              memoryLogger.logDatabaseError(user_id, userEmail, 'UPDATE_PROFILE', updateError);
            } catch (logErr) {
              console.error('Error logging database error:', logErr);
            }
            
            throw new Error(`Update error: ${updateError.message}`);
          }
          
          console.log('Memory summary updated successfully');
        } else {
          // Profile does not exist - INSERT operation
          console.log('Creating new profile with memory summary...');
          const { error: insertError } = await supabase
            .from('user_profiles')
            .insert([{ 
              user_id, 
              memory_summary: summary,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }]);
              if (insertError) {
            console.error('Error creating profile with memory summary:', insertError);
            
            try {
              const memoryLogger = require('../../lib/memoryLogger');
              memoryLogger.logDatabaseError(user_id, userEmail, 'INSERT_PROFILE', insertError);
            } catch (logErr) {
              console.error('Error logging database error:', logErr);
            }
            
            // Special handling for potential race condition - try update if insert fails due to unique constraint
            if (insertError.code === '23505') { // Unique violation code
              console.log('Unique constraint violation - trying update as fallback...');
              const { error: fallbackError } = await supabase
                .from('user_profiles')
                .update({ 
                  memory_summary: summary,
                  updated_at: new Date().toISOString()
                })
                .eq('user_id', user_id);                
              if (fallbackError) {
                console.error('Fallback update also failed:', fallbackError);
                
                try {
                  const memoryLogger = require('../../lib/memoryLogger');
                  memoryLogger.logDatabaseError(user_id, userEmail, 'FALLBACK_UPDATE', fallbackError);
                } catch (logErr) {
                  console.error('Error logging database error:', logErr);
                }
                
                throw new Error(`Both insert and fallback update failed: ${fallbackError.message}`);
              } else {
                console.log('Fallback update succeeded after insert failure');
              }
            } else {
              throw new Error(`Insert error: ${insertError.message}`);
            }
          } else {
            console.log('New profile with memory summary created successfully');
          }
        }
        
        // Verify the operation was successful
        const { data: verifyData, error: verifyError } = await supabase
          .from('user_profiles')
          .select('memory_summary')
          .eq('user_id', user_id)
          .single();
        
        if (verifyError) {
          console.error('Error verifying memory summary save:', verifyError);
        } else if (!verifyData.memory_summary) {
          console.error('Verification failed: Memory summary is empty after save!');
        } else {
          console.log(`Verification successful: memory_summary saved (${verifyData.memory_summary.length} chars)`);
        }
      } catch (dbError) {
        console.error('Exception during database operations:', dbError);
        
        try {
          const memoryLogger = require('../../lib/memoryLogger');
          memoryLogger.logSummarizationFailure(user_id, userEmail, dbError);
        } catch (logErr) {
          console.error('Error logging database failure:', logErr);
        }
        
        return null;
      }        console.log('Memory summary updated successfully');
      
      // Trigger chat history cleanup after successful memory update
      try {
        const { cleanupUserChatHistory } = require('../../lib/chatCleanup');
        console.log('Starting chat cleanup after memory update...');
        
        // Keep 15 recent messages after memory summarization
        const cleanupResult = await cleanupUserChatHistory(user_id, 15, false);
        
        if (cleanupResult.success && cleanupResult.messagesDeleted > 0) {
          console.log(`Chat cleanup completed: ${cleanupResult.messagesDeleted} messages deleted, ${cleanupResult.messagesKept} kept`);
        } else {
          console.log(`Chat cleanup skipped: ${cleanupResult.reason}`);
        }
      } catch (cleanupError) {
        console.error('Error during chat cleanup:', cleanupError);
        // Don't fail the memory update if cleanup fails
      }
      
      // Log successful memory update
      try {
        const memoryLogger = require('../../lib/memoryLogger');
        memoryLogger.logSummarizationSuccess(user_id, userEmail, summary.length);
      } catch (logModuleErr) {
        // Fall back to manual logging
        try {
          const fs = require('fs');
          const path = require('path');
          const logDir = path.join(process.cwd(), 'logs');
          
          const logEntry = {
            timestamp: new Date().toISOString(),
            userId: user_id,
            event: 'SUMMARIZE_SUCCESS',
            summaryLength: summary.length,
            previewText: summary.substring(0, 100) + '...'
          };
          
          fs.appendFileSync(
            path.join(logDir, 'memory-debug.log'), 
            JSON.stringify(logEntry) + '\n'
          );
        } catch (logErr) {
          console.error('Error writing success log:', logErr);
        }
      }
      
      return summary;
    } catch (error) {      console.error('Error updating memory summary:', error);
      console.error('Error stack trace:', error.stack);
      
      // Log the error
      try {
        const memoryLogger = require('../../lib/memoryLogger');
        memoryLogger.logSummarizationFailure(user_id, userData?.email, error);
      } catch (logErr) {
        console.error('Error logging failure:', logErr);
      }
      
      // Provide a simple fallback memory in case of failure
      // This helps maintain some personalization even when summarization fails
      try {
        // Only attempt fallback if we have a user name
        if (userData?.first_name) {
          // Create minimal fallback memory to ensure basic personalization works
          const fallbackSummary = `User is ${userData.first_name}${userData.email ? ` (${userData.email})` : ''}. Memory summarization failed, but AI should maintain personalized conversation.`;
          
          // Update with fallback memory only if there's no existing memory
          const { data: currentProfile } = await supabase
            .from('user_profiles')
            .select('memory_summary')
            .eq('user_id', user_id)
            .single();
            
          if (!currentProfile?.memory_summary) {
            console.log('Using fallback memory summary after failure');
            await supabase
              .from('user_profiles')
              .update({ 
                memory_summary: fallbackSummary,
                updated_at: new Date().toISOString()
              })
              .eq('user_id', user_id);
          }
        }
      } catch (fallbackErr) {
        console.error('Failed to create fallback memory:', fallbackErr);
      }
      
      return null;
    }
  }// System prompts - optimized for token efficiency
  // Now using imported prompts from configuration file
  const FULL_SYSTEM_PROMPT = promptConfig.system.full;
  const SHORT_SYSTEM_PROMPT = promptConfig.system.short;

  // Helper: Determine if user is starting a new topic
  function determineIfNewTopic(message, chatHistory) {
    // If chat history is very short, not enough context to determine
    if (!chatHistory || chatHistory.length < 3) {
      return false;
    }
    
    // Check for phrases that indicate a topic change
    const newTopicPatterns = [
      /change (of|the) (subject|topic)/i,
      /switch(ing)? (to|topics)/i,
      /(new|different) (subject|topic)/i,
      /(by the way|anyway|moving on|btw)/i,
      /(let me ask|I have another|speaking of|changing subjects?|on another note)/i,
      /(forget|ignore) (what I|that|the previous)/i,
      /^(let's|can we) talk about/i,
      /^I want to (discuss|talk about|ask about)/i,
      /^what (do you think|about|are your thoughts) (of|on|about)/i
    ];
    
    for (const pattern of newTopicPatterns) {
      if (message.match(pattern)) return true;
    }
    
    // Not a new topic
    return false;
  }

  // Helper: Enhanced model selection with token optimization
  function isSimpleRequest(msg, context_size = 0) {
    // Enhanced token-efficient model selection
    const isShortMsg = msg.length < 80; // Slightly more generous length threshold
    const hasSimplePatterns = msg.match(/(hi|hello|thanks|thank you|great|got it|ok|okay|yes|no|maybe|how are you|good morning|good afternoon)/i);
    const isFollowUp = msg.match(/(can you|what about|also|one more|additionally)/i);
    const hasComplexPattern = msg.match(/(plan|diagnose|analyze|summarize|strategy|deep|complex|explain in detail|step by step|comprehensive)/i);
    const hasQuestionPattern = msg.includes('?') && (msg.toLowerCase().startsWith('how') || msg.toLowerCase().startsWith('why') || msg.toLowerCase().startsWith('what') || msg.toLowerCase().startsWith('when') || msg.toLowerCase().startsWith('where'));
    
    // Simple if either very short message or contains simple patterns, with reasonable context size
    return (isShortMsg || hasSimplePatterns || isFollowUp) && !hasComplexPattern && !hasQuestionPattern && context_size < 1500;
  }// Main algorithm: Get prompt and model with caching and token optimization
  async function getPromptAndModel(user_id, user_message, profile, chat_history, is_first_message = false, is_init_message = false) {
    // 1. Extract data more efficiently
    const context = profile?.onboarding_context || '';
    const memory_summary = profile?.last_memory_summary || '';
    const hasGoals = profile?.goals?.length > 0;
    const hasChallenges = profile?.challenges?.length > 0;
    const firstName = profile?.first_name || '';
    
    // Calculate context size for model selection
    const contextSize = (memory_summary?.length || 0) + (context?.length || 0);
  
    // 2. Model selection - more token-efficient strategy
    let model = 'gpt-3.5-turbo';
    
    if (is_init_message) {
      model = memory_summary?.length > 100 ? 'gpt-3.5-turbo' : 'gpt-4-turbo';
    } else if (is_first_message && (!hasGoals && !hasChallenges)) {
      model = 'gpt-4-turbo';
    } else if (!isSimpleRequest(user_message, contextSize)) {
      model = 'gpt-4-turbo';
    }

    // 3. System prompt selection - prioritize coach-specific prompts
    let system_prompt = '';
    
    try {
      // Check if we have coach-specific prompts from the database
      if (profile?.coach_profile?.system_prompt) {
        const coachPrompts = {
          full: profile.coach_profile.system_prompt,
          medium: profile.coach_profile.medium_prompt || profile.coach_profile.system_prompt,
          short: profile.coach_profile.short_prompt || profile.coach_profile.system_prompt
        };

        console.log(`Using coach-specific prompts for ${profile.coach_profile.code || 'unknown'} coach`);

        if (is_init_message) {
          // For initialization, use a personalized version of the coach prompt
          system_prompt = coachPrompts.full + ` Remember, you are speaking with ${firstName}, and you should greet them warmly by name.`;
          console.log('Using coach-specific initialization prompt with name:', firstName);
        } else {
          // Use prompt strategy to select appropriate coach prompt
          const messageCount = chat_history?.length || 0;
          const hasMemory = Boolean(memory_summary && memory_summary.length > 10);
          const isNewTopic = determineIfNewTopic(user_message, chat_history || []);
          system_prompt = promptStrategy.getSystemPrompt(messageCount, hasMemory, isNewTopic, coachPrompts);
          console.log('Using coach-specific prompt selected by strategy');
        }
      } else {
        console.log('No coach profile found, using default prompts');
        
        if (is_init_message) {
          system_prompt = (promptConfig.system.init || '').replace(/\{\{firstName\}\}/g, firstName || 'user');
          console.log('Using default initialization prompt with name:', firstName);
        } else {
          const messageCount = chat_history?.length || 0;
          const hasMemory = Boolean(memory_summary && memory_summary.length > 10);
          const isNewTopic = determineIfNewTopic(user_message, chat_history || []);
          system_prompt = promptStrategy.getSystemPrompt(messageCount, hasMemory, isNewTopic, promptConfig.system);
        }
      }
    } catch (error) {
      console.error('Error selecting prompt:', error);
      system_prompt = promptConfig.system.full;
    }    // Ensure we have a valid system prompt
    if (!system_prompt) {
      console.warn('No system prompt selected, using default');
      system_prompt = promptConfig.system.full;
    }

    // Apply user communication preferences to the system prompt
    if (profile?.communication_style || profile?.coaching_format) {
      system_prompt = promptStrategy.customizePromptForPreferences(
        system_prompt, 
        profile.communication_style, 
        profile.coaching_format
      );
      console.log('Applied user communication preferences to system prompt');
    }

    // 4. Prompt construction with context
    const prompt = [
      { role: "system", content: system_prompt }
    ];

    let context_message = '';
    
    try {      // Handle initialization messages with memory
      if (is_init_message && memory_summary) {
        context_message = `Context from previous conversations: ${memory_summary.substring(0, 300)}${memory_summary.length > 300 ? '...' : ''}`;
        
        // Override with current goals if they exist
        if (hasGoals || hasChallenges) {
          const currentGoalsContext = [];
          if (hasGoals) {
            const goalDetails = profile.goals.map(g => `${g.label} (${g.description})`).join(', ');
            currentGoalsContext.push(`Current Goals: ${goalDetails}`);
          }
          if (hasChallenges) {
            const challengeDetails = profile.challenges.map(c => `${c.label} (${c.description})`).join(', ');
            currentGoalsContext.push(`Current Challenges: ${challengeDetails}`);
          }
          context_message += `\n\nIMPORTANT - ${currentGoalsContext.join(' | ')}`;
        }
        
        if (firstName && !memory_summary.includes(firstName)) {
          context_message += `\nUser's name: ${firstName}`;
        }
      }
      // Handle first messages with user context
      else if (is_first_message && context) {
        const key_parts = [];
        if (firstName) key_parts.push(`Name: ${firstName}`);
        
        // Emphasize current structured goals
        if (hasGoals) {
          const goalDetails = profile.goals.map(g => `${g.label} (${g.description})`).join(', ');
          key_parts.push(`ACTIVE WELLNESS GOALS: ${goalDetails}`);
        }
        
        if (hasChallenges) {
          const challengeDetails = profile.challenges.map(c => `${c.label} (${c.description})`).join(', ');
          key_parts.push(`CURRENT CHALLENGES: ${challengeDetails}`);
        }
        
        context_message = key_parts.join(' | ');
      }      // Handle continuing conversations
      else if (!is_first_message) {
        if (memory_summary) {
          context_message = `Previous context: ${memory_summary.substring(0, 200)}${memory_summary.length > 200 ? '...' : ''}`;
          
          // Add current goals/challenges if available
          if (hasGoals || hasChallenges) {
            const key_parts = [];
            if (hasGoals) {
              const goalLabels = profile.goals.map(g => g.label).join(', ');
              key_parts.push(`Current Goals: ${goalLabels}`);
            }
            if (hasChallenges) {
              const challengeLabels = profile.challenges.map(c => c.label).join(', ');
              key_parts.push(`Current Challenges: ${challengeLabels}`);
            }
            context_message += `\n${key_parts.join(' | ')}`;
          }
        } else if (context) {
          const key_parts = [];
          if (hasGoals) key_parts.push(`Goals: ${profile.goals.map(g => g.label).join(', ')}`);
          if (hasChallenges) key_parts.push(`Challenges: ${profile.challenges.map(c => c.label).join(', ')}`);
          context_message = key_parts.join(' | ');
        }
      }      // Add context message to prompt
      if (context_message.trim()) {
        prompt.push({ role: "system", content: context_message.trim() });
      }

      // Special handling for goal-related queries
      if (user_message && (user_message.toLowerCase().includes('goals') || user_message.toLowerCase().includes('goal'))) {
        if (hasGoals) {
          const goalDetails = profile.goals.map(g => `${g.label} - ${g.description}`).join('; ');
          prompt.push({ 
            role: "system", 
            content: `When asked about goals, refer to these current selections: ${goalDetails}` 
          });
          console.log('Added goal-specific context for user query about goals');
        }
      }

      // Add chat history
      const safe_chat_history = Array.isArray(chat_history) ? chat_history : [];
      let messagesAdded = 0;
      const maxMessages = is_first_message ? 2 : (memory_summary ? 3 : 4);
      
      for (const msg of safe_chat_history) {
        if (!msg?.role || !msg?.content) continue;
        
        if (msg.content.length > 250) {
          prompt.push({ role: msg.role, content: msg.content.substring(0, 150) + "... [truncated]" });
        } else {
          prompt.push({ role: msg.role, content: msg.content });
        }
        messagesAdded++;
        if (messagesAdded >= maxMessages) break;
      }

      // Add current user message
      if (user_message) {
        prompt.push({ role: "user", content: user_message });
      }
    } catch (error) {
      console.error('Error constructing prompt:', error);
      return {
        model: 'gpt-3.5-turbo',
        prompt: [
          { role: "system", content: promptConfig.system.short },
          { role: "user", content: user_message || "Hello" }
        ]
      };
    }    console.log('Final prompt and model:', {
      modelSelected: model,
      promptLength: prompt.length,
      systemPromptPreview: prompt[0].content.substring(0, 100) + '...',
      coachSpecific: Boolean(profile?.coach_profile?.system_prompt)
    });

    // Add goal debugging
    console.log('Goal debugging:', {
      structuredGoalsCount: profile.goals?.length || 0,
      structuredGoals: profile.goals?.map(g => g.label) || [],
      legacyGoals: profile.simple_goals || 'none',
      memoryHasGoals: (profile.last_memory_summary || '').includes('goal'),
      contextIncludesGoals: context_message.includes('GOALS')
    });

    return { model, prompt };
  }  // Handle GET requests for user data
  if (req.method === 'GET') {
    const { email, action } = req.query
    
    // Special case for listing users (admin helper)
    if (action === 'list_users') {
      try {
        const { data: users, error } = await supabase
          .from('users')
          .select('id, email, first_name')
          .limit(10);
          
        if (error) throw error;
        
        return res.status(200).json({ 
          users: users.map(u => ({ 
            id: u.id,
            email: u.email, 
            first_name: u.first_name || 'Unknown'
          }))
        });
      } catch (error) {
        console.error('Error listing users:', error);
        return res.status(500).json({ error: 'Failed to list users' });
      }
    }
    
    // For all other actions, email is required
    if (!email) {
      return res.status(400).json({ error: 'Email is required' })
    }

    // Handle session end summarization
    if (action === 'end_session') {
      try {
        const { data: user } = await supabase.from('users').select('id').eq('email', email).single();
        if (!user) return res.status(404).json({ error: 'User not found' });
        
        console.log('Processing session end summarization for user:', user.id);
        await updateMemorySummary(user.id, true); // sessionEnd = true
        
        return res.status(200).json({ message: 'Session ended and memory summarized' });
      } catch (error) {
        console.error('Session end error:', error);
        return res.status(500).json({ error: 'Failed to end session' });
      }
    }  // Handle force memory summarization
    if (action === 'refresh_memory') {      
      try {
        const { data: user } = await supabase.from('users').select('id').eq('email', email).single();
        if (!user) return res.status(404).json({ error: 'User not found' });
        
        console.log('Forcing memory summarization for user:', user.id);
        
        // First ensure user profile exists
        await ensureUserProfile(user.id);
        
        // Then update memory
        const summary = await updateMemorySummary(user.id, true); // sessionEnd = true for more comprehensive summary
        
        // Check if memory was actually saved
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('memory_summary, updated_at')
          .eq('user_id', user.id)
          .single();
          
        let profileStatus = "Unknown";
        let summaryUpdated = false;
        
        if (profileError) {
          profileStatus = `Error fetching profile: ${profileError.message}`;
        } else {
          profileStatus = profile.memory_summary ? 
            `Profile has memory_summary of length ${profile.memory_summary.length} (updated: ${profile.updated_at})` : 
            'Profile exists but memory_summary is empty';
          summaryUpdated = profile.memory_summary && profile.memory_summary.length > 0;
        }
          // Log the operation
        try {
          const memoryLogger = require('../../lib/memoryLogger');
          memoryLogger.logMemoryEvent(user.id, email, 'MANUAL_REFRESH', {
            success: Boolean(summary),
            summaryLength: summary?.length || 0,
            profileStatus
          });
        } catch (logErr) {
          console.error('Error logging memory refresh:', logErr);
        }
        
        return res.status(200).json({ 
          message: 'Memory summarization completed', 
          summary_length: summary ? summary.length : 0,
          summary_preview: summary ? summary.substring(0, 100) + '...' : 'No summary generated',
          profile_status: profileStatus,
          updated: summaryUpdated,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Forced memory summarization error:', error);
        return res.status(500).json({ error: 'Failed to generate memory summary', details: error.message });
      }
    }// This section was moved up to handle the case without email

    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('id, email, tokens, first_name, age, city, country, marital_status, created_at, coach_profile_id')
        .eq('email', email)
        .single()

      if (error || !user) {
        console.error('User lookup error:', error)
        return res.status(404).json({ error: 'User not found' })
      }

      return res.status(200).json({
        id: user.id,  // Add database user ID
        tokens: user.tokens || 0,
        firstName: user.first_name,
        email: user.email,
        age: user.age,
        city: user.city,
        country: user.country,
        maritalStatus: user.marital_status,
        lastLogin: user.created_at,
        coach_profile_id: user.coach_profile_id
      })
    } catch (error) {
      console.error('API error:', error)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }  // Handle POST requests for chat
  if (req.method === 'POST') {
    try {
      const { email, message, isFirstMessage } = req.body;
      if (!email || !message) return res.status(400).send('Missing email or message');

      console.log('=== CHAT REQUEST START ===');
      console.log('Email:', email);
      console.log('Message:', message);
      console.log('Is explicit first message:', isFirstMessage === true);

      // Get user with coach profile
      const { data: user, error: userError } = await supabase
        .from('users')
        .select(`
          id, 
          coach_profile_id, 
          tokens, 
          first_name,
          coach_profiles (
            id,
            code,
            label,
            system_prompt,
            medium_prompt,
            short_prompt
          )
        `)
        .eq('email', email)
        .single();      if (userError || !user) {
        console.error('Error fetching user:', userError);
        return res.status(404).json({ error: 'User not found' });
      }

      const user_id = user.id;

      // Update user activity tracking for session management
      try {
        await updateLastActivity(user_id);
      } catch (activityError) {
        console.error('Error updating user activity:', activityError);
        // Don't fail the request for activity tracking errors
      }

      // Check for session timeout and trigger memory update if needed
      try {
        const sessionEndCheck = await shouldTriggerSessionEndUpdate(user_id);
        if (sessionEndCheck.shouldUpdate) {
          console.log(`Triggering session-end memory update due to inactivity: ${sessionEndCheck.reason}`);
          console.log(`Time since last message: ${sessionEndCheck.messageStatus.minutesSinceMessage} minutes`);
          
          // Trigger session-end memory update in background
          updateMemorySummary(user_id, true).then(summary => {
            if (summary) {
              console.log('Session-end memory update completed due to inactivity');
            }
          }).catch(err => {
            console.error('Error in session-end memory update:', err);
          });        }
      } catch (sessionError) {
        console.error('Error checking session timeout:', sessionError);
        // Don't fail the request for session checking errors
      }

      console.log('Found user:', user_id);
      console.log('User coach profile:', user.coach_profiles?.code);
      console.log('User first name:', user.first_name);

      // Special handling for initialization message
      let actualMessage = message;
      let is_init_message = false;
      
      if (message === '__INIT_CHAT__') {
        actualMessage = `Please greet me warmly by name and recall our previous conversations. My name is ${user.first_name || 'there'}. Reference any goals, challenges, or context from our past discussions.`;        is_init_message = true;
        console.log('Converting __INIT_CHAT__ to personalized greeting request');
      }

      // Ensure user has tokens (but be more lenient for greeting messages)
      const minTokensRequired = is_init_message ? 50 : 100;
      if (user.tokens < minTokensRequired) {
        return res.status(403).json({ 
          error: 'Insufficient tokens',
          required: minTokensRequired,
          available: user.tokens
        });
      }

      // Ensure user profile exists
      const profileExists = await ensureUserProfile(user_id);
      if (!profileExists) {
        return res.status(500).json({ error: 'Could not create or verify user profile' });
      }

      // Get user profile and context with coach profile included
      const profile = await getUserProfile(user_id);
      if (!profile) {
        return res.status(500).json({ error: 'Could not load user profile data' });
      }

      // Add coach profile to user profile if not already there
      if (user.coach_profiles && !profile.coach_profile) {
        profile.coach_profile = user.coach_profiles;
        profile.coach_profile_id = user.coach_profile_id;
      }

      console.log('Profile loaded with coach:', profile.coach_profile?.code);

      // Get chat history
      const { data: chat_history } = await supabase
        .from('chat_messages')
        .select('role, content')
        .eq('user_id', user_id)
        .order('created_at', { ascending: true })
        .limit(10);

      let is_first_message = isFirstMessage || !chat_history || chat_history.length === 0;
      
      console.log('Message type:', {
        is_first_message,
        is_init_message,
        history_length: chat_history?.length || 0,
        coach_profile: profile.coach_profile?.code
      });

      // Get prompt and model with coach profile information
      const { model, prompt } = await getPromptAndModel(
        user_id,
        actualMessage,
        profile,
        chat_history || [],
        is_first_message,
        is_init_message
      );

      if (!model || !prompt) {
        console.error('Invalid model or prompt returned');
        return res.status(500).json({ error: 'Failed to generate conversation parameters' });
      }      console.log('Using model:', model);
      console.log('Coach-specific prompt being used:', profile.coach_profile ? 'YES' : 'NO');

      // Generate cache key for potential caching
      const cacheKey = getCacheKey(user_id, actualMessage, profile.onboarding_context || '');
      
      // Check cache for recent responses (but skip for init messages to ensure fresh greetings)
      if (!is_init_message) {
        const cachedResponse = getCachedResponse(cacheKey);
        if (cachedResponse) {
          console.log('Returning cached response');
          return res.status(200).json(cachedResponse);
        }
      }

      // Token counting with safety checks (input)
      let inputTokens = 0;
      let encoder;
      
      // Ensure we have valid model and prompt for token counting
      const safeModel = model || 'gpt-3.5-turbo';
      const safePrompt = Array.isArray(prompt) ? prompt : [{ role: "user", content: actualMessage || "Hello" }];
      
      try {
        encoder = encoding_for_model(safeModel);
        inputTokens = safePrompt.reduce((sum, m) => {
          if (!m || !m.content) return sum;
          return sum + encoder.encode(m.content).length;
        }, 0);
      } catch (error) {
        console.error('Error encoding tokens:', error);
        // Fallback to a rough estimate
        inputTokens = safePrompt.reduce((sum, m) => sum + ((m?.content?.length || 0) / 4), 0);
      }      // Estimate output tokens with more sophisticated logic
      let estimatedOutputTokens;
      
      if (is_init_message) {
        // For init messages, estimate based on memory summary length and personalization needs
        const memoryLength = profile.last_memory_summary?.length || 0;
        const hasRichContext = memoryLength > 100 || profile.goals?.length > 0 || profile.challenges?.length > 0;
        
        if (hasRichContext) {
          // Need more tokens for personalized responses with context
          estimatedOutputTokens = Math.min(inputTokens * 1.2 + 100, 200);
        } else {
          // Simple greeting, fewer tokens needed
          estimatedOutputTokens = Math.min(inputTokens * 0.8, 120);
        }
      } else if (is_first_message) {
        // First messages often need more comprehensive responses
        estimatedOutputTokens = Math.min(inputTokens * 1.5 + 50, 300);
      } else {
        // Regular conversation flow
        const isComplexQuery = actualMessage.length > 100 || 
                              actualMessage.includes('?') || 
                              /(how|why|what|when|where|explain|tell me about)/i.test(actualMessage);
        
        if (isComplexQuery) {
          estimatedOutputTokens = Math.min(inputTokens * 2, 500);
        } else {
          estimatedOutputTokens = Math.min(inputTokens * 1.2 + 30, 250);
        }
      }
      
      const estimatedTotalTokens = inputTokens + estimatedOutputTokens;    console.log('Token estimation:', {
      inputTokens,
      estimatedOutputTokens,
      estimatedTotalTokens,
      userTokens: user.tokens,
      isInitMessage: is_init_message
    });

    // Check user balance with much more reasonable limits for init messages
    const tokenCheckThreshold = is_init_message ? 
      Math.min(estimatedTotalTokens, 75) : // Much lower cap for init messages - just need basic greeting
      estimatedTotalTokens;
      
    if (user.tokens < tokenCheckThreshold) {
      if (encoder) encoder.free();
      console.log('Token check failed:', {
        userTokens: user.tokens,
        requiredTokens: tokenCheckThreshold,
        originalEstimate: estimatedTotalTokens,
        isInitMessage: is_init_message
      });
      return res.status(403).json({
        error: 'Insufficient tokens',
        required: tokenCheckThreshold,
        available: user.tokens,
        message: `This conversation requires approximately ${tokenCheckThreshold} tokens, but you only have ${user.tokens}. Please purchase more tokens.`
      });
    }

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: safeModel,
      messages: safePrompt,
      max_tokens: safeModel.includes('gpt-4') ? 500 : 400, // Reduce token limit for gpt-3.5
      temperature: 0.7,
      presence_penalty: 0.3, // Slight penalty to avoid repetition
    });
    const aiReply = completion.choices[0]?.message?.content || '';
    
    // Token counting (actual)
    const outputTokens = encoder ? encoder.encode(aiReply).length : Math.ceil(aiReply.length / 4);
    const totalTokensUsed = inputTokens + outputTokens;
    if (encoder) encoder.free();

    // Deduct tokens
    const newTokenBalance = Math.max(0, user.tokens - totalTokensUsed);
    await supabase.from('users').update({ tokens: newTokenBalance }).eq('id', user.id);    // Store chat messages with metadata
    await storeChatMessage(user_id, 'user', message, safeModel, inputTokens);
    await storeChatMessage(user_id, 'assistant', aiReply, safeModel, outputTokens);
    
    // Prepare response object
    const responseObj = {
      response: aiReply,
      tokensUsed: totalTokensUsed,
      remainingTokens: newTokenBalance,
      tokenBreakdown: {
        input: inputTokens,
        output: outputTokens,
        total: totalTokensUsed
      }
    };
    
    // Cache the response    setCachedResponse(cacheKey, responseObj);    // Enhanced summarization logic with multiple trigger conditions
    const totalMessages = chat_history.length + 2; // +2 for current user message and AI response
    
    // Helper: Check if message contains substantial content
    const isSubstantialMessage = (msg) => {
      return msg.content.length > 20 && 
             !/^(yes|no|ok|okay|hmm|thanks|sure|right|exactly|absolutely)$/i.test(msg.content.trim());
    };
    
    // Helper: Detect potential breakthrough moments
    const hasBreakthroughKeywords = (msg) => {
      const breakthroughKeywords = ['realize', 'understand', 'breakthrough', 'clarity', 'insight', 
                                   'epiphany', 'clicking', 'makes sense', 'aha', 'figured out',
                                   'discovered', 'learned', 'perspective', 'eye-opening'];
      return breakthroughKeywords.some(keyword => msg.toLowerCase().includes(keyword));
    };
    
    // Count substantial messages for quality-based triggering
    const substantialMessages = chat_history.filter(isSubstantialMessage);
    const recentSubstantialCount = substantialMessages.length + (isSubstantialMessage({content: message}) ? 1 : 0);
    
    // Time-based fallback check
    let timeTrigger = false;
    if (profile.last_memory_summary) {
      const lastUpdateTime = new Date(profile.updated_at || Date.now() - 86400000); // Default to 24h ago if no timestamp
      const hoursSinceUpdate = (Date.now() - lastUpdateTime.getTime()) / (1000 * 60 * 60);
      timeTrigger = hoursSinceUpdate > 24 && totalMessages > 2; // At least some conversation happened
      if (timeTrigger) {
        console.log(`Time-based trigger: ${Math.round(hoursSinceUpdate)} hours since last update`);
      }
    }
      // Breakthrough moment detection
    const breakthroughTrigger = hasBreakthroughKeywords(message);
    if (breakthroughTrigger) {
      console.log('Breakthrough moment detected in user message');
    }
    
    // Topic shift detection
    let topicShiftTrigger = false;
    let topicShiftInfo = {};
    if (profile.last_memory_summary && chat_history.length >= 3) {
      topicShiftInfo = detectTopicShift(chat_history, profile.last_memory_summary);
      topicShiftTrigger = topicShiftInfo.hasShift;
      if (topicShiftTrigger) {
        console.log(`Topic shift detected: ${topicShiftInfo.reason}, similarity: ${topicShiftInfo.similarity}`);
        console.log(`Recent topics: [${topicShiftInfo.recentTopics?.join(', ')}], Memory topics: [${topicShiftInfo.memoryTopics?.join(', ')}]`);
      }
    }
    
    // Multiple trigger conditions for comprehensive coverage
    const shouldUpdateMemory = 
      totalMessages % 6 === 0 ||                           // Periodic: every 6 messages
      !profile.last_memory_summary ||                      // No existing memory
      recentSubstantialCount % 4 === 0 ||                  // Quality-based: every 4 substantial messages
      timeTrigger ||                                       // Time-based: 24+ hours since last update
      breakthroughTrigger ||                               // Breakthrough moment detected
      topicShiftTrigger;                                   // Significant topic shift detected
    
    if (shouldUpdateMemory) {
      const triggerReason = !profile.last_memory_summary ? 'no_existing_memory' :
                           totalMessages % 6 === 0 ? 'periodic_6_messages' :
                           recentSubstantialCount % 4 === 0 ? 'quality_4_substantial' :
                           timeTrigger ? 'time_24_hours' :
                           breakthroughTrigger ? 'breakthrough_detected' : 
                           topicShiftTrigger ? 'topic_shift_detected' : 'unknown';
        console.log(`Triggering memory summarization: ${triggerReason} (total: ${totalMessages}, substantial: ${recentSubstantialCount}, memory exists: ${Boolean(profile.last_memory_summary)})`);
      
      try {
        // Wait for the memory summarization to complete (don't run in background)
        // This ensures memory is updated before the next user interaction
        // Use comprehensive update for breakthroughs, topic shifts, and time-based updates
        const useComprehensiveUpdate = breakthroughTrigger || timeTrigger || topicShiftTrigger;
        const summary = await updateMemorySummary(user_id, useComprehensiveUpdate);
        if (summary) {
          console.log('Memory summarization completed successfully, summary length:', summary.length);
            // Log success with more details
          try {
            const memoryLogger = require('../../lib/memoryLogger');            memoryLogger.logMemoryEvent(user_id, email, 'MEMORY_UPDATE_SUCCESS', {
              trigger: triggerReason,
              messageCount: totalMessages,
              substantialCount: recentSubstantialCount,
              summaryLength: summary.length,
              topicShift: topicShiftTrigger ? topicShiftInfo : null
            });
          } catch (logErr) {
            console.error('Error logging memory success:', logErr);
          }
        } else {
          console.log('Memory summarization process completed but no summary was generated');
          
          // Try to check why it failed
          try {
            const { data: profile } = await supabase
              .from('user_profiles')
              .select('memory_summary')
              .eq('user_id', user_id)
              .single();
              
            console.log(`Current profile memory_summary length: ${profile?.memory_summary?.length || 0}`);
          } catch (checkErr) {
            console.error('Error checking profile after failed summarization:', checkErr);
          }
        }
      } catch (err) {
        console.error('Memory summarization failed:', err);
        console.error('Error stack trace:', err.stack);
        
        // Enhanced retry logic with better fallback strategy
        try {
          console.log('Retrying memory summarization with comprehensive approach...');
          // Force session end to ensure we get a good summary
          const summary = await updateMemorySummary(user_id, true);
          if (summary) {
            console.log('Retry successful, summary length:', summary.length);
            
            // Log successful retry
            try {
              const memoryLogger = require('../../lib/memoryLogger');
              memoryLogger.logMemoryEvent(user_id, email, 'MEMORY_UPDATE_RETRY_SUCCESS', {
                originalTrigger: triggerReason,
                retryType: 'comprehensive'
              });
            } catch (logErr) {
              console.error('Error logging retry success:', logErr);
            }
          } else {
            console.log('Retry completed but no summary was generated');
            
            // Log retry failure for monitoring
            try {
              const memoryLogger = require('../../lib/memoryLogger');
              memoryLogger.logMemoryEvent(user_id, email, 'MEMORY_UPDATE_RETRY_FAILED', {
                originalTrigger: triggerReason,
                totalMessages,
                substantialCount: recentSubstantialCount
              });
            } catch (logErr) {
              console.error('Error logging retry failure:', logErr);
            }
            
            // Last resort: use the repair-memory script
            try {
              console.log('Attempting emergency memory repair...');
              const { exec } = require('child_process');
              exec(`node repair-memory.js ${email}`, (error, stdout, stderr) => {
                if (error) {
                  console.error('Memory repair failed:', error);
                  return;
                }
                console.log('Memory repair output:', stdout);
                if (stderr) console.error('Memory repair stderr:', stderr);
              });
            } catch (repairErr) {              console.error('Failed to run memory repair:', repairErr);
            }
          }
        } catch (retryErr) {
          console.error('Retry memory summarization also failed:', retryErr);
          console.error('Retry error stack trace:', retryErr.stack);
        }
      }
    }
    
    return res.status(200).json(responseObj);
    } catch (error) {
      console.error('=== CHAT API ERROR ===');
      console.error('Error details:', error);
      console.error('Stack trace:', error.stack);
      return res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }
  // Method not allowed
  return res.status(405).send('Method not allowed')
}

// Export the handler with error handling wrapper
export default withErrorHandling(gptRouterHandler);
