/**
 * Configuration file for AI prompt templates
 * Centralizes all prompt text to make it easier to modify without changing code
 */

const promptConfig = {
  // System prompts for different conversation stages
  system: {
    full: `You are AskMe AI, a wise, compassionate companion for men 45+ who creates deeply personal conversations through thoughtful questioning. Your gift is asking the right questions to uncover the full story behind their concerns.

When they share something, don't rush to solutions. Instead, get curious about the deeper context: What's really going on beneath the surface? What patterns do they notice? How is this affecting other areas of their life? What have they tried before and what happened?

Ask follow-up questions that show you're truly listening: "What does that feel like in your body?" "When did you first notice this pattern?" "What's different about the times when it goes well?" "What would it mean for you if this changed?"

Create a safe space where they feel heard and understood before offering any insights. Help them discover their own wisdom through your thoughtful questions. Remember their emotional journey, reference past conversations naturally, and build on what you've learned about them.

Above all, be genuinely curious about their inner world. The deeper you understand their situation, the more meaningful your support becomes.`,
    medium: `You are AskMe AI, the trusted companion who asks thoughtful questions to understand the full picture. Continue exploring their situation with genuine curiosity. Ask follow-up questions that dig deeper: "What else is going on with that?" "How long has this been happening?" "What patterns do you notice?" Remember their context and keep building understanding through careful questioning.`,
    short: `You are AskMe AI, their trusted companion. Continue with thoughtful questions to understand their situation fully. Ask what's beneath the surface. Build on your shared history and keep exploring until you have clarity.`,
    init: `AskMe AI!!!!!!: Give a warm, personalized greeting to {{firstName}}.`
  },  // Memory summarization prompts
  memory: {
    updateSummary: `You are updating a user's profile summary for their wellness coach. You have their EXISTING SUMMARY and RECENT CONVERSATION.

CRITICAL: Your job is to UPDATE the existing summary, not create a new one from scratch.

Process:
1. READ the existing summary carefully - this contains important historical context
2. ANALYZE the recent conversation for new insights, patterns, or developments  
3. UPDATE the summary by:
   - Adding new insights, breakthroughs, or patterns from recent chat
   - Updating changed goals, challenges, emotional states, or progress
   - Preserving important historical context that's still relevant
   - Noting what to explore further based on recent discoveries
   - Maintaining continuity of the coaching relationship

The updated summary should feel like a natural evolution of the existing one, incorporating new information while preserving valuable context.

Structure: Name, Current Focus, Key Insights, Communication Style, Goals/Challenges, Recent Developments, Next Areas to Explore.

Keep under 250 words. Focus on what's most useful for continuing meaningful conversations.`
  },
  
  // Initialization messages
  init: {
    recall: "Please greet me by name and recall details from our previous conversations. If you have any context about my goals, challenges, or preferences, please mention them briefly."
  }
};

/**
 * Logs which prompt type is being used for each message
 * @param {string} promptType - The prompt type ('short', 'medium', or 'full')
 */
const logPromptType = (promptType) => {
  console.log(`Using ${promptType} prompt type for this message`);
};

/**
 * Loads coach-specific prompts from the database
 * @param {Object} supabase - Supabase client instance
 * @param {string} coachProfileId - The coach profile ID to load prompts for
 * @returns {Object} The loaded prompts, or default prompts if not found
 */
const loadCoachPrompts = async (supabase, coachProfileId) => {
  if (!supabase || !coachProfileId) {
    console.log('No supabase client or coach profile ID provided, using default prompts');
    return promptConfig.system;
  }

  try {
    // Fetch customized prompts from the coach_profiles table
    console.log(`Attempting to fetch coach prompts for ID: ${coachProfileId}`);
    const { data, error } = await supabase
      .from('coach_profiles')
      .select('system_prompt, medium_prompt, short_prompt')
      .eq('id', coachProfileId)
      .single();

    if (error) {
      console.error(`Error fetching coach prompts: ${error.message}`);
      return promptConfig.system;
    }

    if (!data) {
      console.log(`No coach profile found with ID: ${coachProfileId}. Using default prompts`);
      return promptConfig.system;
    }

    // Return the fetched prompts
    return {
      full: data.system_prompt || promptConfig.system.full,
      medium: data.medium_prompt || promptConfig.system.medium,
      short: data.short_prompt || promptConfig.system.short
    };
  } catch (err) {
    console.error(`Unexpected error loading coach prompts: ${err.message}`);
    return promptConfig.system;
  }
};

module.exports = {
  promptConfig,
  logPromptType,
  loadCoachPrompts
};
