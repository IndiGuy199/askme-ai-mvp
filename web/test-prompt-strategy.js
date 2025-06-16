/**
 * Test script to verify that coach prompts are loaded correctly from the database
 * and the promptStrategy system is working properly
 */

const { createClient } = require('@supabase/supabase-js');
const { promptConfig, loadCoachPrompts } = require('./lib/promptConfig');
const promptStrategy = require('./lib/promptStrategy');

// Get environment variables
require('dotenv').config();

// Create Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Supabase URL or key not found in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testCoachPrompts() {
  try {
    console.log('=== Testing Coach Prompts Loading ===');
    
    // 1. First, get a coach profile ID from the database
    const { data: coaches, error: coachError } = await supabase
      .from('coach_profiles')
      .select('id, code, label, system_prompt, medium_prompt, short_prompt')
      .limit(1);
    
    if (coachError) {
      throw new Error(`Error fetching coach profiles: ${coachError.message}`);
    }
    
    if (!coaches || coaches.length === 0) {
      throw new Error('No coach profiles found in the database');
    }
    
    const coachProfile = coaches[0];
    console.log(`Found coach profile: ${coachProfile.label} (${coachProfile.code}) - ID: ${coachProfile.id}`);
    
    // 2. Load the coach prompts using the loadCoachPrompts function
    console.log('\nTesting loadCoachPrompts function...');
    const coachPrompts = await loadCoachPrompts(supabase, coachProfile.id);
    
    console.log('Loaded prompts:');
    console.log('- Full prompt:', coachPrompts.full ? coachPrompts.full.substring(0, 50) + '...' : 'NOT SET');
    console.log('- Medium prompt:', coachPrompts.medium ? coachPrompts.medium.substring(0, 50) + '...' : 'NOT SET');
    console.log('- Short prompt:', coachPrompts.short ? coachPrompts.short.substring(0, 50) + '...' : 'NOT SET');
    
    // 3. Test the promptStrategy.getSystemPrompt function
    console.log('\nTesting promptStrategy.getSystemPrompt function...');
    
    // Test different scenarios
    const scenarios = [
      { messageCount: 1, hasMemory: false, isNewTopic: false, description: 'New user, first message' },
      { messageCount: 5, hasMemory: true, isNewTopic: false, description: 'Returning user, ongoing conversation' },
      { messageCount: 15, hasMemory: true, isNewTopic: false, description: 'Returning user, long conversation' },
      { messageCount: 7, hasMemory: true, isNewTopic: true, description: 'Returning user, new topic' }
    ];
    
    for (const scenario of scenarios) {
      const prompt = promptStrategy.getSystemPrompt(
        scenario.messageCount, 
        scenario.hasMemory, 
        scenario.isNewTopic, 
        coachPrompts
      );
      
      // Determine which prompt was selected
      let promptType = 'UNKNOWN';
      if (prompt === coachPrompts.full) promptType = 'FULL';
      else if (prompt === coachPrompts.medium) promptType = 'MEDIUM';
      else if (prompt === coachPrompts.short) promptType = 'SHORT';
      
      console.log(`\nScenario: ${scenario.description}`);
      console.log(`Selected prompt type: ${promptType}`);
      console.log(`Prompt preview: ${prompt.substring(0, 60)}...`);
    }
    
    // 4. Test the addRoleReminder function
    console.log('\nTesting promptStrategy.addRoleReminder function...');
    const testSummary = "User is John, a 48-year-old marketing executive who wants to improve his energy levels and manage stress better.";
    const enhancedSummary = promptStrategy.addRoleReminder(testSummary);
    
    console.log('Original summary:', testSummary);
    console.log('Enhanced summary:', enhancedSummary);
    
    console.log('\n=== All tests completed successfully ===');
  } catch (error) {
    console.error('Error during testing:', error);
  } finally {
    // Close Supabase connection
    await supabase.auth.signOut();
  }
}

testCoachPrompts();
