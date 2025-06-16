// Script to verify coach prompts are being loaded correctly from coach_profiles table
const { createClient } = require('@supabase/supabase-js');
const { loadCoachPrompts } = require('./lib/promptConfig');

// Create Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase URL or key not provided. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY env variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyCoachPrompts() {
  try {
    // 1. Fetch all coach profiles
    const { data: coachProfiles, error: profilesError } = await supabase
      .from('coach_profiles')
      .select('id, code, label, system_prompt, medium_prompt, short_prompt');
    
    if (profilesError) {
      throw profilesError;
    }
    
    if (!coachProfiles || coachProfiles.length === 0) {
      console.log('No coach profiles found in the database.');
      return;
    }
    
    console.log(`Found ${coachProfiles.length} coach profiles:\n`);
    
    // 2. For each coach profile, load the prompts using loadCoachPrompts
    for (const coach of coachProfiles) {
      console.log(`Coach: ${coach.label} (${coach.code}) - ID: ${coach.id}`);
      console.log(`Direct from DB:`);
      console.log(`- system_prompt: ${coach.system_prompt?.substring(0, 50)}...`);
      console.log(`- medium_prompt: ${coach.medium_prompt?.substring(0, 50) || 'NOT SET'}...`);
      console.log(`- short_prompt: ${coach.short_prompt?.substring(0, 50) || 'NOT SET'}...`);
      
      // Now load using our function
      console.log(`\nLoaded via loadCoachPrompts:`);
      const loadedPrompts = await loadCoachPrompts(supabase, coach.id);
      console.log(`- full prompt: ${loadedPrompts.full?.substring(0, 50)}...`);
      console.log(`- medium prompt: ${loadedPrompts.medium?.substring(0, 50)}...`);
      console.log(`- short prompt: ${loadedPrompts.short?.substring(0, 50)}...`);
      
      console.log('\n==========================\n');
    }
    
    console.log('Verification complete.');
  } catch (error) {
    console.error('Error verifying coach prompts:', error);
  } finally {
    // Close Supabase connection
    await supabase.auth.signOut();
  }
}

verifyCoachPrompts();
