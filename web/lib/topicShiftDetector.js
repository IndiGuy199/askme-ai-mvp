/**
 * Enhanced topic detection for memory summary triggers
 * Detects significant topic shifts in conversations
 */

/**
 * Extract main topics from text using keyword analysis
 * @param {string} text - Text to analyze
 * @returns {Array} Array of detected topics
 */
function extractTopics(text) {
  if (!text || typeof text !== 'string') return [];
  
  const topicKeywords = {
    work: ['work', 'job', 'career', 'office', 'boss', 'colleague', 'project', 'deadline', 'meeting', 'salary', 'promotion', 'corporate'],
    relationships: ['relationship', 'partner', 'spouse', 'dating', 'marriage', 'divorce', 'family', 'children', 'parent', 'friend', 'social'],
    health: ['health', 'doctor', 'medical', 'exercise', 'fitness', 'diet', 'nutrition', 'sleep', 'stress', 'anxiety', 'depression', 'therapy'],
    finance: ['money', 'financial', 'budget', 'debt', 'savings', 'investment', 'retirement', 'income', 'expensive', 'affordable'],
    personal_growth: ['growth', 'development', 'learning', 'skill', 'goal', 'achievement', 'confidence', 'self-esteem', 'purpose', 'meaning'],
    lifestyle: ['lifestyle', 'hobby', 'travel', 'vacation', 'entertainment', 'leisure', 'home', 'moving', 'relocation'],
    emotions: ['feeling', 'emotion', 'happy', 'sad', 'angry', 'frustrated', 'excited', 'worried', 'overwhelmed', 'grateful'],
    future: ['future', 'plan', 'planning', 'next', 'upcoming', 'tomorrow', 'later', 'eventually', 'someday']
  };
  
  const normalizedText = text.toLowerCase();
  const foundTopics = [];
  
  for (const [topic, keywords] of Object.entries(topicKeywords)) {
    const matchCount = keywords.filter(keyword => normalizedText.includes(keyword)).length;
    if (matchCount > 0) {
      foundTopics.push({ topic, strength: matchCount });
    }
  }
  
  // Sort by strength and return top topics
  return foundTopics
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 3)
    .map(t => t.topic);
}

/**
 * Calculate topic similarity between two topic arrays
 * @param {Array} topics1 - First set of topics
 * @param {Array} topics2 - Second set of topics
 * @returns {number} Similarity score between 0 and 1
 */
function calculateTopicSimilarity(topics1, topics2) {
  if (!topics1.length && !topics2.length) return 1; // Both empty = similar
  if (!topics1.length || !topics2.length) return 0; // One empty = dissimilar
  
  const commonTopics = topics1.filter(topic => topics2.includes(topic));
  const totalUniqueTopics = new Set([...topics1, ...topics2]).size;
  
  return commonTopics.length / totalUniqueTopics;
}

/**
 * Detect if there's been a significant topic shift in recent conversation
 * @param {Array} recentMessages - Recent chat messages
 * @param {string} memorySummary - Current memory summary
 * @returns {Object} Analysis of topic shift
 */
function detectTopicShift(recentMessages, memorySummary) {
  if (!recentMessages || recentMessages.length < 3) {
    return { hasShift: false, reason: 'insufficient_messages' };
  }
  
  // Extract topics from recent user messages
  const recentUserMessages = recentMessages
    .filter(msg => msg.role === 'user')
    .slice(-3); // Last 3 user messages
    
  if (recentUserMessages.length < 2) {
    return { hasShift: false, reason: 'insufficient_user_messages' };
  }
  
  const recentText = recentUserMessages.map(msg => msg.content).join(' ');
  const recentTopics = extractTopics(recentText);
  
  if (recentTopics.length === 0) {
    return { hasShift: false, reason: 'no_topics_detected' };
  }
  
  // Extract topics from memory summary
  const memoryTopics = extractTopics(memorySummary || '');
  
  // Calculate similarity
  const similarity = calculateTopicSimilarity(recentTopics, memoryTopics);
  
  // Consider it a significant shift if similarity is below 0.3 (70% different)
  const hasSignificantShift = similarity < 0.3;
  
  return {
    hasShift: hasSignificantShift,
    similarity,
    recentTopics,
    memoryTopics,
    reason: hasSignificantShift ? 'significant_topic_change' : 'topics_similar'
  };
}

module.exports = {
  extractTopics,
  calculateTopicSimilarity,
  detectTopicShift
};
