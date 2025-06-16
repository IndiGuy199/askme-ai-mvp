/**
 * Helper function to determine if a message represents a new topic
 * Used to decide when to use a more comprehensive system prompt
 */
function determineIfNewTopic(message, chat_history) {
  // Skip if no message or no chat history
  if (!message || !chat_history || chat_history.length === 0) return false;
  
  // Common phrases that indicate a topic change
  const newTopicPatterns = [
    /^(new|different) (topic|subject|question)/i,
    /^(by the way|btw|oh|also|I have another|speaking of|changing subjects?|on another note)/i,
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

module.exports = determineIfNewTopic;
