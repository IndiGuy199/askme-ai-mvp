// Update coach prompts in the database
const { createClient } = require('@supabase/supabase-js');

// Create Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase URL or key not provided. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY env variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// AskMe AI specific prompts
const askMePrompts = {
  full: `You are AskMe AI, a calm, intelligent wellness coach for men 45+. Act as a discreet, trusted companion who remembers each user's background, struggles, preferences, and goals. Your purpose: help them gain energy, clarity, motivation, and confidence through simple, actionable guidance. Ask questions one-on-one for full context. Always encourage, never judge.`,
  medium: `You are AskMe AI, wellness coach for men 45+. Be calm, intelligent, supportive, and trustworthy. Remember the user's background and goals. Focus on actionable guidance for energy, clarity, and motivation.`,
  short: `You are AskMe AI, the wellness coach for men 45+. Maintain your calm, intelligent persona. Continue based on the user's context and your memory of their goals, preferences, and challenges.`
};

async function updateCoachPrompts() {
  try {
    // 1. Fetch all coach profiles
    const { data: coachProfiles, error: profilesError } = await supabase
      .from('coach_profiles')
      .select('id, code, label, system_prompt');
    
    if (profilesError) {
      throw profilesError;
    }
    
    if (!coachProfiles || coachProfiles.length === 0) {
      console.log('No coach profiles found in the database.');
      return;
    }
    
    console.log(`Found ${coachProfiles.length} coach profiles. Updating prompts...`);
    
    // 2. Update each coach profile with appropriate prompts
    for (const coach of coachProfiles) {
      console.log(`Updating coach: ${coach.label} (${coach.code})`);
      
      // For wellness coach use the AskMe AI prompts, for others create appropriate variations
      const prompts = coach.code === 'wellness' ? 
        askMePrompts : 
        {
          full: coach.system_prompt || `You are a ${coach.label.toLowerCase()}. Focus on helping men 45+ with their wellness goals.`,
          medium: `You are a ${coach.label.toLowerCase()}. Be supportive and insightful. Remember the user's context and goals.`,
          short: `Continue as a ${coach.label.toLowerCase()}, maintaining your supportive persona.`
        };
      
      // Update the prompts in the database
      const { error: updateError } = await supabase
        .from('coach_profiles')
        .update({
          system_prompt: prompts.full,
          medium_prompt: prompts.medium,
          short_prompt: prompts.short
        })
        .eq('id', coach.id);
      
      if (updateError) {
        console.error(`Error updating prompts for ${coach.label}:`, updateError);
        continue;
      }
      
      console.log(`Successfully updated prompts for ${coach.label}`);
    }
    
    console.log('All coach prompts updated successfully.');
  } catch (error) {
    console.error('Error updating coach prompts:', error);
  } finally {
    // Close Supabase connection
    await supabase.auth.signOut();
  }
}

updateCoachPrompts();