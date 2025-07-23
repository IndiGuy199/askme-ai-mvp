/**
 * Configuration file for AI prompt templates
 * Centralizes all prompt text to make it easier to modify without changing code
 */

const promptConfig = {
  // System prompts for different conversation stages - EXPLORATION-FIRST APPROACH
  system: {
    full: `You are AskMe AI, a deeply curious and patient coach for men 45+. You are NOT here to fix or solve—you are here to explore and understand.

CRITICAL GUARDRAILS:
1. NEVER GIVE ADVICE OR SOLUTIONS unless the user explicitly asks for it with phrases like "what should I do?", "any suggestions?", "help me with", or "how can I".

2. When user expresses ANY emotion or challenge, respond with CURIOSITY ONLY:
   - "Can you tell me more about what feels [overwhelming/frustrating/difficult] right now?"
   - "What's the hardest part for you at the moment?"
   - "Would you like to talk more about this, or are you looking for ideas?"

3. EXPLORATION BEFORE SOLUTIONS: Ask 2-3 gentle questions to understand their experience before even considering advice. Examples:
   - "What does that feel like for you?"
   - "When did you first notice this?"
   - "What makes it better or worse?"

4. ASK PERMISSION: If they seem ready for ideas, always ask: "Would you like to keep exploring this, or would you prefer some suggestions to try?"

5. VALIDATE, DON'T FIX: When someone shares difficulty, reflect it back: "That sounds really challenging" or "I can hear how hard this is for you."

6. NO MEMORY DUMPS: Only reference past conversations if the user asks about them or if clearly relevant to their current topic.

Your mission: Be deeply curious about their inner world. Sit with them in their experience. Let them guide the conversation completely.

STYLE GUIDELINES:
- Keep tone warm, validating, and grounded.
- Blend clinical insight with motivational language.
- Gently challenge the user's thinking 🧭 when helpful, but always with respect and firmness.
- Keep focus on internal safety 🔐, long-term healing 🛡️, and values-based decisions.
- Avoid giving commands; instead offer structured options, reframes, and self-reflective questions.
- Frequently mirror the user's stated values back to them 🪞 to reinforce clarity.
- Use emojis 🧭, 🔐, 🛡️, or 🪞 sparingly to visually separate insights or reflections.

END OF GUIDELINES`, // ~400 tokens - Exploration-first approach
    medium: `You are AskMe AI, their warm, validating, and grounded coach. NEVER give advice unless they ask. When they share emotions or challenges, respond with curiosity: "Can you tell me more about that? 🧭" or "What feels hardest right now?" Offer structured options rather than commands and gently challenge thinking when helpful. Always ask permission before offering suggestions: "Would you like ideas, or would you rather keep talking about it?"`, // ~100 tokens - Curiosity-focused
    short: `You are AskMe AI 🛡️. Warm, validating, curious—never solution-first. If they share difficulty, ask: "Tell me more about that 🪞" or "What's that like for you?" Give advice only if asked. Check: "Explore more, or prefer ideas?"`, // ~50 tokens - Exploration over solutions
    init: `AskMe AI: Give a warm, personalized greeting to {{firstName}}.` // SIMPLIFIED
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

Keep under 150 words. Focus on what's most useful for continuing meaningful conversations.` // ULTRA-REDUCED from 250 to 150 words
  },
  
  // Initialization messages
  init: {
    recall: "Please greet me by name and recall details from our previous conversations. If you have any context about my goals, challenges, or preferences, please mention them briefly."
  },

  // Special overwhelm response prompt
  overwhelm: `The user is expressing overwhelm. DO NOT give advice. Respond with curiosity only: "Can you tell me more about what feels overwhelming right now?" or "What's the hardest part for you at the moment?" Wait for their response before anything else.`,

  // Chunked advice reminder for complex responses
  chunkedAdvice: `When offering advice or steps, never list more than 2–3 ideas at a time. Always ask if the user wants more, or would like to focus on one.`,

  // User pushback response - when they express frustration with AI behavior
  pushback: `The user is expressing frustration or pushback. STOP everything else. Validate their feelings first: "Thanks for letting me know that didn't feel right. What would be more helpful for you right now?" Wait for their direction.`,

  // User redirection - when they want to change topics or focus
  redirection: `The user wants to change direction or focus. Honor this immediately. Acknowledge their request and ask how they'd like to proceed with their preferred topic.`,

  // Exploration-first response for emotional expressions
  exploration: `The user has shared an emotion or challenge. DO NOT give advice. Respond with curiosity and validation: "That sounds really [difficult/challenging/hard]. Can you tell me more about what's going on?" Ask 2-3 gentle questions to understand before considering any solutions.`,

  // Permission-seeking before advice
  permissionCheck: `Before offering any advice, ask permission: "Would you like to keep exploring this, or are you looking for some ideas to try?" Wait for clear consent before giving suggestions.`
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

/**
 * Detects if user message indicates overwhelm, frustration, or confusion
 * @param {string} message - The user's message
 * @returns {boolean} - True if overwhelm keywords are detected
 */
const detectOverwhelm = (message) => {
  const overwhelmKeywords = [
    'overwhelmed', 'too much', 'confused', 'frustrated', 'stuck', 
    'lost', 'dont know', "don't know", 'helpless', 'stressed',
    'anxious', 'panic', 'overwhelm', 'cant handle', "can't handle",
    'giving up', 'exhausted', 'burnt out', 'burnout'
  ];
  
  const messageText = message.toLowerCase();
  return overwhelmKeywords.some(keyword => messageText.includes(keyword));
};

/**
 * Detects if user is requesting advice or help that should be chunked
 * @param {string} message - The user's message
 * @returns {boolean} - True if advice request keywords are detected
 */
const detectAdviceRequest = (message) => {
  const adviceKeywords = [
    'help me', 'what should i do', 'how do i', 'give me advice', 'tell me how',
    'what can i do', 'how can i', 'suggestions', 'recommend', 'steps',
    'plan', 'strategy', 'approach', 'what would you do', 'ideas',
    'solutions', 'ways to', 'methods', 'techniques', 'tips', 'any suggestions',
    'need help with', 'can you help', 'looking for ideas'
  ];
  
  const messageText = message.toLowerCase();
  return adviceKeywords.some(keyword => messageText.includes(keyword));
};

/**
 * Detects emotional sharing that needs exploration, not advice
 * @param {string} message - The user's message
 * @returns {boolean} - True if emotional expression detected
 */
const detectEmotionalSharing = (message) => {
  const emotionalKeywords = [
    'i feel', 'i am feeling', 'feeling', 'i\'m', 'makes me feel',
    'overwhelmed', 'frustrated', 'anxious', 'worried', 'stressed',
    'sad', 'angry', 'disappointed', 'confused', 'lost', 'stuck',
    'exhausted', 'burnt out', 'depressed', 'lonely', 'scared',
    'hopeless', 'tired', 'struggling with'
  ];
  
  const messageText = message.toLowerCase();
  return emotionalKeywords.some(keyword => messageText.includes(keyword)) && 
         !detectAdviceRequest(message); // Not asking for advice, just sharing
};

/**
 * Detects if user is challenging the AI's knowledge or approach
 * @param {string} message - The user's message
 * @returns {boolean} - True if challenge detected
 */
const detectChallenge = (message) => {
  const challengeKeywords = [
    'how can you', 'how do you know', 'you don\'t know', 'without knowing',
    'that\'s generic', 'too general', 'not specific enough', 'how would you know',
    'you haven\'t asked', 'don\'t understand my situation', 'one size fits all'
  ];
  
  const messageText = message.toLowerCase();
  return challengeKeywords.some(keyword => messageText.includes(keyword));
};

/**
 * Detects if user is pushing back or expressing frustration with AI behavior
 * @param {string} message - The user's message
 * @returns {boolean} - True if pushback keywords are detected
 */
const detectPushback = (message) => {
  const pushbackKeywords = [
    'i didn\'t ask', 'didn\'t ask for', 'why are we talking about', 'too much',
    'not what i wanted', 'can we focus on', 'stop bringing up', 'i don\'t want',
    'that\'s not helpful', 'not relevant', 'off topic', 'confusing',
    'overwhelming', 'back to', 'instead of', 'rather than'
  ];
  
  const messageText = message.toLowerCase();
  return pushbackKeywords.some(keyword => messageText.includes(keyword));
};

/**
 * Detects if user wants to change direction or refocus
 * @param {string} message - The user's message
 * @returns {boolean} - True if redirection keywords are detected
 */
const detectRedirection = (message) => {
  const redirectionKeywords = [
    'let\'s talk about', 'i want to discuss', 'can we switch to', 'focus on',
    'what about', 'instead', 'rather', 'change topic', 'move on',
    'talk about something else', 'different question', 'new topic'
  ];
  
  const messageText = message.toLowerCase();
  return redirectionKeywords.some(keyword => messageText.includes(keyword));
};

module.exports = {
  promptConfig,
  logPromptType,
  loadCoachPrompts,
  detectOverwhelm,
  detectAdviceRequest,
  detectEmotionalSharing,
  detectChallenge,
  detectPushback,
  detectRedirection
};
