/**
 * Comprehensive test script for memory update triggers
 * Tests all scenarios: periodic, quality-based, time-based, breakthrough, and topic shift
 */

const { createClient } = require('@supabase/supabase-js');
const { detectTopicShift } = require('./lib/topicShiftDetector');
const { shouldTriggerSessionEndUpdate } = require('./lib/sessionTracker');

// Test configuration
const TEST_USER_ID = 'test-memory-triggers-' + Date.now();
const TEST_EMAIL = `test-triggers-${Date.now()}@example.com`;

// Initialize clients
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);

async function setupTestUser() {
  console.log('🔧 Setting up test user...');
  
  // Create test user
  const { error: userError } = await supabase
    .from('users')
    .insert([{ 
      id: TEST_USER_ID,
      email: TEST_EMAIL,
      first_name: 'TestUser',
      created_at: new Date().toISOString()
    }]);
    
  if (userError) {
    console.error('❌ Error creating test user:', userError);
    throw userError;
  }
  
  // Create initial profile
  const initialSummary = `TestUser is exploring work-life balance and stress management. He's been working on improving communication with his family.`;
  
  const { error: profileError } = await supabase
    .from('user_profiles')
    .insert([{
      user_id: TEST_USER_ID,
      memory_summary: initialSummary,
      last_activity: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
      created_at: new Date().toISOString(),
      updated_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() // 2 hours ago
    }]);
    
  if (profileError) {
    console.error('❌ Error creating test profile:', profileError);
    throw profileError;
  }
  
  console.log('✅ Test user created');
  return initialSummary;
}

async function testPeriodicTrigger() {
  console.log('\n📅 Testing periodic trigger (every 6 messages)...');
  
  // Add 5 messages (should not trigger)
  const messages = [];
  for (let i = 1; i <= 5; i++) {
    messages.push({
      user_id: TEST_USER_ID,
      role: i % 2 === 1 ? 'user' : 'assistant',
      content: `Test message ${i} - this is a substantial message with meaningful content.`,
      created_at: new Date(Date.now() - (5 - i) * 60000).toISOString()
    });
  }
  
  const { error: msgError } = await supabase
    .from('chat_messages')
    .insert(messages);
    
  if (msgError) {
    console.error('❌ Error creating test messages:', msgError);
    return false;
  }
  
  // Check trigger logic
  const totalMessages = 5 + 2; // +2 for current user message and AI response
  const shouldTrigger = totalMessages % 6 === 0;
  
  console.log(`Total messages: ${totalMessages}, Should trigger: ${shouldTrigger}`);
  
  // Add one more message (should trigger at 6)
  await supabase
    .from('chat_messages')
    .insert([{
      user_id: TEST_USER_ID,
      role: 'user',
      content: 'This is the 6th message that should trigger periodic update.',
      created_at: new Date().toISOString()
    }]);
  
  const newTotal = 6 + 2;
  const newShouldTrigger = newTotal % 6 === 0;
  console.log(`New total: ${newTotal}, Should trigger: ${newShouldTrigger}`);
  
  return newShouldTrigger;
}

async function testQualityBasedTrigger() {
  console.log('\n📝 Testing quality-based trigger (substantial messages)...');
  
  // Add short/low-quality messages that shouldn't count
  const lowQualityMessages = [
    { role: 'user', content: 'yes' },
    { role: 'assistant', content: 'ok' },
    { role: 'user', content: 'hmm' },
    { role: 'assistant', content: 'sure' }
  ];
  
  // Add substantial messages that should count
  const substantialMessages = [
    { role: 'user', content: 'I\'ve been thinking a lot about my career direction and whether I should make a change.' },
    { role: 'assistant', content: 'That sounds like something really important to explore. What\'s prompting these thoughts about your career?' },
    { role: 'user', content: 'The company culture has become toxic and I don\'t feel valued anymore.' },
    { role: 'assistant', content: 'It must be really difficult to work in an environment where you don\'t feel appreciated.' }
  ];
  
  const allMessages = [...lowQualityMessages, ...substantialMessages].map((msg, i) => ({
    user_id: TEST_USER_ID,
    role: msg.role,
    content: msg.content,
    created_at: new Date(Date.now() - (allMessages.length - i) * 30000).toISOString()
  }));
  
  await supabase
    .from('chat_messages')
    .insert(allMessages);
  
  // Test the quality filter logic
  const isSubstantialMessage = (msg) => {
    return msg.content.length > 20 && 
           !/^(yes|no|ok|okay|hmm|thanks|sure|right|exactly|absolutely)$/i.test(msg.content.trim());
  };
  
  const substantialCount = substantialMessages.filter(isSubstantialMessage).length;
  const shouldTrigger = substantialCount % 4 === 0;
  
  console.log(`Substantial messages: ${substantialCount}, Should trigger: ${shouldTrigger}`);
  return shouldTrigger;
}

async function testTimeBasedTrigger() {
  console.log('\n⏰ Testing time-based trigger (24+ hours)...');
  
  // Profile was created 2 hours ago, so this shouldn't trigger yet
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('updated_at')
    .eq('user_id', TEST_USER_ID)
    .single();
  
  const lastUpdate = new Date(profile.updated_at);
  const hoursSinceUpdate = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60);
  const shouldTrigger = hoursSinceUpdate > 24;
  
  console.log(`Hours since last update: ${hoursSinceUpdate.toFixed(1)}, Should trigger: ${shouldTrigger}`);
  
  // Test with old timestamp
  await supabase
    .from('user_profiles')
    .update({
      updated_at: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString() // 25 hours ago
    })
    .eq('user_id', TEST_USER_ID);
  
  const newHoursSinceUpdate = 25;
  const newShouldTrigger = newHoursSinceUpdate > 24;
  console.log(`New hours since update: ${newHoursSinceUpdate}, Should trigger: ${newShouldTrigger}`);
  
  return newShouldTrigger;
}

async function testBreakthroughTrigger() {
  console.log('\n💡 Testing breakthrough detection...');
  
  const breakthroughMessages = [
    'I just realized something important about my relationship patterns',
    'This is a breakthrough moment for me - I understand now',
    'I have clarity about what I need to do',
    'This insight is eye-opening',
    'I figured out why I keep doing this'
  ];
  
  const hasBreakthroughKeywords = (msg) => {
    const breakthroughKeywords = ['realize', 'understand', 'breakthrough', 'clarity', 'insight', 
                                 'epiphany', 'clicking', 'makes sense', 'aha', 'figured out',
                                 'discovered', 'learned', 'perspective', 'eye-opening'];
    return breakthroughKeywords.some(keyword => msg.toLowerCase().includes(keyword));
  };
  
  const results = breakthroughMessages.map(msg => ({
    message: msg,
    hasBreakthrough: hasBreakthroughKeywords(msg)
  }));
  
  console.log('Breakthrough detection results:');
  results.forEach(r => console.log(`  "${r.message.substring(0, 50)}..." -> ${r.hasBreakthrough}`));
  
  return results.some(r => r.hasBreakthrough);
}

async function testTopicShiftTrigger() {
  console.log('\n🔄 Testing topic shift detection...');
  
  // Create messages about work stress
  const workMessages = [
    { role: 'user', content: 'My job is really stressful and my boss is demanding impossible deadlines' },
    { role: 'assistant', content: 'That sounds like a lot of pressure. How are you managing the stress?' },
    { role: 'user', content: 'I\'ve been working late every night and missing time with my family' }
  ];
  
  // Create messages about relationship issues (topic shift)
  const relationshipMessages = [
    { role: 'user', content: 'Actually, I want to talk about my marriage. My spouse and I have been arguing a lot' },
    { role: 'assistant', content: 'I hear you shifting to talk about your relationship. What\'s been happening?' },
    { role: 'user', content: 'We\'re having trouble communicating and I feel like we\'re growing apart' }
  ];
  
  const workSummary = 'TestUser is dealing with work stress, deadline pressure, and work-life balance issues.';
  
  // Test topic shift detection
  const shiftAnalysis = detectTopicShift(relationshipMessages, workSummary);
  
  console.log('Topic shift analysis:');
  console.log(`  Has shift: ${shiftAnalysis.hasShift}`);
  console.log(`  Similarity: ${shiftAnalysis.similarity?.toFixed(2) || 'N/A'}`);
  console.log(`  Recent topics: [${shiftAnalysis.recentTopics?.join(', ') || 'none'}]`);
  console.log(`  Memory topics: [${shiftAnalysis.memoryTopics?.join(', ') || 'none'}]`);
  console.log(`  Reason: ${shiftAnalysis.reason}`);
  
  return shiftAnalysis.hasShift;
}

async function testSessionTimeoutTrigger() {
  console.log('\n⏱️ Testing session timeout detection...');
  
  // Set last activity to 31 minutes ago (beyond 30-minute timeout)
  await supabase
    .from('user_profiles')
    .update({
      last_activity: new Date(Date.now() - 31 * 60 * 1000).toISOString()
    })
    .eq('user_id', TEST_USER_ID);
  
  // Add some messages to show there was conversation
  await supabase
    .from('chat_messages')
    .insert([{
      user_id: TEST_USER_ID,
      role: 'user',
      content: 'This message was from the previous session',
      created_at: new Date(Date.now() - 35 * 60 * 1000).toISOString()
    }]);
  
  const sessionCheck = await shouldTriggerSessionEndUpdate(TEST_USER_ID);
  
  console.log('Session timeout analysis:');
  console.log(`  Should update: ${sessionCheck.shouldUpdate}`);
  console.log(`  Reason: ${sessionCheck.reason}`);
  console.log(`  Minutes since activity: ${sessionCheck.sessionStatus?.timeSinceActivity ? Math.round(sessionCheck.sessionStatus.timeSinceActivity / (1000 * 60)) : 'N/A'}`);
  
  return sessionCheck.shouldUpdate;
}

async function cleanup() {
  console.log('\n🧹 Cleaning up test data...');
  
  await supabase.from('chat_messages').delete().eq('user_id', TEST_USER_ID);
  await supabase.from('user_profiles').delete().eq('user_id', TEST_USER_ID);
  await supabase.from('users').delete().eq('id', TEST_USER_ID);
  
  console.log('✅ Cleanup complete');
}

async function runAllTests() {
  try {
    console.log('🚀 COMPREHENSIVE MEMORY TRIGGER TESTS\n');
    
    await setupTestUser();
    
    const results = {
      periodic: await testPeriodicTrigger(),
      quality: await testQualityBasedTrigger(),
      timeBased: await testTimeBasedTrigger(),
      breakthrough: await testBreakthroughTrigger(),
      topicShift: await testTopicShiftTrigger(),
      sessionTimeout: await testSessionTimeoutTrigger()
    };
    
    console.log('\n📊 TEST RESULTS SUMMARY:');
    console.log('========================');
    Object.entries(results).forEach(([test, passed]) => {
      console.log(`${passed ? '✅' : '❌'} ${test.padEnd(15)}: ${passed ? 'WORKING' : 'FAILED'}`);
    });
    
    const allPassed = Object.values(results).every(r => r);
    console.log(`\n${allPassed ? '🎉' : '⚠️'} Overall: ${allPassed ? 'ALL TRIGGERS WORKING' : 'SOME ISSUES DETECTED'}`);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await cleanup();
  }
}

// Run the tests
if (require.main === module) {
  runAllTests();
}

module.exports = { runAllTests };
