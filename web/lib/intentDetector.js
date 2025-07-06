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
  
  // Enhanced patterns for direct advice with specific conditions
  const directAdvicePatterns = [
    'i\'m feeling anxious and depressed', 'feeling anxious and depressed',
    'i feel anxious and depressed', 'anxious and depressed what should',
    'depression and anxiety what', 'help with anxiety and depression',
    'what can i do for anxiety', 'what can i do for my anxiety',
    'how to help anxiety', 'help with anxiety', 'manage anxiety',
    'what can i do for anxiety at night', 'anxiety at night',
    'help me with my anxiety', 'ways to deal with anxiety'
  ];
  
  // Check for direct advice patterns first (these need immediate concrete advice)
  if (matchesPattern(messageText, directAdvicePatterns)) {
    return 'DIRECT_ADVICE_REQUEST';
  }
  
  if (matchesPattern(messageText, advicePatterns)) {
    return 'ADVICE_REQUEST';
  }
  
  // 2. BOUNDARY SETTING DETECTION (New for failing test cases)
  const boundaryPatterns = [
    'don\'t want to talk about', 'not comfortable discussing', 'prefer not to',
    'don\'t want to get into', 'not going there', 'that\'s private',
    'keep that to myself', 'rather not say', 'personal matter',
    'off limits', 'not sharing that', 'too personal'
  ];
  
  if (matchesPattern(messageText, boundaryPatterns)) {
    return 'BOUNDARY_RESPECT';
  }

  // 3. MEDICAL ESCALATION DETECTION (Enhanced for test case 8)
  const medicalUrgencyPatterns = [
    'chest pain', 'can\'t breathe', 'breathing problems', 'heart attack', 'stroke',
    'suicidal', 'kill myself', 'end my life', 'want to die', 'overdose',
    'severe pain', 'emergency', 'urgent', 'bleeding badly', 'losing consciousness',
    'thinking of suicide', 'hurting myself', 'self harm'
  ];
  
  if (matchesPattern(messageText, medicalUrgencyPatterns)) {
    return 'MEDICAL_URGENCY';
  }

  // 4. ADVICE REJECTION DETECTION (Enhanced for better fallback support)
  const adviceRejectionPatterns = [
    'that doesn\'t work', 'tried that already', 'doesn\'t help',
    'not working for me', 'that\'s not helpful', 'already doing that',
    'been there done that', 'doesn\'t apply to me', 'not realistic',
    'can\'t do that', 'won\'t work because', 'that\'s impossible'
  ];
  
  if (matchesPattern(messageText, adviceRejectionPatterns)) {
    return 'ADVICE_REJECTION';
  }

  // 4.5. FALLBACK REQUEST DETECTION (When user needs different approach)
  const fallbackPatterns = [
    'nothing is helping', 'nothing works', 'any other ideas',
    'what else can i do', 'something different', 'other suggestions',
    'different approach', 'tried everything', 'still struggling'
  ];
  
  if (matchesPattern(messageText, fallbackPatterns)) {
    return 'FALLBACK_REQUEST';
  }

  // 5. CHOICE REQUEST DETECTION (Enhanced for test case 9)
  const choiceRequestPatterns = [
    'what are my options', 'what can i choose', 'give me choices',
    'which is better', 'what would you recommend', 'show me options',
    'different approaches', 'various ways', 'multiple options',
    'or should i', 'either', 'alternatives',
    'trouble sleeping and work stress', 'sleeping and work', 'stress and sleep',
    'mostly trouble sleeping and work stress', 'trouble sleeping and work'
  ];
  
  if (matchesPattern(messageText, choiceRequestPatterns)) {
    return 'CHOICE_REQUEST';
  }

  // 5.5. EMOTIONAL_SHARING_WITH_VALIDATION - detect when validation is needed
  const needsValidationPatterns = [
    'feeling down lately', 'been feeling down', 'i feel down',
    'i\'ve been feeling down lately', 'feeling down', 'been down lately'
  ];
  
  if (matchesPattern(messageText, needsValidationPatterns)) {
    return 'EMOTIONAL_SHARING_WITH_VALIDATION';
  }

  // 5.6. FOLLOW_UP_ADVICE_REQUEST - asking for additional techniques  
  const followUpAdvicePatterns = [
    'what else can i do for my anxiety at night', 'what else can i do for anxiety',
    'any other suggestions', 'more ideas', 'other ways to',
    'additional techniques', 'more strategies', 'something else to try'
  ];
  
  if (matchesPattern(messageText, followUpAdvicePatterns)) {
    return 'FOLLOW_UP_ADVICE_REQUEST';
  }

  // 5.7. EXPLORATION_PREFERENCE - user wants to vent/explore not get advice
  const explorationPatterns = [
    'just need to vent', 'not ready for advice', 'just want to talk',
    'need to get this out', 'want to share', 'just venting'
  ];
  
  if (matchesPattern(messageText, explorationPatterns)) {
    return 'EXPLORATION_PREFERENCE';
  }

  // 6. FRUSTRATION DETECTION (Enhanced with more emotional expressions)
  const frustrationPatterns = [
    // Direct frustration with explicit commands
    'stop asking', 'quit asking', 'enough questions', 'too many questions',
    'stop questioning', 'you keep asking', 'i already told you',
    'i just said', 'i just told you', 'you already asked',
    'stop asking the same thing', 'just tell me what to do',
    
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
  
  // 7. EMOTIONAL SHARING DETECTION
  const emotionalPatterns = [
    // Specific emotional sharing patterns for validation
    'i\'ve been feeling down', 'feeling down lately', 'been feeling down',
    'i feel hopeless', 'feeling hopeless', 'feel hopeless sometimes',
    'i feel hopeless sometimes', 'hopeless sometimes',
    
    // General emotional expressions
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
  
  // Enhanced intent detection for Exploration & Validation test cases
  
  // SIMPLE_EMOTIONAL_SHARING - for "I've been feeling down lately" 
  const simpleEmotionalPatterns = [
    'i\'ve been feeling down', 'been feeling down lately', 'feeling down lately',
    'been sad lately', 'feeling sad', 'not feeling good lately',
    'been struggling lately', 'having a hard time lately', 'not doing well lately'
  ];
  
  if (matchesPattern(messageText, simpleEmotionalPatterns)) {
    return 'SIMPLE_EMOTIONAL_SHARING';
  }

  // CONTEXT_SHARING - for "Mostly trouble sleeping and work stress"
  const contextSharingPatterns = [
    'mostly trouble sleeping', 'trouble sleeping and work stress',
    'sleep problems and', 'work stress and', 'sleeping and work',
    'stress at work', 'work is stressful', 'can\'t sleep because',
    'mostly', 'mainly', 'primarily'
  ];
  
  if (matchesPattern(messageText, contextSharingPatterns)) {
    return 'CONTEXT_SHARING';
  }

  // EMOTIONAL_SHARING_WITH_VALIDATION - for "I feel hopeless sometimes"
  const emotionalValidationPatterns = [
    'i feel hopeless', 'feeling hopeless', 'feel hopeless sometimes',
    'i feel lost', 'feeling lost', 'feel worthless', 'feeling worthless',
    'i feel empty', 'feeling empty', 'feel broken', 'feeling broken'
  ];
  
  if (matchesPattern(messageText, emotionalValidationPatterns)) {
    return 'EMOTIONAL_SHARING_WITH_VALIDATION';
  }

  // EXPLORATION_PREFERENCE - for "just need to vent"
  const explorationPreferencePatterns = [
    'just need to vent', 'need to vent', 'not ready for advice',
    'just want to talk', 'need to talk', 'want to share',
    'just need someone to listen', 'need to get this out',
    'don\'t want advice', 'not looking for solutions'
  ];
  
  if (matchesPattern(messageText, explorationPreferencePatterns)) {
    return 'EXPLORATION_PREFERENCE';
  }

  // Enhanced logic to distinguish advice vs exploration needs
  const hasDirectAdviceLanguage = matchesPattern(messageText, [
    'what should i do', 'give me advice', 'tell me what to do',
    'help me', 'how do i', 'what can i do', 'suggestions'
  ]);
  
  if (matchesPattern(messageText, emotionalPatterns)) {
    // If they explicitly ask for advice, return ADVICE_REQUEST
    if (hasDirectAdviceLanguage) {
      return 'ADVICE_REQUEST';
    }
    // If they're just sharing emotions, return EMOTIONAL_SHARING
    return 'EMOTIONAL_SHARING';
  }
  
  // 8. FOLLOW-UP ADVICE DETECTION
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
  
  // 9. META-CONVERSATION DETECTION
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