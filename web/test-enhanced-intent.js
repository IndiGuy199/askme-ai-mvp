const { detectUserIntent, matchesPattern, detectTopic } = require('./lib/intentDetector');
const { updateConversationState, getFlowRecommendations } = require('./lib/conversationState');

// Enhanced test cases
const testCases = [
  // Advice requests with new synonyms
  { msg: "What's your take on this situation?", expected: 'ADVICE_REQUEST' },
  { msg: "Give your thoughts on how to handle this", expected: 'ADVICE_REQUEST' },
  { msg: "Any tips for dealing with stress?", expected: 'ADVICE_REQUEST' },
  { msg: "What are some ways to improve my sleep?", expected: 'ADVICE_REQUEST' },
  
  // Enhanced frustration patterns
  { msg: "I'm fed up with this", expected: 'FRUSTRATED' },
  { msg: "Don't bother, whatever", expected: 'FRUSTRATED' },
  { msg: "This is annoying me", expected: 'FRUSTRATED' },
  { msg: "Enough already!", expected: 'FRUSTRATED' },
  
  // Emotional sharing
  { msg: "I'm feeling overwhelmed by everything", expected: 'EMOTIONAL_SHARING' },
  { msg: "I can't handle this anymore", expected: 'EMOTIONAL_SHARING' },
  { msg: "I'm having a hard time with depression", expected: 'EMOTIONAL_SHARING' },
  
  // General conversation
  { msg: "Hello, how are you?", expected: 'GENERAL_CONVERSATION' },
  { msg: "What's the weather like?", expected: 'GENERAL_CONVERSATION' }
];

// Test contextual flow scenarios
const contextualTests = [
  {
    name: 'Rapid Advice Requests',
    scenario: () => {
      const userId = 'test-user-flow-1';
      const state1 = updateConversationState(userId, 'ADVICE_REQUEST', 'How do I handle stress?');
      const state2 = updateConversationState(userId, 'ADVICE_REQUEST', 'What should I do about anxiety?');
      
      // Simulate advice given 30 seconds ago
      const { trackAIAction } = require('./lib/conversationState');
      trackAIAction(userId, 'GAVE_ADVICE', 'Try deep breathing exercises...');
      
      // User asks for advice again quickly
      const intent = detectUserIntent('Give me more advice', [], state2);
      return { intent, expected: 'REPEAT_ADVICE_REQUEST' };
    }
  },
  {
    name: 'High Frustration Flow',
    scenario: () => {
      const userId = 'test-user-flow-2';
      const state1 = updateConversationState(userId, 'FRUSTRATED', 'Stop asking questions');
      const state2 = updateConversationState(userId, 'FRUSTRATED', 'This isn\'t helpful');
      const state3 = updateConversationState(userId, 'FRUSTRATED', 'You don\'t understand');
      
      const flowRec = getFlowRecommendations(userId);
      return { flowType: flowRec.type, expected: 'meta_reset' };
    }
  }
];

console.log('🧪 Testing Enhanced Intent Detection with Flow Fixes...\n');
console.log('=' .repeat(60));

// Test basic patterns
let passCount = 0;
let failCount = 0;

console.log('📋 BASIC PATTERN TESTS:\n');

testCases.forEach((test, i) => {
  const detected = detectUserIntent(test.msg, []);
  const pass = detected === test.expected;
  
  if (pass) {
    passCount++;
    console.log(`${i + 1}. ✅ "${test.msg}"`);
    console.log(`   ✓ Correctly detected: ${detected}\n`);
  } else {
    failCount++;
    console.log(`${i + 1}. ❌ "${test.msg}"`);
    console.log(`   ✗ Expected: ${test.expected}, Got: ${detected}\n`);
  }
});

// Test contextual scenarios
console.log('\n📋 CONTEXTUAL FLOW TESTS:\n');

contextualTests.forEach((test, i) => {
  try {
    const result = test.scenario();
    const pass = result.intent === result.expected || result.flowType === result.expected;
    
    if (pass) {
      passCount++;
      console.log(`${i + 1}. ✅ ${test.name}`);
      console.log(`   ✓ Flow working correctly\n`);
    } else {
      failCount++;
      console.log(`${i + 1}. ❌ ${test.name}`);
      console.log(`   ✗ Expected: ${result.expected}, Got: ${result.intent || result.flowType}\n`);
    }
  } catch (error) {
    failCount++;
    console.log(`${i + 1}. ❌ ${test.name} - Error: ${error.message}\n`);
  }
});

// Test pattern matching function
console.log('\n🔧 PATTERN MATCHING TESTS:\n');

const patternTests = [
  { text: "I'm fed up with this", patterns: ['fed up'], shouldMatch: true },
  { text: "What's your take?", patterns: ['what\'s your take'], shouldMatch: true },
  { text: "Give me some tips", patterns: ['tips'], shouldMatch: true },
  { text: "The feedback was helpful", patterns: ['fed up'], shouldMatch: false }
];

patternTests.forEach((test, i) => {
  const matches = matchesPattern(test.text, test.patterns);
  const pass = matches === test.shouldMatch;
  
  if (pass) {
    passCount++;
    console.log(`${i + 1}. ✅ Pattern matching: "${test.text}"`);
  } else {
    failCount++;
    console.log(`${i + 1}. ❌ Pattern matching: "${test.text}"`);
  }
});

// Test topic detection
console.log('\n🎯 TOPIC DETECTION TESTS:\n');

const topicTests = [
  { msg: "I'm having trouble at work with my boss", expectedTopic: 'work' },
  { msg: "My relationship with my wife is struggling", expectedTopic: 'relationship' },
  { msg: "I can't sleep and have no energy", expectedTopic: 'health' },
  { msg: "I feel anxious and depressed", expectedTopic: 'mental' }
];

topicTests.forEach((test, i) => {
  const topic = detectTopic(test.msg);
  const pass = topic === test.expectedTopic;
  
  if (pass) {
    passCount++;
    console.log(`${i + 1}. ✅ Topic: "${test.msg}" → ${topic}`);
  } else {
    failCount++;
    console.log(`${i + 1}. ❌ Topic: "${test.msg}" → Expected: ${test.expectedTopic}, Got: ${topic}`);
  }
});

const totalTests = testCases.length + contextualTests.length + patternTests.length + topicTests.length;

console.log('\n' + '=' .repeat(60));
console.log(`\n📊 FINAL RESULTS:`);
console.log(`✅ Passed: ${passCount}/${totalTests}`);
console.log(`❌ Failed: ${failCount}/${totalTests}`);
console.log(`📈 Success Rate: ${Math.round((passCount / totalTests) * 100)}%\n`);

if (failCount === 0) {
  console.log('🎉 All tests passed! Enhanced intent detection with flow fixes is working correctly.\n');
} else {
  console.log('💡 Some tests failed. Check the patterns and flow logic for improvements.\n');
}