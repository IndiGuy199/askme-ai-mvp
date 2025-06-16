const { createClient } = require('@supabase/supabase-js');
const { OpenAI } = require('openai');
const dotenv = require('dotenv');
dotenv.config();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Initialize Supabase client with service role for admin access
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
);

async function repairMemorySummaries() {
  // Check command line args to see if we're targeting a specific user
  const targetEmail = process.argv[2];
  
  console.log('Memory Repair Tool');
  console.log('==================');
  
  if (targetEmail) {
    console.log(`Targeting specific user: ${targetEmail}`);
    
    // Get user by email
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, first_name')
      .eq('email', targetEmail)
      .single();
    
    if (userError) {
      console.error(`Error: User not found - ${userError.message}`);
      return;
    }
    
    await repairUserMemory(user);
  } else {
    // Get all users with empty memory summaries
    console.log('Scanning for users with empty memory summaries...');
    
    // First get all user profiles
    const { data: profiles, error: profileError } = await supabase
      .from('user_profiles')
      .select('user_id, memory_summary');
    
    if (profileError) {
      console.error(`Error fetching profiles: ${profileError.message}`);
      return;
    }
    
    // Find profiles with empty memory
    const emptyProfiles = profiles.filter(p => !p.memory_summary);
    console.log(`Found ${emptyProfiles.length} users with empty memory summaries out of ${profiles.length} total profiles`);
    
    // Get user details for these profiles
    for (const profile of emptyProfiles) {
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, email, first_name')
        .eq('id', profile.user_id)
        .single();
      
      if (userError) {
        console.error(`Error fetching user ${profile.user_id}: ${userError.message}`);
        continue;
      }
      
      await repairUserMemory(user);
    }
  }
}

async function repairUserMemory(user) {
  console.log(`\nRepairing memory for user: ${user.email} (${user.first_name || 'Unknown'})`);
  
  // Check if the user has any chat messages
  const { count, error: countError } = await supabase
    .from('chat_messages')
    .select('id', { count: 'exact' })
    .eq('user_id', user.id);
  
  if (countError) {
    console.error(`Error counting messages: ${countError.message}`);
    return;
  }
  
  console.log(`User has ${count} chat messages`);
  
  if (count < 3) {
    console.log('Not enough messages for meaningful summarization (need at least 3)');
    return;
  }
  
  // Get the messages
  const { data: messages, error: msgError } = await supabase
    .from('chat_messages')
    .select('role, content, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(50);
  
  if (msgError) {
    console.error(`Error fetching messages: ${msgError.message}`);
    return;
  }
  
  console.log('Generating memory summary from chat history...');
  
  // Format messages for the summarization prompt
  const summaryPrompt = [
    { 
      role: 'system', 
      content: `You are summarizing a chat conversation for future reference. Create a concise but comprehensive summary that includes:

1. User's name, key personal details, and preferences
2. Their main goals, challenges, and interests  
3. Important context they've shared (health, lifestyle, relationships, etc.)
4. Recent conversation topics and any progress made
5. Communication style preferences and tone they respond well to

Keep the summary under 300 words but include enough detail for personalized future conversations.`
    },
    ...messages.map(m => ({ role: m.role, content: m.content }))
  ];
  
  try {
    // Call OpenAI to generate the summary
    const summaryRes = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: summaryPrompt,
      max_tokens: 400,
      temperature: 0.3
    });
    
    const summary = summaryRes.choices[0]?.message?.content || '';
    
    if (!summary) {
      console.error('Error: OpenAI returned empty summary');
      return;
    }
    
    console.log(`Generated summary (${summary.length} chars):`);
    console.log('---');
    console.log(summary.substring(0, 200) + '...');
    console.log('---');
    
    // Save the summary to the user profile
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .upsert({ 
        user_id: user.id, 
        memory_summary: summary,
        updated_at: new Date().toISOString()
      })
      .select();
    
    if (profileError) {
      console.error(`Error saving memory summary: ${profileError.message}`);
      return;
    }
    
    console.log('✅ Memory summary successfully saved!');
    
  } catch (error) {
    console.error('Error generating or saving summary:', error);
  }
}

repairMemorySummaries().catch(console.error);
