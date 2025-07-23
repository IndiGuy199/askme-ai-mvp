// gptRouter.js - Main API handler for AskMe AI chat system

const { OpenAI } = require('openai');
const { createClient } = require('@supabase/supabase-js')
const { encoding_for_model } = require('tiktoken')
const crypto = require('crypto')

// Import prompt configuration
const { promptConfig, loadCoachPrompts } = require('../../lib/promptConfig')
const promptStrategy = require('../../lib/promptStrategy')
const determineIfNewTopic = require('../../lib/topicDetector')
const { detectTopicShift } = require('../../lib/topicShiftDetector')
const { updateLastActivity, shouldTriggerSessionEndUpdate } = require('../../lib/sessionTracker')
const { detectUserIntent } = require('../../lib/intentDetector')

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE)
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// Import error handler
const { withErrorHandling } = require('../../lib/apiErrorHandler')

// Helper functions for response chunking
function chunkResponse(text, maxChunkLength = 1500) {
  if (!text || text.length <= maxChunkLength) {
    return [text]
  }

  const chunks = []
  let currentChunk = ''
  
  // First try to split by paragraphs (double newlines)
  const paragraphs = text.split(/\n\s*\n/)
  
  for (const paragraph of paragraphs) {
    // If paragraph itself is too long, split by sentences
    if (paragraph.length > maxChunkLength) {
      const sentences = paragraph.split(/(?<=[.!?])\s+/)
      
      for (const sentence of sentences) {
        // Check if adding this sentence would exceed the limit
        if (currentChunk.length + sentence.length + 2 <= maxChunkLength) {
          currentChunk += (currentChunk ? '\n\n' : '') + sentence
        } else {
          // Save current chunk if it has content
          if (currentChunk) {
            chunks.push(currentChunk.trim())
            currentChunk = sentence
          } else {
            // Handle very long sentences by splitting on word boundaries
            const words = sentence.split(' ')
            for (const word of words) {
              if (currentChunk.length + word.length + 1 <= maxChunkLength) {
                currentChunk += (currentChunk ? ' ' : '') + word
              } else {
                if (currentChunk) {
                  chunks.push(currentChunk.trim())
                  currentChunk = word
                } else {
                  // Very long word, force split
                  chunks.push(word.slice(0, maxChunkLength))
                  currentChunk = word.slice(maxChunkLength)
                }
              }
            }
          }
        }
      }
    } else {
      // Paragraph is reasonable size, check if we can add it to current chunk
      if (currentChunk.length + paragraph.length + 2 <= maxChunkLength) {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph
      } else {
        // Save current chunk and start new one with this paragraph
        if (currentChunk) {
          chunks.push(currentChunk.trim())
        }
        currentChunk = paragraph
      }
    }
  }

  // Add the final chunk
  if (currentChunk) {
    chunks.push(currentChunk.trim())
  }

  return chunks.filter(chunk => chunk.length > 0)
}

function getPreviewText(text, maxLength = 150) {
  if (!text) return ''
  if (text.length <= maxLength) return text
  
  const firstSentence = text.split(/[.!?]/)[0]
  if (firstSentence.length <= maxLength) return firstSentence + '...'
  
  return text.substring(0, maxLength).trim() + '...'
}

function generateConversationId() {
  return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

async function storeChunkedResponse(user_id, chunks, conversationId) {
  console.log(`� STORAGE START: Called with user_id=${user_id}, chunks=${chunks.length}, conversationId=${conversationId}`);
  
  try {
    // Check if user_id is valid UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(user_id)) {
      console.error(`� STORAGE ERROR: Invalid user_id format: ${user_id}`);
      return false;
    }
    
    console.log(`🚨 STORAGE: user_id is valid UUID`);
    
    const insertData = {
      user_id,
      conversation_id: conversationId,
      chunks,
      total_chunks: chunks.length,
      current_chunk: 1
    };
    
    console.log(`� STORAGE: About to insert data`);
    
    // Use service role client for admin access
    const { createClient } = require('@supabase/supabase-js');
    
    const supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    
    console.log(`� STORAGE: Supabase client created`);

    const { data, error } = await supabaseClient
      .from('chat_chunks')
      .insert(insertData);

    if (error) {
      console.error('� STORAGE ERROR:', error);
      return false;
    }

    console.log(`� STORAGE SUCCESS: Stored chunks`);
    return true;
  } catch (error) {
    console.error('� STORAGE EXCEPTION:', error);
    return false;
  }
}

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
  }// Helper: Get last N chat messages for user (improved for better context)
  async function getLastNMessages(user_id, n = 8) { // Increased from 4 to 8
    // Get recent messages (6-12 range for better context continuity)
    const limit = Math.min(Math.max(n, 6), 12); // Increased from 3-6 range
    
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
    }
    
    const limit = sessionEnd ? 12 : 8; // OPTIMIZED: Further reduced limits for token efficiency
    console.log(`Fetching up to ${limit} recent messages for summary update (OPTIMIZED)`);
    
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
    
    // --- ENHANCED CONTEXT RESTORATION & SUMMARY UPDATE LOGIC ---
    if (!messages || messages.length < 6) {
      console.log('Not enough recent messages for meaningful summary update (need at least 6)');
      try {
        const memoryLogger = require('../../lib/memoryLogger');
        memoryLogger.logMemoryEvent(user_id, userData?.email, 'INSUFFICIENT_RECENT_MESSAGES', 
          { messageCount: messages?.length || 0, minimumRequired: 6 });
      } catch (logErr) {
        console.error('Error logging insufficient messages:', logErr);
      }
      // Fallback: do NOT overwrite previous summary, return previous summary
      return currentSummary; // Prevent summary overwrite if not enough context
    }

    // Improved approach: Focus on most recent meaningful conversation
    // Get last 12 messages but prioritize user messages and substantial assistant responses
    const recentMessages = messages
      .slice(-12)
      .filter(m => m.role === 'user' || (m.role === 'assistant' && m.content.length > 50))
      .slice(-8);

    // Always include most recent user topics, even if last few messages are short
    let recentTopics = [];
    for (let i = recentMessages.length - 1; i >= 0; i--) {
      const msg = recentMessages[i];
      if (msg.role === 'user' && msg.content.length > 10) {
        // Extract topic keywords (simple heuristic)
        const topicMatch = msg.content.match(/(motivation|anxiety|stress|sleep|work|relationship|goal|challenge|problem|issue|breakthrough|decision|habit|routine|energy|focus|confidence|fear|worry|sadness|anger|frustration|hope|change|progress|improvement|solution|plan|strategy)/i);
        if (topicMatch) {
          recentTopics.push(topicMatch[0].toLowerCase());
        }
      }
      if (recentTopics.length >= 2) break; // Only need last 2 topics
    }
    recentTopics = [...new Set(recentTopics)]; // Deduplicate

    const recentConversation = recentMessages
      .map(m => {
        // Truncate very long messages but keep important context
        const content = m.content.length > 500 ? m.content.substring(0, 500) + "..." : m.content;
        return `${m.role}: ${content}`;
      })
      .join('\n\n');

    // Build updatePrompt string correctly
    // ...existing code...
    // --- ENHANCED MEMORY SUMMARY LOGIC ---

    // --- Helper functions for richer extraction ---
    function extractTopics(messages) {
      const topicKeywords = [
        'anxiety','depression','work','stress','sleep','family','relationship','health','coping','boundaries','therapy','improvement','night','day','emotion','hopeless','frustration','advice','goal','challenge','motivation','energy','focus','confidence','fear','anger','sadness','support','routine','habit','exercise','diet','nutrition','self-care','relaxation','overwhelm','burnout','productivity','rest','meditation','mindfulness','gratitude','journaling','reflection','change','transition','loss','grief','achievement','success','failure','conflict','communication','trust','growth','learning','acceptance','forgiveness','regret','resentment','hope','optimism','pessimism','worry','panic','isolation','loneliness','connection','friendship','parenting','children','partner','spouse','divorce','breakup','dating','social','money','finance','career','job','school','education','bullying','trauma','abuse','addiction','recovery','healing','diagnosis','treatment','medication','doctor','hospital','appointment','symptom','pain','fatigue','illness','injury','disability','accommodation','goal','challenge'
      ];
      const found = new Set();
      messages.forEach(msg => {
        topicKeywords.forEach(keyword => {
          if (msg.content && msg.content.toLowerCase().includes(keyword)) found.add(keyword);
        });
      });
      return Array.from(found);
    }

    function extractActions(messages) {
      // Look for verbs/actions/decisions
      const actionPatterns = /(tried|did|started|set|used|implemented|changed|avoided|talked|shared|asked|expressed|decided|focused|coping|breathed|journaled|slept|vented|set boundaries|took a break|reached out|planned|scheduled|committed|reflected|meditated|practiced|wrote|read|listened|watched|called|messaged|emailed|visited|joined|left|quit|resumed|completed|achieved|failed|attempted|considered|explored|researched|learned|applied|adapted|adjusted|reported|noticed|felt|experienced|observed|identified|recognized|adopted|discarded|maintained|improved|progressed|regressed|relapsed|overcame|struggled|persisted|persevered|gave up|kept going|followed|ignored|accepted|rejected|embraced|let go|held on|supported|helped|encouraged|motivated|inspired|comforted|soothed|calmed|relaxed|energized|activated|deactivated)/i;
      return messages.filter(msg => actionPatterns.test(msg.content)).map(msg => msg.content);
    }

    function extractBreakthroughs(messages) {
      // Look for breakthrough/insight patterns
      return messages.filter(msg => /improved|breakthrough|felt better|new insight|aha|realization|major progress|finally understand|clarity|epiphany|life-changing|reported improvement|big change|success|achievement|overcame|resolved|solved|figured out|understood|got it|made sense|breakthrough moment|milestone|step forward|positive change|turning point/i.test(msg.content)).map(msg => msg.content);
    }

    function extractRecurringIssues(messages) {
      // Find repeated topics/issues
      const issues = {};
      messages.forEach(msg => {
        const topicMatch = msg.content.match(/anxiety|depression|sleep|work|stress|family|relationship|hopeless|frustration|challenge|goal|emotion|night|day|pain|fatigue|worry|fear|anger|sadness|conflict|communication|isolation|loneliness|burnout|overwhelm|addiction|trauma|abuse|symptom|illness|diagnosis|treatment|medication|doctor|hospital|appointment|failure|regret|resentment|money|finance|career|job|school|bullying|loss|grief|breakup|divorce|children|parenting|partner|spouse|dating|social/i);
        if (topicMatch && topicMatch[0]) {
          const topic = topicMatch[0];
          issues[topic] = (issues[topic] || 0) + 1;
        }
      });
      // Only return issues that appear more than twice
      return Object.entries(issues).filter(([_, count]) => count > 2).map(([topic]) => topic);
    }

    function buildMemorySummary(messages, previousSummary) {
      // Extract topics, actions, breakthroughs, recurring issues
      const topics = extractTopics(messages);
      const actions = extractActions(messages);
      const breakthroughs = extractBreakthroughs(messages);
      const recurring = extractRecurringIssues(messages);
      return [
        previousSummary ? previousSummary : '',
        topics.length ? `Recent topics: ${topics.join(', ')}` : '',
        actions.length ? `User actions: ${actions.join('; ')}` : '',
        breakthroughs.length ? `Breakthroughs: ${breakthroughs.join('; ')}` : '',
        recurring.length ? `Recurring issues: ${recurring.join('; ')}` : ''
      ].filter(Boolean).join('\n');
    }

    // --- Hierarchical memory structure stub (for future use) ---
    function getHierarchicalMemory(userId) {
      // Example structure, actual implementation would query DB and compress context
      return {
        immediate: getLastNMessages(userId, 3),
        recent: getLastNMessages(userId, 10), // Could be compressed context
        session: null, // getSessionSummary(userId) - to implement
        longTerm: null // getPersonalitySummary(userId) - to implement
      };
    }

    // Build enhanced summary
    let enhancedSummary = buildMemorySummary(recentMessages, currentSummary);
    // If summary exists, inject recent topics
    if (enhancedSummary && recentTopics.length > 0) {
      enhancedSummary += `\n\nRecent topics: ${recentTopics.join(', ')}`;
    }
    const updatePrompt = `EXISTING SUMMARY:\n${currentSummary || 'No previous summary - this is the first summary for this user.'}\n\nRECENT CONVERSATION:\n${recentConversation}\n\nINSTRUCTION: Summarize only the relevant information from the user's recent chat interactions. Do NOT include user goals or challenges. Keep the summary concise (max 250 words) and focused only on the user's conversational context, emotional state, key topics discussed, user actions/decisions, breakthroughs, and recurring issues.\n\nENHANCED SUMMARY:\n${enhancedSummary}`;
      console.log(`Updating memory summary for user ${user_id} (${sessionEnd ? 'session end' : 'periodic update'})`);
    console.log(`Existing summary length: ${currentSummary?.length || 0} chars`);
    console.log(`Recent conversation: ${recentMessages.length} filtered messages from ${messages.length} total`);
    
    try {      console.log('Calling OpenAI API for memory summary update...');      const summaryRes = await openai.chat.completions.create({
        model: 'gpt-4-turbo',
        messages: [{ role: 'user', content: updatePrompt }],
        max_tokens: 500, // Slightly more for better summaries
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
  }

  // 🎯 INTENT-BASED STYLE & FORMAT MAPPING SYSTEM
  // Maps user intent to preferred communication style and coaching format
  const intentStyleFormatMap = {
    'FRUSTRATED':        { communication_style: 'direct',   coaching_format: 'concise'  },
    'MEDICAL_URGENCY':   { communication_style: 'direct',   coaching_format: 'concise'  },
    'ADVICE_REQUEST':    { communication_style: 'step-by-step',  coaching_format: 'detailed'    },
    'REPEAT_ADVICE_REQUEST': { communication_style: 'direct', coaching_format: 'concise'},
    'FOLLOW_UP_ADVICE':  { communication_style: 'step-by-step',  coaching_format: 'detailed'  },
    'META_CONVERSATION': { communication_style: 'gentle-encouraging', coaching_format: 'conversational' },
    'EMOTIONAL_SHARING': { communication_style: 'gentle-encouraging',   coaching_format: 'conversational'},
    'SIMPLE_EMOTIONAL_SHARING': { communication_style: 'gentle-encouraging', coaching_format: 'conversational'},
    'EXPLORATION_PREFERENCE': { communication_style: 'gentle-encouraging', coaching_format: 'conversational'},
    'ADVICE_FOCUSED':    { communication_style: 'step-by-step', coaching_format: 'detailed'  },
    'GENERAL_CONVERSATION': { communication_style: 'gentle-encouraging', coaching_format: 'conversational' },
    'DIAGNOSTIC_REQUEST': { communication_style: 'step-by-step', coaching_format: 'detailed' },
    'FOLLOW_UP_ADVICE_REQUEST': { communication_style: 'step-by-step', coaching_format: 'detailed' },
    'CONTEXT_SHARING': { communication_style: 'gentle-encouraging', coaching_format: 'conversational' },
    'EMOTIONAL_SHARING_WITH_VALIDATION': { communication_style: 'gentle-encouraging', coaching_format: 'conversational' },
    'BOUNDARY_RESPECT': { communication_style: 'gentle-encouraging', coaching_format: 'conversational' },
    'ADVICE_REJECTION': { communication_style: 'gentle-encouraging', coaching_format: 'detailed' },
    'FALLBACK_REQUEST': { communication_style: 'step-by-step', coaching_format: 'detailed' },
    'CHOICE_REQUEST': { communication_style: 'step-by-step', coaching_format: 'detailed' },
    'DIRECT_ADVICE_REQUEST': { communication_style: 'direct', coaching_format: 'concise' }
    // ...extend as needed
  };

  // Selector function to get style and format for a given intent
  function getStyleAndFormatForIntent(userIntent) {
    const defaultStyle = 'gentle-encouraging';
    const defaultFormat = 'conversational';
    
    const mapping = intentStyleFormatMap[userIntent];
    if (mapping) {
      console.log(`🎯 Intent mapping: ${userIntent} -> style: ${mapping.communication_style}, format: ${mapping.coaching_format}`);
      return mapping;
    }
    
    console.log(`🎯 Intent mapping: ${userIntent} -> using defaults (style: ${defaultStyle}, format: ${defaultFormat})`);
    return { 
      communication_style: defaultStyle, 
      coaching_format: defaultFormat 
    };
  }

  // Main algorithm: Get prompt and model with caching and token optimization
  async function getPromptAndModel(user_id, user_message, profile, chat_history, is_first_message = false, is_init_message = false) {
    // 1. Extract data more efficiently
    const context = profile?.onboarding_context || '';
    const memory_summary = profile?.last_memory_summary || '';
    const hasGoals = profile?.goals?.length > 0;
    const hasChallenges = profile?.challenges?.length > 0;
    const firstName = profile?.first_name || '';
    
    // Calculate context size for model selection
    const contextSize = (memory_summary?.length || 0) + (context?.length || 0);
  
    // 🎯 MUTUALLY EXCLUSIVE, HIERARCHICAL INTENT RESOLVER
    // Issue detection removed from prompt construction. Only style guidelines and context will be injected.

    // --- Detect user intent early to avoid ReferenceError ---
    const userIntent = detectUserIntent(user_message, chat_history || []);
    console.log('🧠 Detected userIntent:', userIntent);

    // Update conversation state
    let conversationState = null;
    try {
      const { updateConversationState } = require('../../lib/conversationState');
      conversationState = updateConversationState(user_id, userIntent, user_message);
      console.log(`🎯 Conversation state: ${conversationState.dominantIntent}, questions: ${conversationState.consecutiveQuestions}`);
    } catch (err) {
      console.error('Error updating conversation state:', err);
    }

    // 2. Model selection - more token-efficient strategy
    let model = 'gpt-4-turbo'; // Always use GPT-4-turbo for chat
    
    if (is_init_message) {
      model = memory_summary?.length > 100 ? 'gpt-4-turbo' : 'gpt-4-turbo';
    } else if (is_first_message && (!hasGoals && !hasChallenges)) {
      model = 'gpt-4-turbo';
    } else if (!isSimpleRequest(user_message, contextSize)) {
      model = 'gpt-4-turbo';
    }

    // 3. ENHANCED SYSTEM PROMPT SELECTION WITH INTENT MODIFICATION
    let system_prompt = '';
    let coachPrompts = null;
    try {
      if (profile?.coach_profile?.system_prompt) {
        coachPrompts = {
          full: profile.coach_profile.system_prompt,
          medium: profile.coach_profile.medium_prompt || profile.coach_profile.system_prompt,
          short: profile.coach_profile.short_prompt || profile.coach_profile.system_prompt
        };
        if (is_init_message) {
          system_prompt = coachPrompts.full + ` Greet ${firstName} warmly by name.`;
        } else {
          const messageCount = chat_history?.length || 0;
          const hasMemory = Boolean(memory_summary && memory_summary.length > 10);
          const isNewTopic = determineIfNewTopic(user_message, chat_history || []);
          system_prompt = promptStrategy.getSystemPrompt(messageCount, hasMemory, isNewTopic, coachPrompts);
        }
      } else {
        // Use default prompts
        if (is_init_message) {
          system_prompt = (promptConfig.system.init || '').replace(/\{\{firstName\}\}/g, firstName || 'user');
        } else {
          system_prompt = promptConfig.system.full;
        }
      }
       // 🎯 INJECT INTENT MODIFIER HERE
       system_prompt = addIntentModifier(system_prompt, userIntent, conversationState);
 

      // 🎯 MODIFY PROMPT BASED ON INTENT (Therapeutic test adaptation)
  //
     // system_prompt += `\nSTYLE GUIDELINES:\n- Every response must be at least 5 sentences unless the user specifically requests brevity.\n- Always respond in at least two paragraphs, with a minimum of 120 words unless brevity is requested.\n- For dilemmas or emotional topics, provide at least one example, analogy, or metaphor to deepen understanding.\n- Reflect on possible underlying causes or patterns.\n- Avoid generic advice, platitudes, or simply restating the user's words.\n- Do not end with a question unless the user requests advice.\n- For dilemmas, break down the situation into perspectives, pros/cons, and possible next steps.\n- Keep tone warm, validating, and grounded.\n- Blend clinical insight with motivational language.\n- Gently challenge distorted thinking 🧭, never force or cheerlead.\n- Keep focus on internal safety 🔐, long-term healing 🛡️, and values-based decisions.\n- Frequently mirror the user's stated values back to them 🪞 to reinforce clarity.\n- Use emojis 🧭🔐🛡️🪞 sparingly to reinforce insights.\n- Only use bullet points or numbered lists when it improves clarity.\n- Offer both emotional validation and cognitive structure in every response.\n`;
    } catch (error) {
      console.error('Error selecting prompt:', error);
      system_prompt = promptConfig.system.full;
    }
    if (!system_prompt) {
      console.warn('No system prompt selected, using default');
      system_prompt = promptConfig.system.full;
    }

    // 3.1. Select style/format based on intent, allowing user profile to override
    const intentMapping = getStyleAndFormatForIntent(userIntent);
    const finalStyle = profile?.communication_style || intentMapping.communication_style;
    const finalFormat = profile?.coaching_format || intentMapping.coaching_format;

    // Apply style/format to system prompt
    system_prompt = promptStrategy.customizePromptForPreferences(
      system_prompt,
      finalStyle,
      finalFormat
    );
    console.log('Applied style/format to system prompt:', { finalStyle, finalFormat });

    // 4. Prompt construction with context
    const prompt = [
      { role: "system", content: system_prompt }
    ];

    // Add memory summary as a system message if it exists and is recent
    if (profile?.last_memory_summary && profile.last_memory_summary.length > 20) {
      prompt.push({
        role: "system",
        content: `Here is a summary of the user's recent context and history:\n${profile.last_memory_summary}`
      });
      // Optionally add recent breakthroughs or emotional state if detected
      if (profile.last_memory_summary.match(/breakthrough|insight|epiphany|clarity|realization/)) {
        prompt.push({
          role: "system",
          content: "Recent breakthroughs detected. Maintain a reflective, supportive tone."
        });
      }
      console.log('Added memory summary to prompt for better context.');
    }

    let context_message = '';
    
    // SIMPLIFIED context for non-init messages
    if (!is_init_message && !is_first_message) {
      // Only add minimal context - no assumptions
      if (firstName && !context_message.includes(firstName)) {
        context_message = `User's name: ${firstName}`;
      }
      
      // DO NOT add memory summary or goals unless user specifically asks
      // Let the conversation be truly user-led
    }
    
    // Add context message to prompt
    if (context_message.trim()) {
      prompt.push({ role: "system", content: context_message.trim() });
    }

    // Enhanced handling for goal and challenge-related queries
    const isGoalQuery = user_message && (
      user_message.toLowerCase().includes('goal') ||
      user_message.toLowerCase().includes('challenge') ||
      user_message.toLowerCase().includes('current challenges') ||
      user_message.toLowerCase().includes('my challenges') ||
      user_message.toLowerCase().includes('what i want') ||
      user_message.toLowerCase().includes('what im working on') ||
      user_message.toLowerCase().includes('my profile') ||
      user_message.toLowerCase().includes('we have talked about') ||
      user_message.toLowerCase().includes('you know my')
    );

    if (isGoalQuery) {
      let profileContext = '';
      
      // Add goals if available
      if (hasGoals && profile.goals.length > 0) {
        const goalDetails = profile.goals.map(g => `${g.label}${g.description ? ' - ' + g.description : ''}`).join('; ');
        profileContext += `User's Current Goals: ${goalDetails}\n`;
      }
      
      // Add challenges if available
      if (profile.challenges && profile.challenges.length > 0) {
        const challengeDetails = profile.challenges.map(c => `${c.label}${c.description ? ' - ' + c.description : ''}`).join('; ');
        profileContext += `User's Current Challenges: ${challengeDetails}\n`;
      }
      
      // Add legacy goals as backup
      if (profile.simple_goals && (!hasGoals || profile.goals.length === 0)) {
        profileContext += `Goals: ${profile.simple_goals}\n`;
      }
      
      if (profileContext) {
        prompt.push({ 
          role: "system", 
          content: `When asked about their profile, goals, or challenges, refer to this information:\n${profileContext}` 
        });
        console.log('Added profile context for user query about goals/challenges');
      }
    }

    // Add chat history - ULTRA-OPTIMIZED: very aggressive limits for maximum token efficiency
    const safe_chat_history = Array.isArray(chat_history) ? chat_history : [];
    let messagesAdded = 0;
    // Reduce chat history for emotional/support queries
    const maxMessages = (userIntent === 'EMOTIONAL_SHARING_WITH_VALIDATION') ? 2 : (is_first_message ? 1 : 6); // Increased from 3 to 6
    
    console.log('Chat history being added to prompt (IMPROVED):', {
      historyLength: safe_chat_history.length,
      maxMessages: maxMessages,
      memoryExists: Boolean(memory_summary),
    });
    
    // 2 & 3. Prioritize substantial & relevant messages, less aggressive truncation
    const substantialMessages = safe_chat_history.filter(isSubstantialMessage);
    const relevantMessages = safe_chat_history.filter(msg => isRelevantToCurrent(msg, user_message));
    const selectedMessages = [
      ...substantialMessages.slice(-maxMessages), // last N substantial
      ...relevantMessages.slice(-2) // up to 2 relevant older messages
    ];

    // Deduplicate and keep order
    let contextMessages = [];
    const seen = new Set();
    for (const msg of selectedMessages) {
      const key = `${msg.role}:${msg.content}`;
      if (!seen.has(key)) {
        contextMessages.push(msg);
        seen.add(key);
      }
    }
    // Fallback if contextMessages is empty
    if (contextMessages.length === 0 && Array.isArray(chat_history)) {
      contextMessages = chat_history.slice(-maxMessages);
    }

    // Now safely summarize
    if (contextMessages && Array.isArray(contextMessages)) {
      const summarizedMessages = contextMessages.slice(-maxMessages).map(msg => ({
        role: msg.role,
        content: `[Summary] ${summarizeMessage(msg)}`
      }));

      summarizedMessages.forEach(msg => {
        console.log(`[SUMMARY TEST] Role: ${msg.role}, Full summarized content: ${msg.content}`);
      });

      for (const msg of summarizedMessages) {
        prompt.push({ role: msg.role, content: msg.content });
        messagesAdded++;
      }
    }

    // 4. Always include memory summary
    if (profile?.last_memory_summary && profile.last_memory_summary.length > 10) {
      prompt.unshift({
        role: "system",
        content: `Here is a summary of the user's recent context and history:\n${profile.last_memory_summary}`
      });
      console.log('Memory summary injected into prompt for continuity.');
    }

    // Add current user message
    if (user_message) {
      prompt.push({ role: "user", content: user_message });
    }
    console.log('Final prompt and model:', {
      modelSelected: model,
      promptLength: prompt.length,
      systemPromptPreview: prompt[0].content.substring(0, 100) + '...',
      coachSpecific: Boolean(profile?.coach_profile?.system_prompt)
    });
    //log the complete system prompt
    console.log('Complete system prompt::::', system_prompt);

    // Add goal debugging
    console.log('Goal debugging:', {
      structuredGoalsCount: profile.goals?.length || 0,
      structuredGoals: profile.goals?.map(g => g.label) || [],
      legacyGoals: profile.simple_goals || 'none',
      memoryHasGoals: (profile.last_memory_summary || '').includes('goal'),
      contextIncludesGoals: context_message.includes('GOALS')
    });

    // Replace this block:
    // const summarizedMessages = contextMessages.slice(-maxMessages).map(msg => ({
    //   role: msg.role,
    //   content: `[Summary] ${summarizeMessage(msg)}`
    // }));

    // with this, inside getPromptAndModel after contextMessages is defined:
    if (contextMessages && Array.isArray(contextMessages)) {
      const summarizedMessages = contextMessages.slice(-maxMessages).map(msg => ({
        role: msg.role,
        content: `[Summary] ${summarizeMessage(msg)}`
      }));

      // Log each summarized message for testing
      summarizedMessages.forEach(msg => {
        console.log(`[SUMMARY TEST] Role: ${msg.role}, Full summarized content: ${msg.content}`);
      });

      // Add summarized messages to prompt instead of full/truncated messages
      for (const msg of summarizedMessages) {
        prompt.push(msg);
        messagesAdded++;
      }
    }

    return { model, prompt }; // The function should now only return model and prompt
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
    console.log('🔥🔥🔥 POST REQUEST HANDLER EXECUTING WITH NEW CODE! 🔥🔥🔥');
    console.log('⭐⭐⭐ VERIFICATION: THIS IS THE UPDATED FILE! ⭐⭐⭐');
    console.log('⭐⭐⭐ TIMESTAMP:', new Date().toISOString(), '⭐⭐⭐');
    try {
      const { email, message, messages, isFirstMessage, isContextRestore } = req.body;
      if (!email || !message) return res.status(400).send('Missing email or message');

      console.log('=== CHAT REQUEST START ===');
      console.log('🚨 TESTING CODE CHANGES ARE BEING PICKED UP 🚨');
      console.log('Email:', email);
      console.log('Message:', message);
      console.log('Is explicit first message:', isFirstMessage === true);
      console.log('Is context restore:', isContextRestore === true);
      console.log('Frontend conversation history length:', messages?.length || 0); // Log the frontend history

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

      let actualMessage = message;
      let is_init_message = false;
      
      if (message === "__INIT_CHAT__") {
        is_init_message = true;
        // SIMPLIFIED: No context loading for initialization
        actualMessage = "Hello! What would you like to talk about today?";
        console.log('Simple initialization - no context loading');
      } else if (message === "__RESTORE_CONTEXT__") {
        console.log('Context restoration requested - processing conversation history');
        // Return success immediately for context restoration
        return res.status(200).json({ 
          response: 'Context restored successfully',
          tokensUsed: 1
        });
      }

      // 🔧 DEBUG: Check actualMessage after processing
      console.log('🔧 DEBUG: actualMessage after processing:', actualMessage);
      console.log('🔧 DEBUG: actualMessage length:', actualMessage?.length);
      console.log('🔧 DEBUG: About to enter profile generation...');

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

      // Use frontend conversation history if provided, otherwise fall back to database
      let chat_history;
      if (messages && Array.isArray(messages) && messages.length > 0) {
        // Use the optimized conversation history from frontend
        chat_history = messages.slice(0, -1); // Remove the current message (last item)
        console.log('Using frontend-provided conversation history:', chat_history.length, 'messages');
        console.log('Frontend history preview:', chat_history.map(m => `${m.role}: ${m.content.substring(0, 50)}...`));
      } else {
        // Fallback to database history (legacy behavior)
        console.log('No frontend history provided, fetching from database...');
        const { data: dbHistory } = await supabase
          .from('chat_messages')
          .select('role, content')
          .eq('user_id', user_id)
          .order('created_at', { ascending: true })
          .limit(4); // REDUCED for token efficiency
        chat_history = dbHistory || [];
        console.log('Using database conversation history:', chat_history.length, 'messages');
      }

      let is_first_message = isFirstMessage || !chat_history || chat_history.length === 0;
      
      console.log('Message type:', {
        is_first_message,
        is_init_message,
        history_length: chat_history?.length || 0,
        history_source: messages?.length > 0 ? 'frontend' : 'database',
        coach_profile: profile.coach_profile?.code
      });

      // Special handling for context restoration
      if (message === "__RESTORE_CONTEXT__" && isContextRestore) {
        console.log('Processing context restoration request...')
        
        // Validate the conversation history format
        if (messages && Array.isArray(messages) && messages.length > 0) {
          console.log(`Context restored with ${messages.length} messages`)
          console.log('Context preview:', messages.map(m => `${m.role}: ${m.content.substring(0, 30)}...`))
          
          // Return acknowledgment without generating a response or using tokens
          return res.status(200).json({
            response: "Context restored successfully",
            tokensUsed: 0,
            contextRestored: true,
            messagesRestored: messages.length,
            message: "Session context has been restored"
          })
        } else {
          console.warn('Invalid or empty conversation history for context restoration')
          return res.status(400).json({
            error: 'Invalid conversation history for context restoration',
            contextRestored: false
          })
        }
      }

      // Get prompt and model with the conversation history (from frontend or database)
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
      
      // 🔧 DEBUG: Before detailed request detection
      console.log('🔧 DEBUG: About to check for detailed request...');
      console.log('🔧 DEBUG: actualMessage for detailed check:', actualMessage?.substring(0, 200));
      
      // Check if this is a detailed request that shouldn't be cached
      const isDetailedRequest = actualMessage && (
        actualMessage.includes('detailed') ||
        actualMessage.includes('comprehensive') ||
        /very\s+very\s+very/i.test(actualMessage) ||
        actualMessage.includes('step by step') ||
        actualMessage.includes('extensive') ||
        actualMessage.includes('thorough') ||
        actualMessage.includes('in-depth') ||
        actualMessage.includes('exhaustive') ||
        actualMessage.includes('diagnose') ||
        actualMessage.includes('explore the cause') ||
        actualMessage.includes('ways to diagnose') ||
        actualMessage.includes('how to find the cause') ||
        actualMessage.includes('process') ||
        actualMessage.includes('methods') ||
        actualMessage.includes('framework') ||
        actualMessage.includes('steps') ||
        actualMessage.includes('approach')
      );
      
      console.log(`🔍 DETAILED REQUEST CHECK: "${actualMessage.substring(0, 100)}..."`);
      console.log(`🔍 DETAILED REQUEST RESULT: ${isDetailedRequest}`);
      if (isDetailedRequest) {
        console.log('🔍 DETAILED REQUEST MATCHED: This request requires comprehensive response');
      }
      
      // Check cache for recent responses (but skip for init messages and detailed requests)
      if (!is_init_message && !isDetailedRequest) {
        const cachedResponse = getCachedResponse(cacheKey);
        if (cachedResponse) {
          console.log('Returning cached response');
          return res.status(200).json(cachedResponse);
        }
      }
      
      if (isDetailedRequest) {
        console.log('🚨 DETAILED REQUEST - Bypassing cache to ensure fresh comprehensive response');
      }

      // Token counting with safety checks (input)
      let inputTokens = 0;
      let encoder;
      
      // Ensure we have valid model and prompt for token counting
      const safeModel = model || 'gpt-4-turbo';
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
      }      // Simplified token check - just use input tokens + reasonable buffer
      const estimatedTotalTokens = inputTokens + 500; // Simple buffer for output
      const tokenCheckThreshold = is_init_message ? 
        Math.min(estimatedTotalTokens, 100) : // Basic check for init messages
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

    // Calculate message count for token optimization
    const messageCount = chat_history?.length || 0;

    // Use the same detailed request detection from above
    // (isDetailedRequest is already defined above before caching check)

    // Call OpenAI with AGGRESSIVELY OPTIMIZED token limits

    let maxTokens;

    // 💡 UNIFIED AND CORRECTED LOGIC
    const isComplexQuery = isDetailedRequest || actualMessage.length > 200 || actualMessage.includes('?');
    console.log(`🔧 TOKEN DEBUG: isDetailedRequest=${isDetailedRequest}, isComplexQuery=${isComplexQuery}, messageCount=${messageCount}, model=${safeModel}`);
    console.log(`🔧 DEBUG: actualMessage length = ${actualMessage.length}, contains '?' = ${actualMessage.includes('?')}`);
    console.log(`🔧 DEBUG: is_init_message = ${is_init_message}`);
    
    if (is_init_message) {
      maxTokens = 200; // Init messages should always be brief
      console.log(`🔧 DEBUG: Set maxTokens = 150 (init message)`);
    } else if (isComplexQuery) {
      maxTokens = actualMessage.length > 120 ? 2000 : 800; // Lower for short queries
      console.log(`🔧 DEBUG: Set maxTokens = ${maxTokens} (complex query, length: ${actualMessage.length})`);
    } else if (safeModel.includes('gpt-4')) {
      maxTokens = messageCount <= 2 ? 800 : messageCount <= 6 ? 800 : 800;
    } else {
      maxTokens = messageCount <= 2 ? 800 : messageCount <= 6 ? 800 : 800;
    }
    
       
    console.log('🚨🚨🚨 NEW LOGIC EXECUTING! 🚨🚨🚨🚨🚨🚨');
    console.log('🟢🟢🟢 CACHE CLEARED AND FIXED TOKEN LOGIC! 🟢🟢🟢');
    console.log(`🎯 FINAL DEBUG: Using max_tokens: ${maxTokens} (isComplexQuery: ${isComplexQuery}, messageCount: ${messageCount}, model: ${safeModel})`);
    
    const completion = await openai.chat.completions.create({
      model: safeModel,
      messages: safePrompt,
      max_tokens: maxTokens,
      temperature: 0.9, // Increased for more creative, therapy-like responses
      presence_penalty: 0.4,
    });
    const aiResponse = completion.choices[0]?.message?.content || '';

    // Analyze AI response to track actions
    const detectAIAction = (response) => {
      if (/\?.*\?|\bwhat\b.*\?|\bhow\b.*\?|\bwhen\b.*\?|\bwhere\b.*\?/.test(response)) {
        return 'ASKED_QUESTION';
      } else if (/\b(try|suggest|recommend|consider|here are|steps?|approach)\b/i.test(response)) {
        return 'GAVE_ADVICE';
      } else if (/\b(understand|hear|sounds?\s+(hard|difficult)|that must be)\b/i.test(response)) {
        return 'VALIDATED_EMOTION';
      }
      return 'GENERAL_RESPONSE';
    };

    // Track the AI's action
    const aiAction = detectAIAction(aiResponse);
    try {
      const { trackAIAction } = require('../../lib/conversationState');
      trackAIAction(user_id, aiAction, aiResponse);
    } catch (err) {
      console.error('Error tracking AI action:', err);
    }
    
    // Token counting (actual)
    const outputTokens = encoder ? encoder.encode(aiResponse).length : Math.ceil(aiResponse.length / 4);
    const totalTokensUsed = inputTokens + outputTokens;
    if (encoder) encoder.free();

    // Deduct tokens
    const newTokenBalance = Math.max(0, user.tokens - totalTokensUsed);
    await supabase.from('users').update({ tokens: newTokenBalance }).eq('id', user.id);    // Store chat messages with metadata
    await storeChatMessage(user_id, 'user', message, safeModel, inputTokens);
    await storeChatMessage(user_id, 'assistant', aiResponse, safeModel, outputTokens);
    
    // Check if response needs to be chunked (for responses longer than 1500 characters)
    console.log(`📦 CHUNKING DEBUG: Starting chunking analysis for response of ${aiResponse.length} characters`);
    console.log(`📦 CHUNKING DEBUG: Response preview: "${aiResponse.substring(0, 100)}..."`);
    console.log(`📦 CHUNKING DEBUG: Response should be chunked if > 1500 chars: ${aiResponse.length > 1500}`);

    const chunks = chunkResponse(aiResponse, 1500);  // Changed from 800 to 1500
    const isChunked = chunks.length > 1;
    
    console.log(`📦 CHUNKING DEBUG: chunkResponse returned ${chunks.length} chunks`);
    console.log(`📦 CHUNKING DEBUG: isChunked = ${isChunked}`);
    console.log(`📦 CHUNKING DEBUG: First chunk length: ${chunks[0]?.length || 'undefined'}`);
    if (chunks.length > 1) {
      console.log(`📦 CHUNKING DEBUG: Second chunk length: ${chunks[1]?.length}`);
    }
    
    if (isChunked) {
      console.log(`📦 CHUNKING: Response (${aiResponse.length} chars) split into ${chunks.length} chunks`);
      console.log(`📦 Chunk sizes: ${chunks.map(c => c.length).join(', ')}`);
    }
    
    let responseObj;
    
    if (isChunked) {
      // Generate conversation ID for chunked response
      const conversationId = generateConversationId();
      
      console.log(`📦 CHUNKING DEBUG: About to store chunks - user_id: ${user_id}, conversationId: ${conversationId}`);
      
      // Store chunks in database
      const chunkStored = await storeChunkedResponse(user_id, chunks, conversationId);
      
      console.log(`📦 CHUNKING DEBUG: Chunk storage result: ${chunkStored}`);
      
      if (chunkStored) {
        // Return first chunk with chunking metadata
        responseObj = {
          response: chunks[0],
          tokensUsed: totalTokensUsed,
          remainingTokens: newTokenBalance,
          tokenBreakdown: {
            input: inputTokens,
            output: outputTokens,
            total: totalTokensUsed
          },
          isPartial: true,
          totalChunks: chunks.length,
          currentChunk: 1,
          conversationId: conversationId,
          nextChunkToken: `chunk_${conversationId}_2`,
          previewNext: chunks.length > 1 ? getPreviewText(chunks[1]) : null
        };
        
        console.log(`📦 RESPONSE DEBUG: Response chunked into ${chunks.length} parts, returning first chunk`);
        console.log(`📦 RESPONSE DEBUG: Response object:`, {
          ...responseObj,
          response: responseObj.response.substring(0, 100) + '...'
        });
      } else {
        // Fallback to full response if chunk storage failed
        console.warn('Chunk storage failed, returning full response');
        responseObj = {
          response: aiResponse,
          tokensUsed: totalTokensUsed,
          remainingTokens: newTokenBalance,
          tokenBreakdown: {
            input: inputTokens,
            output: outputTokens,
            total: totalTokensUsed
          }
        };
      }
    } else {
      // Standard response for short messages
      responseObj = {
        response: aiResponse,
        tokensUsed: totalTokensUsed,
        remainingTokens: newTokenBalance,
        tokenBreakdown: {
          input: inputTokens,
          output: outputTokens,
          total: totalTokensUsed
        }
      };
    }
    
    // Cache the response (only cache non-chunked responses to avoid complexity)
    if (!isChunked) {
      setCachedResponse(cacheKey, responseObj);
    }

    // Create a final copy of responseObj to protect it from any modifications during memory processing
    const finalResponseObj = { ...responseObj };
    
    // Return the response immediately to avoid any interference from memory processing
    console.log(`🚀 FINAL RESPONSE DEBUG: About to return response with keys: [${Object.keys(finalResponseObj).join(', ')}]`);
    if (isChunked) {
      console.log(`🚀 FINAL RESPONSE DEBUG: Chunked response with isPartial=${finalResponseObj.isPartial}, totalChunks=${finalResponseObj.totalChunks}`);
    }
    
    // IMPORTANT: Return response immediately before memory processing
    // Memory processing will continue in background (if Node.js allows it)
    res.status(200).json(finalResponseObj);
    
    // Enhanced summarization logic with multiple trigger conditions (runs after response is sent)
    const totalMessages = chat_history.length + 2; // +2 for current user message and AI response
    
    // Helper: Detect breakthrough keywords (already in your code)
    const hasBreakthroughKeywords = (msg) => {
      if (!msg) return false;
      return /breakthrough|major insight|epiphany|realization|finally understand|big change|major progress|new perspective|shifted my thinking|life-changing/i.test(msg);
    };

    // Topic shift detection (already in your code)
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
    // --- 6. Time-based Trigger: 24+ hours since last memory update ---
    let timeTrigger = false;
    if (profile.updated_at) {
      const lastUpdate = new Date(profile.updated_at);
      const hoursSinceUpdate = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60);
      timeTrigger = hoursSinceUpdate > 24;
      if (timeTrigger) {
        console.log(`Time-based trigger: Last memory update was ${hoursSinceUpdate.toFixed(1)} hours ago.`);
      }
    }
    
    // --- 5. Breakthrough & Topic Shift Detection: Force memory update ---
    const breakthroughTrigger = hasBreakthroughKeywords(message);
    if (breakthroughTrigger) {
      console.log('Breakthrough moment detected in user message');
    }

    // Calculate recent substantial message count (last 10 messages)
    // Use chat_history instead of safe_chat_history (same array in this scope)
    const recentSubstantialCount = (chat_history || [])
      .slice(-10)
      .filter(isSubstantialMessage)
      .length;
    

    const shouldUpdateMemory =
      totalMessages % 4 === 0 ||
      !profile.last_memory_summary ||
      recentSubstantialCount % 3 === 0 ||
      timeTrigger ||
      breakthroughTrigger ||
      topicShiftTrigger;

    if (shouldUpdateMemory) {
      const triggerReason = breakthroughTrigger
        ? 'breakthrough_detected'
        : topicShiftTrigger
        ? 'topic_shift_detected'
        : !profile.last_memory_summary
        ? 'no_existing_memory'
        : totalMessages % 4 === 0
        ? 'periodic_4_messages'
        : recentSubstantialCount % 3 === 0
        ? 'quality_3_substantial'
        : timeTrigger
        ? 'time_24_hours'
        : 'unknown';

      console.log(`Triggering memory summarization: ${triggerReason}`);
                     try {
        // Force comprehensive update for breakthroughs/topic shifts
        const summary = await updateMemorySummary(user_id, breakthroughTrigger || topicShiftTrigger);
        if (summary) {
          console.log('Memory summarization completed successfully, summary length:', summary.length);
          // Reference summary in next prompt (already handled by always including memory summary in prompt)
        }
      } catch (err) {
        console.error('Memory summarization failed:', err);
      }
    }
    
    // Response already sent above, this is just for cleanup if the function continues
    // return res.status(200).json(responseObj);
  }
  // Add a catch block to close the previous try statement
  catch (error) {
    console.error('Error in POST request handler:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
 } // This closes the "if (req.method === 'POST')" block
}

// Helper: Check if message contains substantial content
function isSubstantialMessage(msg) {
  return msg.content && msg.content.length > 20 &&
    !/^(yes|no|ok|okay|hmm|thanks|sure|right|exactly|absolutely)$/i.test(msg.content.trim());
}

// 🎯 ENHANCED INTENT MODIFIER FUNCTION FOR THERAPEUTIC DEPTH + TOKEN EFFICIENCY
function addIntentModifier(basePrompt, intent, conversationState = null) {
  // Intent hierarchy - some override others
  const hierarchicalIntents = {
    'FRUSTRATED': 10,               // Highest priority
    'META_CONVERSATION': 9,
    'MEDICAL_URGENCY': 8,
    'REPEAT_ADVICE_REQUEST': 7,
    'ADVICE_REQUEST': 6,
    'FOLLOW_UP_ADVICE': 5,
    'EMOTIONAL_SHARING': 4,
    'ADVICE_FOCUSED': 3,
    'GENERAL_CONVERSATION': 1
  };
  
  // Step 1: Rapid overrides (medical/frustration/repeat, etc.) - keep as-is
  const detectMedicalUrgency = (message) => {
    const urgentKeywords = [
      'chest pain', "can't breathe", 'breathing problems', 'heart attack', 'stroke', 'suicidal thoughts',
      'severe pain', "can't stop bleeding", 'losing consciousness'
    ];
    return urgentKeywords.some(keyword =>
      message?.toLowerCase().includes(keyword)
    );
  };
  if (intent === 'MEDICAL_URGENCY' || (conversationState?.lastUserMessage && detectMedicalUrgency(conversationState.lastUserMessage))) {
    return basePrompt + '\n\nMEDICAL PRIORITY: Detect and respond to medical urgency. If symptoms are serious, recommend professional help immediately. ("That sounds serious. Please [call doctor/ER/crisis line]. While you\'re getting help, I\'m here emotionally for you.")';
  }
  if (conversationState?.userFrustrationSignals >= 2 || intent === 'FRUSTRATED') {
    return basePrompt + '\n\nCRITICAL OVERRIDE: User is frustrated. Say "I\'m sorry for repeating myself. Here are some things you can try right now..." Provide 2-3 actions. NO questions.'; 
  }
  if (intent === 'REPEAT_ADVICE_REQUEST' || conversationState?.repeatRequestCount >= 2) {
    return basePrompt + '\n\nREPEAT REQUEST: User has asked for advice again. Give 2-3 concrete suggestions. Say: "Of course. Here are a few approaches that can help..." No exploration needed.'; 
  }
  if (conversationState?.consecutiveQuestions >= 3) {
    return basePrompt + '\n\nQUESTION FATIGUE: User asked multiple questions. Give concrete guidance. Reference what they\'ve already shared.'; 
  }
  // (other special-case modifiers unchanged...)

  // Step 2: Define tiered formats (efficient for tokens)
  const formats = {
    long: `
Respond in 3 paragraphs:
1. Reflect the user's emotional experience with warmth and clarity.
2. Name the pattern, validate the dilemma, and provide an interpretive frame.
3. Offer 2–3 thoughtful next steps, reframes, or choices that align with their values and healing.
End with a gentle, focused follow-up question that keeps the conversation emotionally safe and forward-moving.`,
    medium: `
Respond in 2 paragraphs:
1. Reflect the user's emotion and summarize the situation.
2. Offer one gentle insight, one actionable next step, and end with a brief, supportive question.`,
    short: `
Respond in 1 short paragraph: Validate user's feeling, offer a single insight or next step, and end with a supportive question.`
  };

  // Step 3: Decide format based on turn count for cost efficiency
  const turn = conversationState?.turnCount || 1;
  let responseFormat;
  if (turn <= 2) {
    responseFormat = formats.long;
  } else if (turn <= 7) {
    responseFormat = formats.medium;
  } else {
    responseFormat = formats.short;
  }

  // Step 4: Attach to base prompt (only for emotional/advice/general intents)
  // (Feel free to expand this as needed for more granular intent mapping.)
  const deepIntents = [
    'EMOTIONAL_SHARING', 'SIMPLE_EMOTIONAL_SHARING', 'EMOTIONAL_SHARING_WITH_VALIDATION',
    'ADVICE_REQUEST', 'FOLLOW_UP_ADVICE', 'ADVICE_FOCUSED', 'GENERAL_CONVERSATION'
  ];
     
  /*  if (intent === 'DIAGNOSTIC_REQUEST'){
     return basePrompt + '\n' +  '\n\nDIAGNOSTIC RESPONSE: User wants step-by-step guidance to diagnose the issue. Provide a clear process with 3-5 steps, explain each briefly, and invite the user to try them. Example: "Here are some ways to explore the cause: 1. Self-reflection, 2. Journaling, 3. Talking to a trusted friend, 4. Professional assessment, 5. Tracking patterns." End with: "Would you like to start with one of these or discuss more options?"';

     } else if (intent === 'FOLLOW_UP_ADVICE_REQUEST'){
     return basePrompt  + '\n\nFOLLOW_UP_ADVICE: User wants additional/different techniques for same issue. Say: "In addition to what we\'ve discussed, here are some other strategies you might try:" and provide NEW techniques that are different from previous suggestions. Be concrete and actionable.';

      } else if (intent === 'SIMPLE_EMOTIONAL_SHARING'){
     return basePrompt  +  '\n\nSIMPLE EMOTIONAL VALIDATION: User shared basic emotional state ("feeling down lately") without asking for advice. Start with validation: "That sounds really tough." Then ask ONE exploratory question: "What\'s been making you feel this way?" Do NOT offer advice, coping strategies, or choices unless requested. Focus purely on exploration and understanding.';
    
      }else if (intent === 'CONTEXT_SHARING'){
    return basePrompt  +  '\n\nCONTEXT SHARING RESPONSE: User provided specific context about their situation (sleep troubles, work stress). Acknowledge what they shared, then offer explicit choice: "Would you like to explore what\'s happening with your sleep and work stress more, or are you looking for some practical advice and strategies to help manage these issues?" Must clearly mention BOTH exploration AND advice/strategies as options.';
    
      } else if (intent === 'EMOTIONAL_SHARING_WITH_VALIDATION'){
       return basePrompt  +  '\n\nSTRONG VALIDATION REQUIRED: User shared serious emotional state like hopelessness. CRITICAL: Start with strong emotional validation first: "I\'m really sorry you\'re experiencing that. Feeling hopeless can be incredibly difficult and overwhelming." THEN offer choice: "Would you like to talk more about what\'s contributing to these feelings, or are you looking for some coping strategies to help when this happens?" Validation must come BEFORE choices.';
   
      }else if (intent === 'EXPLORATION_PREFERENCE')
     return basePrompt  + '\n\nEXPLORATION PREFERRED: User explicitly stated they want to vent/talk rather than get advice. Show strong respect for their preference. Say: "Of course, I\'m here to listen. Feel free to share what\'s on your mind, and we can take it at whatever pace feels right for you." Focus on listening and understanding, NOT advice.';
    
    else if (intent === 'FRUSTRATED')
    return basePrompt  + '\n\nFRUSTRATION RESPONSE: User is frustrated. You MUST apologize ("I\'m sorry for repeating myself"). Offer to reset the conversation. Then provide immediate, concrete advice. NO questions.';
    
    else if (intent === 'META_CONVERSATION')
    return basePrompt  +  '\n\nIMPORTANT: User wants to change how the conversation works. Address their concern about the conversation style directly. Examples: bullet points, shorter responses, different approach. Say "Absolutely!" and adapt immediately.';
    
    else if (intent === 'MEDICAL_URGENCY')
    return basePrompt  +  '\n\nMEDICAL PROTOCOL: For serious symptoms, immediately recommend professional help. Then offer emotional support. Format: "That sounds serious - chest pain needs immediate attention. Please call your doctor right away or go to the emergency room. While you\'re getting medical help, I want you to know I\'m here to support you emotionally through this."';
    
    else if (intent === 'BOUNDARY_RESPECT')
    return basePrompt  + '\n\nBOUNDARY RESPECT: User set a boundary about a topic. Immediately respect it. Say: "Of course, I understand. We can focus on whatever feels most comfortable for you. Is there another area you\'d like to work on?" Never push the topic they declined.';
    
    else if (intent === 'ADVICE_REJECTION')
    return basePrompt  + '\n\nADVICE REJECTED: User said previous advice doesn\'t work. CRITICAL: Be positive and supportive. Say: "I really appreciate you letting me know that approach isn\'t working for you - that\'s valuable feedback. Let me suggest some completely different strategies..." Then offer different approaches. Never ask why it didn\'t work or push the same advice.';    
   
    else if (intent === 'FALLBACK_REQUEST')
    return basePrompt  + '\n\nFALLBACK NEEDED: User says nothing is helping and needs different approach. Say: "Let me suggest some completely different strategies that might help with your [specific issue]:" then list fundamentally different techniques. Focus on alternative methods they haven\'t tried.';
    
    else if (intent === 'CHOICE_REQUEST')
    return basePrompt  +'\n\nCHOICE OFFERING: User wants options to choose from. Provide clear alternatives with explicit choice language. Format: "You have a few different options here: Option 1: [specific approach for sleep] Option 2: [different approach for stress] Option 3: [combined approach]. Which of these sounds most helpful to you right now, or would you like me to explain any of these in more detail?"';
    
    else if (intent === 'DIRECT_ADVICE_REQUEST')
    return basePrompt  +'\n\nDIRECT ADVICE: User explicitly wants immediate concrete advice for specific conditions. Address their exact issues mentioned. Format: "For anxiety and depression, here are some strategies that can help: 1. [specific technique for anxiety] 2. [specific technique for depression] 3. [technique for both]. Would you like to start with one of these, or would you prefer to talk more about what you\'re experiencing first?"';
    
    else if (intent ===  'REPEAT_ADVICE_REQUEST')
     return basePrompt  + '\n\nREPEAT REQUEST: User asking for advice again or saying current advice isn\'t working. Provide immediate concrete NEW suggestions. Say: "Let me suggest some different approaches..." Don\'t repeat previous advice. ADVICE REQUEST: User explicitly wants advice. First acknowledge their specific conditions/issues mentioned. Then provide 2-3 specific, actionable suggestions addressing those exact issues. End with: "Would you like to focus on one of these approaches, or would you prefer to talk more about what you\'re experiencing?"';
    
    else if (intent ===  'FOLLOW_UP_ADVICE')
    return basePrompt  + '\n\nFOLLOW-UP ADVICE: User wants additional advice for same issue. Say "Here are some additional strategies for [specific issue]..." and provide NEW techniques. Don\'t repeat previous suggestions. Be concrete and actionable.';
    

    else if (intent ===  'EMOTIONAL_SHARING' && conversationState?.dominantIntent === 'EMOTIONAL_FOCUSED')
        return basePrompt  +'\n\nEMOTIONAL SUPPORT MODE: User explicitly wants emotional support. Validate their feelings first: "That sounds really hard." Then ask how you can best support them: "Would you like to talk more about what\'s going on, or are you looking for some strategies to help you cope?"';
    
    else if (intent ===  'EMOTIONAL_SHARING')
    return basePrompt  + '\n\nEMOTION VALIDATION: User sharing emotions like hopelessness. Validate feelings first: "That sounds really difficult to experience." Then offer BOTH options: "Would you like to talk more about what\'s been making you feel this way, or are you looking for some coping strategies to help when these feelings come up? I can help with either approach."';
    
    else if (intent ===  'ADVICE_FOCUSED')
    return basePrompt  +  '\n\nSOLUTION MODE: User is solution-oriented. Provide practical guidance. Only ask questions if essential for better advice.';
    
     else if (intent ===  'GENERAL_CONVERSATION')
    return basePrompt  +  '\n\nIMPORTANT: Maintain therapeutic depth. Balance listening with solutions. For emotional content, ask 2–3 gentle, open-ended questions before offering choices. Never rush to advice. Reference user’s emotional state and history if available.';
  };*/
  if (deepIntents.includes(intent)) {
    return basePrompt + '\n' + responseFormat;
  }

  // Default fallback
  return basePrompt;
}

// Export as default for Next.js API route
export default withErrorHandling(gptRouterHandler);
// filepath: c:\opt\mvp\web\pages\api\gptRouter.js

// Helper: Simple relevance scoring (can be replaced with semantic similarity)
function isRelevantToCurrent(msg, currentMessage) {
  if (!msg.content || !currentMessage) return false;
  const keywords = currentMessage
    .toLowerCase()
    .split(/\W+/)
    .filter(w => w.length > 4);
  return keywords.some(word => msg.content.toLowerCase().includes(word));
}
// filepath: c:\opt\mvp\web\pages\api\gptRouter.js

// Helper: Summarize a single message with improved context extraction
function summarizeMessage(msg) {
  if (!msg || !msg.content) return '';
  // If message is short, return as-is
  if (msg.content.length < 120) return msg.content.trim();

  // Extract main emotion, topic, and any actions/decisions
  let summary = '';
  // Try to extract emotion
  const emotionMatch = msg.content.match(/(sad|happy|angry|frustrated|lost|motivated|anxious|hopeless|overwhelmed|confused|excited|calm|worried|stressed|tired|energized|supported|lonely|connected)/i);
  if (emotionMatch) summary += `Emotion: ${emotionMatch[0]}. `;

  // Try to extract topic
  const topicMatch = msg.content.match(/(motivation|anxiety|work|relationship|goal|challenge|problem|solution|habit|routine|energy|focus|confidence|fear|worry|sadness|anger|frustration|hope|change|progress|improvement|plan|strategy|job|family|health)/i);
  if (topicMatch) summary += `Topic: ${topicMatch[0]}. `;

  // Try to extract action/decision
  const actionMatch = msg.content.match(/(tried|started|decided|changed|avoided|talked|shared|asked|expressed|focused|coping|journaled|vented|set boundaries|took a break|reached out|planned|scheduled|committed|reflected|meditated|practiced|wrote|read|listened|watched|called|messaged|emailed|visited|joined|left|quit|resumed|completed|achieved|failed|attempted|considered|explored|researched|learned|applied|adapted|adjusted|reported|noticed|felt|experienced|observed|identified|recognized|adopted|discarded|maintained|improved|progressed|regressed|relapsed|overcame|struggled|persisted|persevered|gave up|kept going|followed|ignored|accepted|rejected|embraced|let go|held on|supported|helped|encouraged|motivated|inspired|comforted|soothed|calmed|relaxed|energized|activated|deactivated)/i);
  if (actionMatch) summary += `Action: ${actionMatch[0]}. `;

  // Always include the first sentence for context
  const firstSentence = msg.content.split(/[.!?]/)[0].trim();
  summary += `Summary: ${firstSentence}${firstSentence.length < msg.content.length ? '...' : ''}`;

  // Limit summary to ~200 characters for efficiency
  return summary.length > 200 ? summary.substring(0, 197) + '...' : summary;
}