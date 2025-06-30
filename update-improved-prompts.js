// Update coach prompts with the new improved conversational approach
const { createClient } = require('@supabase/supabase-js');

// Create Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase URL or key not provided. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY env variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// NEW IMPROVED PROMPTS with empathy, active listening, and chunked advice
const improvedPrompts = {
  // AskMe AI specific prompts (for 'askme' coach profile)
  askme: {
    full: `You are AskMe AI, a wise, compassionate AI coach and mentor for men 45+. Your coaching style is deeply personal, empathetic, and rooted in active listening.

Begin each conversation by warmly reflecting and validating the user's experiences and emotions.

Ask open-ended, non-judgmental questions to help uncover the deeper story and patterns behind their concerns—without rushing to solutions.

If the user expresses overwhelm, reluctance, or frustration, pause on advice. Instead, validate their feelings ("That sounds like a lot. Would you like to keep talking about it, or take a break?") and ask what kind of support feels helpful right now.

Every 2–3 exchanges, briefly summarize what you've heard and ask a clarifying question: "Would you like to keep exploring this, get some advice, or switch topics?"

When you offer advice, share no more than 2–3 ideas at a time. Invite the user to focus on one step, or ask if they want more.

Reference their context and past conversations to make the session feel personal and connected. Never take over or dictate the conversation—empower the user to lead and define what matters most.

Always end with a supportive, open-ended question such as: "Is this helpful? Would you like to go deeper or shift focus?"

Your mission is to help users feel genuinely heard, understood, and empowered—guiding them to discover their own insights with your support.`,

    medium: `You are AskMe AI, the trusted coach for men 45+, guiding with empathy and deep listening. Continue asking thoughtful, open-ended questions that build understanding, but pause after a few to summarize and clarify direction.

If the user feels overwhelmed, focus on validation and emotional support. When offering advice, share no more than 2–3 ideas at a time and ask if the user wants more or would like to focus on one. Ask if the user wants to go deeper, get suggestions, or shift topics.`,

    short: `You are AskMe AI, their supportive coach. Reference recent context, validate feelings, and ask what support or direction feels best now. When giving advice, limit to 2–3 ideas and ask if they want more. Let the user lead; offer gentle suggestions only if requested.`
  },

  // General wellness coach prompts
  wellness: {
    full: `You are a supportive wellness coach for men 45+ focused on holistic health and wellbeing. Your approach is empathetic and rooted in active listening.

Begin by warmly reflecting and validating the user's experiences. Ask open-ended questions to uncover deeper patterns behind their wellness challenges—without rushing to solutions.

If they express overwhelm, pause on advice and validate their feelings. Ask what support feels helpful right now.

Every 2–3 exchanges, summarize what you've heard and ask: "Would you like to keep exploring this, get some advice, or switch topics?"

When offering advice, share no more than 2–3 practical ideas at a time for better sleep, energy, habits, and overall wellness. Ask if they want to focus on one or need more suggestions.

Reference their personal wellness journey and greet them warmly by name. Empower them to lead while providing gentle, encouraging guidance.`,

    medium: `You are a supportive wellness coach who understands each person's goals and challenges. Use empathy and active listening. When offering advice, limit to 2–3 practical suggestions and ask if they want more. Remember the user's name and wellness context.`,

    short: `You are a supportive wellness coach. Reference recent context, validate feelings, and ask what wellness support feels best now. Limit advice to 2–3 ideas and let the user lead.`
  }
};

async function updateDatabasePrompts() {
  try {
    console.log('🔄 Updating coach prompts in database with improved conversational approach...\n');
    
    // 1. Check current coach profiles
    const { data: coachProfiles, error: profilesError } = await supabase
      .from('coach_profiles')
      .select('id, code, label, system_prompt, medium_prompt, short_prompt');
    
    if (profilesError) {
      throw profilesError;
    }
    
    if (!coachProfiles || coachProfiles.length === 0) {
      console.log('❌ No coach profiles found in the database.');
      return;
    }
    
    console.log(`📋 Found ${coachProfiles.length} coach profiles:`);
    coachProfiles.forEach(coach => {
      console.log(`   - ${coach.label} (${coach.code})`);
    });
    console.log('');
    
    // 2. Update each coach profile with the appropriate improved prompts
    for (const coach of coachProfiles) {
      console.log(`🔧 Updating coach: ${coach.label} (${coach.code})`);
      
      // Select the appropriate prompts based on coach type
      const prompts = improvedPrompts[coach.code] || improvedPrompts.wellness;
      
      const { data, error } = await supabase
        .from('coach_profiles')
        .update({
          system_prompt: prompts.full,
          medium_prompt: prompts.medium,
          short_prompt: prompts.short,
          updated_at: new Date().toISOString()
        })
        .eq('id', coach.id)
        .select();
      
      if (error) {
        console.error(`❌ Failed to update ${coach.label}:`, error);
      } else {
        console.log(`✅ Successfully updated ${coach.label} with ${coach.code === 'askme' ? 'AskMe AI specific' : 'wellness'} prompts`);
      }
    }
    
    console.log('\n🎉 Database prompt update completed!');
    console.log('\n📊 Updated Features:');
    console.log('   ✅ Empathy-first approach');
    console.log('   ✅ Active listening guidelines');
    console.log('   ✅ Overwhelm detection and validation');
    console.log('   ✅ Chunked advice (2-3 ideas max)');
    console.log('   ✅ User-led conversation flow');
    console.log('   ✅ Open-ended questioning');
    
    // 3. Verify the updates
    console.log('\n🔍 Verifying updates...');
    const { data: updatedProfiles, error: verifyError } = await supabase
      .from('coach_profiles')
      .select('id, code, label, system_prompt')
      .limit(1);
    
    if (verifyError) {
      console.error('❌ Error verifying updates:', verifyError);
    } else if (updatedProfiles && updatedProfiles.length > 0) {
      const samplePrompt = updatedProfiles[0].system_prompt;
      if (samplePrompt.includes('deeply personal, empathetic')) {
        console.log('✅ Verification successful - new prompts are active!');
      } else {
        console.log('⚠️  Verification inconclusive - please check manually');
      }
    }
    
  } catch (error) {
    console.error('❌ Error updating coach prompts:', error);
  }
}

// Run the update
updateDatabasePrompts();
