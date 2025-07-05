/**
 * Enhanced conversation state management for context-aware responses
 */
const conversationStates = new Map(); // In-memory store

const updateConversationState = (userId, currentIntent, message) => {
  if (!userId || !currentIntent || !message) {
    console.error('Invalid parameters for updateConversationState:', { userId, currentIntent, message });
    return null;
  }

  try {
    const state = conversationStates.get(userId) || {
      consecutiveQuestions: 0,
      userFrustrationSignals: 0,
      lastAdviceGiven: null,
      lastAdviceContent: '',
      lastTopic: null,
      dominantIntent: 'GENERAL_CONVERSATION',
      intentHistory: [],
      aiActionHistory: [],
      sessionStartTime: Date.now(),
      topicHistory: [],
      lastUserMessage: '',
      repeatRequestCount: 0
    };
    
    // Track current topic
    const { detectTopic } = require('./intentDetector');
    const currentTopic = detectTopic(message);
    if (currentTopic !== 'general' && currentTopic !== state.lastTopic) {
      state.topicHistory.push({
        topic: currentTopic,
        timestamp: Date.now(),
        message: message.substring(0, 50)
      });
      
      // Keep only last 5 topics
      if (state.topicHistory.length > 5) {
        state.topicHistory = state.topicHistory.slice(-5);
      }
      
      state.lastTopic = currentTopic;
    }
    
    // Track intent history
    state.intentHistory.push({
      intent: currentIntent,
      timestamp: Date.now(),
      message: message.substring(0, 100)
    });
    
    // Keep only last 10 intents
    if (state.intentHistory.length > 10) {
      state.intentHistory = state.intentHistory.slice(-10);
    }
    
    // Enhanced frustration tracking
    if (currentIntent === 'FRUSTRATED') {
      state.userFrustrationSignals++;
    } else if (currentIntent === 'REPEAT_ADVICE_REQUEST') {
      state.repeatRequestCount++;
    } else if (currentIntent === 'ADVICE_REQUEST' || currentIntent === 'EMOTIONAL_SHARING') {
      state.userFrustrationSignals = Math.max(0, state.userFrustrationSignals - 1);
      state.repeatRequestCount = 0;
    }
    
    // Calculate dominant intent (last 5 messages)
    const recentIntents = state.intentHistory.slice(-5).map(h => h.intent);
    const adviceFocused = recentIntents.filter(i => 
      i === 'ADVICE_REQUEST' || i === 'FOLLOW_UP_ADVICE' || i === 'REPEAT_ADVICE_REQUEST'
    ).length;
    
    if (adviceFocused >= 3) {
      state.dominantIntent = 'ADVICE_FOCUSED';
    } else if (recentIntents.filter(i => i === 'EMOTIONAL_SHARING').length >= 2) {
      state.dominantIntent = 'EMOTIONAL_FOCUSED';
    } else if (recentIntents.filter(i => i === 'FRUSTRATED').length >= 2) {
      state.dominantIntent = 'FRUSTRATED_USER';
    } else {
      state.dominantIntent = 'GENERAL_CONVERSATION';
    }
    
    // Store last user message
    state.lastUserMessage = message;
    
    conversationStates.set(userId, state);
    return state;
    
  } catch (error) {
    console.error('Error in updateConversationState:', error);
    return null;
  }
};

const trackAIAction = (userId, action, content) => {
  if (!userId || !action || !content) return;
  
  try {
    const state = conversationStates.get(userId);
    if (!state) return;
    
    // Track what the AI just did
    state.aiActionHistory.push({
      action,
      timestamp: Date.now(),
      preview: content.substring(0, 50)
    });
    
    // Update consecutive question counter
    if (action === 'ASKED_QUESTION') {
      state.consecutiveQuestions++;
    } else {
      state.consecutiveQuestions = 0;
    }
    
    // Enhanced advice tracking
    if (action === 'GAVE_ADVICE') {
      state.lastAdviceGiven = Date.now();
      state.lastAdviceContent = content;
      state.repeatRequestCount = 0;
    }
    
    // Keep only last 5 actions
    if (state.aiActionHistory.length > 5) {
      state.aiActionHistory = state.aiActionHistory.slice(-5);
    }
    
    conversationStates.set(userId, state);
  } catch (error) {
    console.error('Error in trackAIAction:', error);
  }
};

const shouldAvoidRepeatingAdvice = (userId) => {
  try {
    const state = conversationStates.get(userId);
    if (!state || !state.lastAdviceContent) return false;
    
    const timeSinceAdvice = Date.now() - (state.lastAdviceGiven || 0);
    return timeSinceAdvice < 120000; // 2 minutes
  } catch (error) {
    console.error('Error in shouldAvoidRepeatingAdvice:', error);
    return false;
  }
};

const getFlowRecommendations = (userId) => {
  try {
    const state = conversationStates.get(userId);
    if (!state) return { type: 'normal' };
    
    if (state.userFrustrationSignals > 2) {
      return {
        type: 'meta_reset',
        message: 'User is highly frustrated. Reset conversation approach completely.'
      };
    }
    
    if (state.consecutiveQuestions >= 3) {
      return {
        type: 'stop_questions',
        message: 'Stop asking questions. User may be tired of exploration mode.'
      };
    }
    
    if (state.repeatRequestCount >= 2) {
      return {
        type: 'clarify_need',
        message: 'User keeps asking for advice. Previous advice may not have been helpful.'
      };
    }
    
    return { type: 'normal' };
  } catch (error) {
    console.error('Error in getFlowRecommendations:', error);
    return { type: 'normal' };
  }
};

const getConversationState = (userId) => {
  try {
    return conversationStates.get(userId);
  } catch (error) {
    console.error('Error in getConversationState:', error);
    return null;
  }
};

module.exports = { 
  updateConversationState, 
  trackAIAction,
  getConversationState,
  shouldAvoidRepeatingAdvice,
  getFlowRecommendations
};