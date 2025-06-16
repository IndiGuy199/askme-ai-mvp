/**
 * Prompt strategy handler for managing AI conversation context
 * Works with promptConfig to select appropriate prompts and maintain AI persona
 */

const { promptConfig } = require('./promptConfig');

/**
 * Selects the appropriate system prompt based on conversation context
 * 
 * @param {number} messageCount - Number of messages in the conversation
 * @param {boolean} hasMemory - Whether user memory/context exists
 * @param {boolean} isNewTopic - Whether this is a new conversation topic
 * @param {Object} coachPrompts - Custom coach prompts if available
 * @returns {string} The selected system prompt
 */
const getSystemPrompt = (messageCount, hasMemory, isNewTopic, coachPrompts) => {
  // Use optional chaining for safer property access
  const full = coachPrompts?.full || promptConfig.system?.full || '';
  const medium = coachPrompts?.medium || promptConfig.system?.medium || '';
  const short = coachPrompts?.short || promptConfig.system?.short || '';

  // Logic to determine which prompt to use
  if (messageCount < 3 || isNewTopic || !hasMemory) {
    console.log('Using FULL system prompt');
    return full;
  } else if (messageCount < 10) {
    console.log('Using MEDIUM system prompt');
    return medium;
  } else {
    console.log('Using SHORT system prompt');
    return short;
  }
};

/**
 * Adds a role reminder to the memory summary to maintain AI persona consistency
 * 
 * @param {string} summary - The current memory summary
 * @param {Object} coachProfile - Optional coach profile for dynamic role reminder
 * @returns {string} Summary with role reminder appended
 */
const addRoleReminder = (summary, coachProfile = null) => {
  if (!summary) return summary;
  
  // Generate dynamic role reminder based on coach profile
  let roleReminder;
  if (coachProfile?.system_prompt) {
    // Extract the essence of the coach's persona from their system prompt
    const coachName = coachProfile.code || 'AskMe AI';
    roleReminder = `\n\nRemember: Maintain your coaching persona as defined in your system prompt. You are ${coachName}, providing supportive guidance while staying true to your established character and communication style.`;
  } else {
    // Fallback to default AskMe AI reminder
    roleReminder = "\n\nRemember: You are AskMe AI, a calm, intelligent wellness coach specifically for men over 45. Maintain your supportive, understanding persona while providing actionable guidance.";
  }
  
  // Check if summary already contains a similar reminder to avoid duplication
  if (summary.includes("Remember:") || summary.includes("You are ") || summary.includes("wellness coach")) {
    return summary;
  }
  
  return summary + roleReminder;
};

/**
 * Customizes prompt based on user's communication style and coaching format preferences
 * 
 * @param {string} basePrompt - The base system prompt
 * @param {string} communicationStyle - User's preferred communication style
 * @param {string} coachingFormat - User's preferred coaching format
 * @returns {string} Customized prompt with style preferences
 */
const customizePromptForPreferences = (basePrompt, communicationStyle, coachingFormat) => {
  if (!basePrompt) return basePrompt;
  
  let styleInstructions = '';
  
  // Add communication style instructions
  if (communicationStyle) {
    switch (communicationStyle) {
      case 'direct':
        styleInstructions += 'Communication Style: Be direct and to-the-point. Skip fluff and get straight to actionable advice. Use clear, concise language. ';
        break;
      case 'step-by-step':
        styleInstructions += 'Communication Style: Provide detailed, step-by-step guidance. Break down advice into clear, numbered action items. Include specifics and examples. ';
        break;
      case 'gentle-encouraging':
        styleInstructions += 'Communication Style: Use a gentle, encouraging tone with positive reinforcement. Be supportive and understanding. Celebrate progress and offer motivation. ';
        break;
    }
  }
  
  // Add coaching format instructions
  if (coachingFormat) {
    switch (coachingFormat) {
      case 'concise':
        styleInstructions += 'Response Format: Keep responses brief and concise. Focus on key points only. Avoid lengthy explanations. ';
        break;
      case 'detailed':
        styleInstructions += 'Response Format: Provide in-depth, thorough explanations with examples and context. Include background information and detailed reasoning. ';
        break;
      case 'conversational':
        styleInstructions += 'Response Format: Use natural, conversational dialogue. Maintain context from previous messages and ask follow-up questions when appropriate. ';
        break;
    }
  }
  
  if (styleInstructions) {
    return basePrompt + '\n\nIMPORTANT - User Preferences: ' + styleInstructions.trim();
  }
  
  return basePrompt;
};

module.exports = {
  getSystemPrompt,
  addRoleReminder,
  customizePromptForPreferences
};