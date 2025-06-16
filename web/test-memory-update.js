/**
 * Test script to validate the new memory summary update approach
 * This tests that the memory summary correctly incorporates both existing summary and recent conversation
 */

const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
const { promptConfig } = require('./lib/promptConfig');

// Test configuration
const TEST_USER_ID = 'test-memory-user-' + Date.now();
const TEST_EMAIL = `test-memory-${Date.now()}@example.com`;

// Initialize clients
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function setupTestData() {
  console.log('Setting up test data...');
  
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
    console.error('Error creating test user:', userError);
    throw userError;
  }
  
  // Create initial profile with existing summary
  const initialSummary = `TestUser is a 47-year-old professional exploring work-life balance. He's been working on reducing stress and improving his relationships with his family. Key challenges include managing work pressure and finding time for self-care. He responds well to direct questions and appreciates practical advice.`;
  
  const { error: profileError } = await supabase
    .from('user_profiles')
    .insert([{
      user_id: TEST_USER_ID,
      memory_summary: initialSummary,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }]);
    
  if (profileError) {
    console.error('Error creating test profile:', profileError);
    throw profileError;
  }
  
  // Add some recent chat messages
  const recentMessages = [
    { role: 'user', content: 'I\'ve been thinking about changing careers lately. The corporate environment is really draining me.', user_id: TEST_USER_ID },
    { role: 'assistant', content: 'That sounds like a significant realization. What specifically about the corporate environment feels most draining to you?', user_id: TEST_USER_ID },
    { role: 'user', content: 'It\'s the constant pressure to meet unrealistic deadlines and the lack of creativity in my role. I feel like I\'m just a cog in the machine.', user_id: TEST_USER_ID },
    { role: 'assistant', content: 'That feeling of being disconnected from meaningful work can be really challenging. When you imagine a different career path, what kind of work energizes you?', user_id: TEST_USER_ID },
    { role: 'user', content: 'I\'ve always been passionate about teaching or maybe starting my own consulting business. Something where I can make a real impact.', user_id: TEST_USER_ID }
  ];
  
  const messagesWithTimestamps = recentMessages.map((msg, index) => ({
    ...msg,
    created_at: new Date(Date.now() - (recentMessages.length - index) * 60000).toISOString() // 1 minute apart
  }));
  
  const { error: messagesError } = await supabase
    .from('chat_messages')
    .insert(messagesWithTimestamps);
    
  if (messagesError) {
    console.error('Error creating test messages:', messagesError);
    throw messagesError;
  }
  
  console.log('Test data setup complete');
  return initialSummary;
}

async function testMemoryUpdate() {
  console.log('Testing memory update approach...');
  
  // Get existing summary
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('memory_summary')
    .eq('user_id', TEST_USER_ID)
    .single();
    
  if (profileError) {
    console.error('Error fetching profile:', profileError);
    throw profileError;
  }
  
  const currentSummary = profile.memory_summary;
  console.log(`Current summary (${currentSummary.length} chars): ${currentSummary.substring(0, 100)}...`);
  
  // Get recent messages
  const { data: messages, error: msgError } = await supabase
    .from('chat_messages')
    .select('role, content, created_at')
    .eq('user_id', TEST_USER_ID)
    .order('created_at', { ascending: true })
    .limit(10);
    
  if (msgError) {
    console.error('Error fetching messages:', msgError);
    throw msgError;
  }
  
  console.log(`Found ${messages.length} recent messages`);
  
  // Prepare the update prompt using the new approach
  const recentMessages = messages
    .slice(-8)
    .filter(m => m.role === 'user' || (m.role === 'assistant' && m.content.length > 50))
    .slice(-6);
  
  const recentConversation = recentMessages
    .map(m => {
      const content = m.content.length > 500 ? 
        m.content.substring(0, 500) + "..." : 
        m.content;
      return `${m.role}: ${content}`;
    })
    .join('\n\n');
  
  const updatePrompt = `EXISTING SUMMARY:
${currentSummary || 'No previous summary - this is the first summary for this user.'}

RECENT CONVERSATION:
${recentConversation}

${promptConfig.memory.updateSummary}`;
  
  console.log('Calling OpenAI with update prompt...');
  
  // Call OpenAI API
  const summaryRes = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: updatePrompt }],
    max_tokens: 320,
    temperature: 0.3
  });
  
  const updatedSummary = summaryRes.choices[0]?.message?.content || '';
  console.log(`\nUpdated summary (${updatedSummary.length} chars):\n${updatedSummary}`);
  
  // Validate the update
  console.log('\n--- VALIDATION ---');
  
  // Check if new topics are incorporated
  const careerKeywords = ['career', 'teaching', 'consulting', 'corporate', 'deadlines', 'creativity'];
  const summaryLower = updatedSummary.toLowerCase();
  const foundKeywords = careerKeywords.filter(keyword => summaryLower.includes(keyword));
  
  console.log(`Career-related keywords found in summary: ${foundKeywords.join(', ')}`);
  console.log(`Keywords incorporated: ${foundKeywords.length}/${careerKeywords.length}`);
  
  // Check if historical context is preserved
  const historicalKeywords = ['work-life balance', 'stress', 'family', 'relationships'];
  const preservedKeywords = historicalKeywords.filter(keyword => summaryLower.includes(keyword.toLowerCase()));
  
  console.log(`Historical keywords preserved: ${preservedKeywords.join(', ')}`);
  console.log(`Historical context preserved: ${preservedKeywords.length}/${historicalKeywords.length}`);
  
  // Check summary structure
  const hasStructure = updatedSummary.includes('TestUser') && updatedSummary.length > currentSummary.length * 0.8;
  console.log(`Summary maintains structure: ${hasStructure}`);
  
  return updatedSummary;
}

async function cleanup() {
  console.log('Cleaning up test data...');
  
  // Delete in order due to foreign keys
  await supabase.from('chat_messages').delete().eq('user_id', TEST_USER_ID);
  await supabase.from('user_profiles').delete().eq('user_id', TEST_USER_ID);
  await supabase.from('users').delete().eq('id', TEST_USER_ID);
  
  console.log('Cleanup complete');
}

async function runTest() {
  try {
    console.log('=== MEMORY UPDATE APPROACH TEST ===\n');
    
    const initialSummary = await setupTestData();
    const updatedSummary = await testMemoryUpdate();
    
    console.log('\n--- COMPARISON ---');
    console.log(`Initial summary length: ${initialSummary.length}`);
    console.log(`Updated summary length: ${updatedSummary.length}`);
    
    const improvement = updatedSummary.length > initialSummary.length ? 'Expanded' : 'Condensed';
    console.log(`Summary was: ${improvement}`);
    
    console.log('\n✅ Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await cleanup();
  }
}

// Run the test
if (require.main === module) {
  runTest();
}

module.exports = { runTest };
