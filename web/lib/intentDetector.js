/**
 * Enhanced intent detection for AskMe AI chat system
 * Detects user intent from their message to select appropriate prompt strategy
 */

/**
 * More flexible pattern matching that handles word boundaries and variations
 */
const matchesPattern = (text, patterns) => {
  if (!text || !patterns) return false;
  
  const normalizedText = text.toLowerCase();
  return patterns.some(pattern => {
    try {
      if (typeof pattern === 'string') {
        // Escape special regex characters and create word boundary pattern
        const escapedPattern = pattern.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp(`\\b${escapedPattern}\\b`, 'i');
        return regex.test(normalizedText);
      } else if (pattern instanceof RegExp) {
        return pattern.test(normalizedText);
      }
      return false;
    } catch (error) {
      console.error('Pattern matching error:', error);
      return false;
    }
  });
};

/**
 * Simple topic detection from message content
 */
const detectTopic = (messageContent) => {
  if (!messageContent || typeof messageContent !== 'string') return 'general';
  
  const topicKeywords = {
    work: ['work', 'job', 'career', 'boss', 'office', 'colleague', 'workplace', 'deadline'],
    relationship: ['partner', 'wife', 'husband', 'girlfriend', 'boyfriend', 'family', 'sister', 'brother', 'marriage'],
    health: ['sleep', 'energy', 'exercise', 'diet', 'weight', 'fitness', 'health', 'doctor'],
    mental: ['anxiety', 'depression', 'stress', 'overwhelm', 'panic', 'mood', 'therapy', 'counseling'],
    purpose: ['meaning', 'purpose', 'direction', 'goals', 'future', 'life', 'passion', 'fulfillment'],
    money: ['money', 'financial', 'budget', 'debt', 'savings', 'investment', 'income', 'expenses']
  };
  
  const words = messageContent.toLowerCase().split(/\s+/);
  
  for (const [topic, keywords] of Object.entries(topicKeywords)) {
    if (keywords.some(keyword => words.includes(keyword))) {
      return topic;
    }
  }
  
  return 'general';
};

/**
 * Enhanced intent detection with flexible pattern matching and contextual flow fixes
 */
const detectUserIntent = (message, conversationHistory = [], conversationState = null) => {
  // Input validation
  if (!message || typeof message !== 'string') {
    console.error('Invalid message input:', message);
    return 'GENERAL_CONVERSATION';
  }
  
  // Ensure conversationHistory is an array
  const history = Array.isArray(conversationHistory) ? conversationHistory : [];
  
  const messageText = message.toLowerCase();
  
  // CONTEXTUAL FLOW FIXES - Check conversation state first
  if (conversationState) {
    try {
      // Too many frustration signals - reset conversation
      if (conversationState.userFrustrationSignals > 2) {
        return 'META_RESET';
      }
      
      // Rapid advice requests - user might not be satisfied
      if (conversationState.lastAdviceGiven && 
          (Date.now() - conversationState.lastAdviceGiven) < 60000) {
        const advicePatterns = ['advice', 'help', 'suggestions', 'ideas', 'what should i do'];
        if (matchesPattern(messageText, advicePatterns)) {
          return 'REPEAT_ADVICE_REQUEST';
        }
      }
      
      // User asking similar questions repeatedly
      if (conversationState.intentHistory && Array.isArray(conversationState.intentHistory)) {
        const recentUserMessages = conversationState.intentHistory
          .slice(-3)
          .filter(h => h.intent === 'ADVICE_REQUEST')
          .map(h => h.message || '');
        
        if (recentUserMessages.length >= 2) {
          // Check if current message is similar to recent advice requests
          const currentWords = messageText.split(/\s+/);
          const similarityFound = recentUserMessages.some(prevMsg => {
            if (!prevMsg) return false;
            const prevWords = prevMsg.toLowerCase().split(/\s+/);
            const commonWords = currentWords.filter(word => 
              word.length > 3 && prevWords.includes(word)
            );
            return commonWords.length >= 2; // Similar if 2+ common words
          });
          
          if (similarityFound) {
            return 'REPEAT_ADVICE_REQUEST';
          }
        }
      }
    } catch (error) {
      console.error('Error in contextual flow checks:', error);
    }
  }
  
  // 1. ADVICE REQUEST DETECTION (Enhanced with more synonyms)
  const advicePatterns = [
    // Direct requests
    'give me advice', 'need advice', 'want advice', 'looking for advice',
    'show me how', 'tell me how', 'help me with', 'help me figure out',
    'what should i do', 'what can i do', 'what would you do',
    'how do i', 'how can i', 'how should i',
    
    // Enhanced: More natural language
    'tips', 'ways to', 'methods', 'techniques', 'strategies',
    'how would you', 'what\'s your take', 'give your thoughts',
    'your opinion', 'what do you think', 'any ideas',
    'suggestions', 'recommendations', 'guidance',
    
    // Indirect requests
    'i don\'t know what to do', 'i\'m stuck', 'i need help',
    'can you help', 'do you have ideas', 'what are some ways'
  ];
  
  if (matchesPattern(messageText, advicePatterns)) {
    return 'ADVICE_REQUEST';
  }
  
  // 2. FRUSTRATION DETECTION (Enhanced with more emotional expressions)
  const frustrationPatterns = [
    // Direct frustration
    'stop asking', 'quit asking', 'enough questions', 'too many questions',
    'stop questioning', 'you keep asking', 'i already told you',
    'i just said', 'i just told you', 'you already asked',
    
    // Enhanced: More emotional expressions
    'fed up', 'annoyed', 'pissed', 'pissed off', 'enough',
    'don\'t bother', 'whatever', 'forget it', 'never mind',
    'skip it', 'this is annoying', 'you\'re annoying',
    
    // Subtle frustration
    'that\'s not helpful', 'this isn\'t helpful', 'not helping',
    'isn\'t working', 'not working', 'doesn\'t help',
    'useless', 'pointless', 'this is frustrating',
    
    // AI-specific frustration
    'you don\'t understand', 'missing the point', 'not listening',
    'you\'re not getting it', 'that\'s generic', 'too general'
  ];
  
  // Check for escalating patterns (multiple punctuation, caps)
  const hasEscalationSignals = 
    /[!]{2,}/.test(message) || 
    /[?]{2,}/.test(message) ||
    (message === message.toUpperCase() && message.length > 5);
  
  if (matchesPattern(messageText, frustrationPatterns) || hasEscalationSignals) {
    return 'FRUSTRATED';
  }
  
  // 3. EMOTIONAL SHARING DETECTION
  const emotionalPatterns = [
    // Feeling expressions
    'i feel', 'i am feeling', 'i\'m feeling', 'feeling',
    'makes me feel', 'i felt', 'it feels',
    
    // Emotional states
    'anxious', 'depressed', 'overwhelmed', 'stressed', 'sad',
    'angry', 'lonely', 'scared', 'worried', 'frustrated',
    'tired', 'exhausted', 'hopeless', 'lost', 'confused',
    'stuck', 'helpless', 'devastated', 'heartbroken',
    
    // Difficulty expressions
    'having a hard time', 'struggling with', 'going through',
    'dealing with', 'it\'s been hard', 'really difficult',
    'tough time', 'can\'t handle', 'falling apart',
    'breaking down', 'in pain', 'hurting'
  ];
  
  if (matchesPattern(messageText, emotionalPatterns)) {
    return 'EMOTIONAL_SHARING';
  }
  
  // 4. FOLLOW-UP ADVICE DETECTION
  const followUpPatterns = [
    'what about', 'how about', 'what if', 'what else',
    'any other', 'other ideas', 'more suggestions', 'additional',
    'besides that', 'apart from that', 'other than that',
    'what\'s next', 'then what', 'and also'
  ];
  
  // Check if recent advice was given (with safe array handling)
  const recentAdviceGiven = history.length > 0 && history.slice(-3).some(msg => {
    if (!msg || !msg.content) return false;
    return msg.role === 'assistant' && 
           matchesPattern(msg.content, ['try', 'suggest', 'recommend', 'consider', 'here are', 'steps']);
  });
  
  if (matchesPattern(messageText, followUpPatterns)) {
    return recentAdviceGiven ? 'FOLLOW_UP_ADVICE' : 'ADVICE_REQUEST';
  }
  
  // 5. META-CONVERSATION DETECTION
  const metaPatterns = [
    'asking too many questions', 'too many questions', 'stop asking',
    'this isn\'t working', 'this conversation isn\'t working',
    'different approach', 'try something different', 'change approach',
    'let\'s try', 'can we try', 'how about we', 'maybe we should',
    'different way', 'another way', 'new approach'
  ];
  
  if (matchesPattern(messageText, metaPatterns)) {
    return 'META_CONVERSATION';
  }
  
  return 'GENERAL_CONVERSATION';
};

module.exports = { 
  detectUserIntent, 
  matchesPattern, 
  detectTopic 
};